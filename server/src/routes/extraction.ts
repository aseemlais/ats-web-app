/**
 * extraction.ts
 * =============
 * Server-side proxy for the HF Space async resume extraction API.
 *
 * Routes (all require authentication):
 *   POST /api/extract          → HF Space POST /extract
 *   GET  /api/extract/:id      → HF Space GET  /jobs/:id
 *
 * Security:
 *   - requireAuth middleware ensures only logged-in reviewers can call these routes.
 *   - X-ATS-Internal-Secret header is added server-side from ATS_INTERNAL_SECRET env var.
 *   - Per-session rate limiting: max 10 upload and 60 poll requests per reviewer per minute.
 *   - 90-second fetch timeout with AbortController.
 *
 * The client (React) calls /api/extract and /api/extract/:id — it never speaks directly
 * to the HF Space URL and never sees ATS_INTERNAL_SECRET.
 */

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { authMiddleware, requireAuth } from '../middleware/auth';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HF_SPACE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — mirrors the Python cap
const PROXY_TIMEOUT_MS = 90_000;                  // 90 s — long enough for cold-start + extraction

/** Returns the HF Space base URL (strips trailing slash). */
function getPythonBase(): string {
  const url =
    process.env.PYTHON_ATS_URL ||
    (process.env.API_PROXY
      ? process.env.API_PROXY.replace(/\/invocations\/?$/, '')
      : '');
  return url.replace(/\/$/, '');
}

/** ATS_INTERNAL_SECRET must be set in Render env; never logged. */
function getInternalSecret(): string {
  return process.env.ATS_INTERNAL_SECRET ?? '';
}

// ---------------------------------------------------------------------------
// Per-session rate limiting (in-memory, keyed by session user id)
// ---------------------------------------------------------------------------

interface RateLimitBucket {
  timestamps: number[];
}

const _extractBuckets = new Map<string, RateLimitBucket>();
const _pollBuckets = new Map<string, RateLimitBucket>();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_EXTRACT_MAX = Number(process.env.NODE_RATE_LIMIT_EXTRACT ?? 10);
const RATE_LIMIT_POLL_MAX = Number(process.env.NODE_RATE_LIMIT_POLL ?? 60);

function checkSessionRateLimit(
  map: Map<string, RateLimitBucket>,
  key: string,
  maxRequests: number,
): boolean {
  const now = Date.now();
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    map.set(key, bucket);
  }
  // Evict stale entries
  bucket.timestamps = bucket.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (bucket.timestamps.length >= maxRequests) return false;
  bucket.timestamps.push(now);
  return true;
}

// Periodically evict empty buckets to prevent unbounded memory growth (every 5 min)
const evictionInterval = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _extractBuckets) {
    if (v.timestamps.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) _extractBuckets.delete(k);
  }
  for (const [k, v] of _pollBuckets) {
    if (v.timestamps.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) _pollBuckets.delete(k);
  }
}, 5 * 60_000);
if (evictionInterval && typeof evictionInterval.unref === 'function') { evictionInterval.unref(); }

// ---------------------------------------------------------------------------
// Multer — memory storage, 5 MB cap (mirrors HF Space Python cap)
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HF_SPACE_MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (!allowed.includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext}". Upload PDF, DOCX, or TXT.`));
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class ConfigError extends Error {}

/** Abort-controller-wrapped fetch with configurable timeout. */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const extractionRouter = Router();

extractionRouter.use(authMiddleware);

// ---------------------------------------------------------------------------
// POST /api/extract
// ---------------------------------------------------------------------------

extractionRouter.post(
  '/',
  requireAuth,
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `File exceeds maximum allowed size (${HF_SPACE_MAX_SIZE_BYTES / (1024 * 1024)}MB).`,
        });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const userId = req.session?.user?.id ?? req.session?.user?.email ?? 'anon';

    // Per-session rate limit
    if (!checkSessionRateLimit(_extractBuckets, userId, RATE_LIMIT_EXTRACT_MAX)) {
      return res.status(429).json({
        error: 'Too many extraction requests. Please wait a moment and try again.',
      });
    }

    const base = getPythonBase();
    if (!base) {
      return res.status(503).json({ error: 'Extraction service URL is not configured on this server.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const secret = getInternalSecret();
    if (!secret) {
      console.warn('[extraction] ATS_INTERNAL_SECRET is not set — requests to HF Space will be rejected.');
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], {
      type: req.file.mimetype || 'application/octet-stream',
    });
    formData.append('file', blob, req.file.originalname);

    console.log(
      `[extraction] POST /extract from user=${userId} file="${req.file.originalname}" size=${req.file.size}B`,
    );

    try {
      const upstream = await fetchWithTimeout(
        `${base}/extract`,
        {
          method: 'POST',
          headers: { 'X-ATS-Internal-Secret': secret },
          body: formData,
        },
        PROXY_TIMEOUT_MS,
      );

      const body = await upstream.text();
      console.log(`[extraction] POST /extract upstream status=${upstream.status}`);
      res.status(upstream.status).set('Content-Type', 'application/json').send(body);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error('[extraction] POST /extract timed out after', PROXY_TIMEOUT_MS, 'ms');
        return res.status(504).json({ error: 'Extraction service timed out. Please retry.' });
      }
      console.error('[extraction] POST /extract proxy error:', err);
      res.status(502).json({ error: 'Could not reach the extraction service. Please retry.' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/extract/:id  — job status polling
// ---------------------------------------------------------------------------

extractionRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session?.user?.id ?? req.session?.user?.email ?? 'anon';
  const { id } = req.params;

  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Job ID is required.' });
  }

  // Per-session rate limit (poll endpoint gets a larger cap)
  if (!checkSessionRateLimit(_pollBuckets, userId, RATE_LIMIT_POLL_MAX)) {
    return res.status(429).json({ error: 'Too many job polling requests. Please slow down.' });
  }

  const base = getPythonBase();
  if (!base) {
    return res.status(503).json({ error: 'Extraction service URL is not configured on this server.' });
  }

  const secret = getInternalSecret();

  try {
    const upstream = await fetchWithTimeout(
      `${base}/jobs/${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: { 'X-ATS-Internal-Secret': secret },
      },
      PROXY_TIMEOUT_MS,
    );

    const body = await upstream.text();
    res.status(upstream.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[extraction] GET /jobs/${id} timed out`);
      return res.status(504).json({ error: 'Job status request timed out. Please retry.' });
    }
    console.error(`[extraction] GET /jobs/${id} proxy error:`, err);
    res.status(502).json({ error: 'Could not reach the extraction service.' });
  }
});

