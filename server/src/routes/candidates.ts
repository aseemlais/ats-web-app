import { Router, type Request, type Response } from 'express';
import { authMiddleware, requireAuth } from '../middleware/auth';

const candidatesRouter = Router();

// Apply auth middleware to all candidates routes
candidatesRouter.use(authMiddleware);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the Python ATS base URL, stripping any trailing slash.
 * Accepts either a dedicated PYTHON_ATS_URL env var or falls back to
 * stripping the /invocations suffix from API_PROXY (for deployments that
 * set only API_PROXY).
 */
function getPythonBase(): string {
  if (process.env.PYTHON_ATS_URL) {
    return process.env.PYTHON_ATS_URL.replace(/\/$/, '');
  }
  if (process.env.API_PROXY) {
    return process.env.API_PROXY.replace(/\/invocations$/, '').replace(/\/$/, '');
  }
  return '';
}

async function proxyToPython(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const base = getPythonBase();
  if (!base) {
    throw new ConfigError('PYTHON_ATS_URL is not configured on this server.');
  }
  return fetch(`${base}${path}`, options) as unknown as Response;
}

/** Sentinel error so we can return 503 clearly without reaching the catch-all. */
class ConfigError extends Error {}

// ---------------------------------------------------------------------------
// GET /api/candidates  — list with pagination
// ---------------------------------------------------------------------------

candidatesRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const upstream = await proxyToPython(
      `/api/candidates?limit=${limit}&offset=${offset}`,
    );
    const body = await upstream.text();
    res.status(upstream.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: (err as Error).message });
    }
    console.error('[candidates] list error:', err);
    res.status(502).json({ error: 'Upstream error while listing candidates.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/candidates/search  — search with pagination
// Must be registered BEFORE /:id so Express matches it first.
// ---------------------------------------------------------------------------

candidatesRouter.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) ?? '';
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const params = new URLSearchParams({
      q,
      limit: String(limit),
      offset: String(offset),
    });
    const upstream = await proxyToPython(`/api/candidates/search?${params}`);
    const body = await upstream.text();
    res.status(upstream.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: (err as Error).message });
    }
    console.error('[candidates] search error:', err);
    res.status(502).json({ error: 'Upstream error while searching candidates.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/candidates/:id  — retrieve candidate metadata + resume text
// ---------------------------------------------------------------------------

candidatesRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Candidate ID is required.' });
    }
    const upstream = await proxyToPython(`/api/candidates/${encodeURIComponent(id)}`);
    const body = await upstream.text();
    res.status(upstream.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: (err as Error).message });
    }
    console.error('[candidates] get error:', err);
    res.status(502).json({ error: 'Upstream error while retrieving candidate.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/candidates/:id/download  — short-lived signed URL from Supabase
// ---------------------------------------------------------------------------

candidatesRouter.get('/:id/download', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Candidate ID is required.' });
    }
    const upstream = await proxyToPython(
      `/api/candidates/${encodeURIComponent(id)}/download`,
    );
    const body = await upstream.text();
    res.status(upstream.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: (err as Error).message });
    }
    console.error('[candidates] download error:', err);
    res.status(502).json({ error: 'Upstream error while generating download URL.' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/candidates/:id  — delete candidate; requires ATS_ADMIN_TOKEN
// ---------------------------------------------------------------------------

candidatesRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const token = process.env.ATS_ADMIN_TOKEN;

  // Guard: token must be configured server-side — never expose it or invent one
  if (!token) {
    return res.status(503).json({
      error:
        'Candidate deletion is disabled: ATS_ADMIN_TOKEN is not configured on this server. ' +
        'Set it as a private environment variable on Render, then redeploy.',
    });
  }

  try {
    const { id } = req.params;
    if (!id || id.trim() === '') {
      return res.status(400).json({ error: 'Candidate ID is required.' });
    }

    const upstream = await proxyToPython(
      `/api/candidates/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          // Forward the admin token — never logged or returned to the client
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const body = await upstream.text();

    // 207 = storage deleted but DB row not removed (partial failure)
    // 409 = storage deletion failed; DB row retained for retry safety
    // Forward the exact status + body so the UI can handle each case distinctly
    res.status(upstream.status).set('Content-Type', 'application/json').send(body);
  } catch (err) {
    if (err instanceof ConfigError) {
      return res.status(503).json({ error: (err as Error).message });
    }
    console.error('[candidates] delete error:', err);
    res.status(502).json({ error: 'Upstream error while deleting candidate.' });
  }
});

export { candidatesRouter };
