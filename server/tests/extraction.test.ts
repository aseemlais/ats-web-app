/**
 * extraction.test.ts
 * ==================
 * Unit tests for the Node/Express extraction proxy route.
 *
 * Runs in-process with no live backend required.
 * Mocks only the upstream HF Space fetch calls; local requests to 127.0.0.1 pass through.
 */

import assert from 'node:assert/strict';
import { describe, it, before, after, afterEach } from 'node:test';
import express, { type Express } from 'express';
import { createServer, type Server } from 'node:http';

const realFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Helpers: mock fetch for upstream calls only
// ---------------------------------------------------------------------------

type FakeFetchResponse = {
  status: number;
  body: string;
  headers?: Record<string, string>;
};

function mockFetch(responses: Map<string, FakeFetchResponse>) {
  const calls: { url: string; init: RequestInit }[] = [];

  (globalThis as Record<string, unknown>).fetch = async (
    url: string | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Pass through local server requests
    if (urlStr.includes('127.0.0.1') || urlStr.includes('localhost')) {
      return realFetch(url, init);
    }

    calls.push({ url: urlStr, init: init ?? {} });

    const matched =
      responses.get(urlStr) ??
      [...responses.entries()].find(([k]) => urlStr.includes(k))?.[1];

    if (!matched) {
      throw new Error(`mockFetch: unmatched URL ${urlStr}`);
    }

    const headers = new Headers(matched.headers ?? { 'content-type': 'application/json' });
    return new Response(matched.body, { status: matched.status, headers });
  };

  return calls;
}

function restoreFetch() {
  (globalThis as Record<string, unknown>).fetch = realFetch;
}

// ---------------------------------------------------------------------------
// Bootstrap test app
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<Express> {
  process.env.PYTHON_ATS_URL = 'http://hf-space.example.com';
  process.env.ATS_INTERNAL_SECRET = 'test-secret-123';

  const { extractionRouter } = await import('../src/routes/extraction.ts');

  const app = express();
  app.use(express.json());

  // Inject session for requireAuth
  app.use((_req, _res, next) => {
    (_req as Record<string, unknown>).session = {
      user: { id: 'test-user-001', email: 'test@ats.local' },
    };
    next();
  });

  app.use('/api/extract', extractionRouter);
  return app;
}

function b(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function fetchApp(
  app: Express,
  method: string,
  path: string,
  body?: FormData | null,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        return reject(new Error('Server address not available'));
      }
      const port = addr.port;
      try {
        const url = `http://127.0.0.1:${port}${path}`;
        const opts: RequestInit = { method };
        if (body) {
          opts.body = body as BodyInit;
        }
        const response = await realFetch(url, opts);
        resolve(response);
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/extract', () => {
  let app: Express;

  before(async () => {
    app = await buildTestApp();
  });

  afterEach(() => {
    restoreFetch();
  });

  it('proxies a valid PDF upload and returns upstream status + body', async () => {
    const upstreamBody = JSON.stringify({
      job_id: 'abc-123',
      status: 'pending',
      message: 'Resume submitted for processing.',
    });

    const calls = mockFetch(
      new Map([['http://hf-space.example.com/extract', { status: 202, body: upstreamBody }]]),
    );

    const formData = new FormData();
    formData.append('file', new Blob([b('%PDF-1.4\nHello')], { type: 'application/pdf' }), 'resume.pdf');

    const res = await fetchApp(app, 'POST', '/api/extract', formData);

    assert.equal(res.status, 202);
    const json = await res.json();
    assert.equal(json.job_id, 'abc-123');
    assert.equal(json.status, 'pending');

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['X-ATS-Internal-Secret'], 'test-secret-123');
  });

  it('returns 200 with result on cache hit', async () => {
    const upstreamBody = JSON.stringify({
      job_id: 'xyz-999',
      status: 'completed',
      cached: true,
      extractionSource: 'cache',
      result: { candidateName: 'Alice', jobTitle: 'Engineer' },
    });

    mockFetch(new Map([['http://hf-space.example.com/extract', { status: 200, body: upstreamBody }]]));

    const formData = new FormData();
    formData.append('file', new Blob([b('%PDF-1.4\nAlice')], { type: 'application/pdf' }), 'alice.pdf');

    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.cached, true);
    assert.equal(json.result.candidateName, 'Alice');
  });

  it('returns 429 when upstream queue is full', async () => {
    const upstreamBody = JSON.stringify({ error: 'Extraction queue is at capacity.' });
    mockFetch(new Map([['http://hf-space.example.com/extract', { status: 429, body: upstreamBody }]]));

    const formData = new FormData();
    formData.append('file', new Blob([b('%PDF-1.4\nX')], { type: 'application/pdf' }), 'r.pdf');

    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 429);
  });

  it('returns 400 when no file is attached', async () => {
    const formData = new FormData();
    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 400);
  });

  it('returns 413 when file exceeds 5MB multer cap', async () => {
    const bigPdf = new Uint8Array(6 * 1024 * 1024).fill(65);
    const formData = new FormData();
    formData.append('file', new Blob([bigPdf], { type: 'application/pdf' }), 'big.pdf');

    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 413);
  });

  it('returns 400 for unsupported file extension', async () => {
    const formData = new FormData();
    formData.append('file', new Blob([b('some content')], { type: 'image/png' }), 'resume.png');

    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 400);
  });

  it('returns 503 when PYTHON_ATS_URL is not configured', async () => {
    const savedUrl = process.env.PYTHON_ATS_URL;
    delete process.env.PYTHON_ATS_URL;
    delete process.env.API_PROXY;

    try {
      const formData = new FormData();
      formData.append('file', new Blob([b('%PDF-1.4\nX')], { type: 'application/pdf' }), 'r.pdf');
      const res = await fetchApp(app, 'POST', '/api/extract', formData);
      assert.equal(res.status, 503);
    } finally {
      process.env.PYTHON_ATS_URL = savedUrl ?? 'http://hf-space.example.com';
    }
  });

  it('returns 504 on upstream timeout (AbortError)', async () => {
    (globalThis as Record<string, unknown>).fetch = async (url: string | URL, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('127.0.0.1')) return realFetch(url, init);
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const formData = new FormData();
    formData.append('file', new Blob([b('%PDF-1.4\nX')], { type: 'application/pdf' }), 'r.pdf');
    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 504);
  });

  it('returns 502 on generic upstream network error', async () => {
    (globalThis as Record<string, unknown>).fetch = async (url: string | URL, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('127.0.0.1')) return realFetch(url, init);
      throw new Error('ECONNREFUSED');
    };

    const formData = new FormData();
    formData.append('file', new Blob([b('%PDF-1.4\nX')], { type: 'application/pdf' }), 'r.pdf');
    const res = await fetchApp(app, 'POST', '/api/extract', formData);
    assert.equal(res.status, 502);
  });

  it('enforces per-session rate limit after 10 uploads', async () => {
    const fakeUser = `rate-limit-test-${Date.now()}`;

    const rateLimitApp = express();
    rateLimitApp.use(express.json());
    rateLimitApp.use((_req, _res, next) => {
      (_req as Record<string, unknown>).session = {
        user: { id: fakeUser, email: `${fakeUser}@test.local` },
      };
      next();
    });
    const { extractionRouter: freshRouter } = await import('../src/routes/extraction.ts');
    rateLimitApp.use('/api/extract', freshRouter);

    const upstreamBody = JSON.stringify({ job_id: 'x', status: 'pending' });

    for (let i = 0; i < 10; i++) {
      mockFetch(new Map([['http://hf-space.example.com/extract', { status: 202, body: upstreamBody }]]));
      const formData = new FormData();
      formData.append('file', new Blob([b('%PDF-1.4\nX')], { type: 'application/pdf' }), `r${i}.pdf`);
      const res = await fetchApp(rateLimitApp, 'POST', '/api/extract', formData);
      assert.notEqual(res.status, 429, `Request ${i + 1} should not be rate-limited`);
      restoreFetch();
    }

    const formData = new FormData();
    formData.append('file', new Blob([b('%PDF-1.4\nX')], { type: 'application/pdf' }), 'r11.pdf');
    const res = await fetchApp(rateLimitApp, 'POST', '/api/extract', formData);
    assert.equal(res.status, 429, '11th request should be rate-limited');
  });
});

describe('GET /api/extract/:id', () => {
  let app: Express;

  before(async () => {
    app = await buildTestApp();
  });

  afterEach(() => {
    restoreFetch();
  });

  it('proxies job status polling and returns upstream body', async () => {
    const upstreamBody = JSON.stringify({
      job_id: 'abc-123',
      status: 'processing',
      result: null,
      error: null,
    });

    const calls = mockFetch(
      new Map([['http://hf-space.example.com/jobs/abc-123', { status: 200, body: upstreamBody }]]),
    );

    const res = await fetchApp(app, 'GET', '/api/extract/abc-123');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'processing');

    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['X-ATS-Internal-Secret'], 'test-secret-123');
  });

  it('returns 404 when job is not found on HF Space', async () => {
    mockFetch(new Map([['jobs/unknown-id', { status: 404, body: JSON.stringify({ detail: 'Job not found.' }) }]]));
    const res = await fetchApp(app, 'GET', '/api/extract/unknown-id');
    assert.equal(res.status, 404);
  });

  it('returns completed job result with no storageObjectPath', async () => {
    const result = {
      candidateName: 'Bob',
      jobTitle: 'DevOps',
      email: 'bob@dev.ops',
      skills: ['Docker'],
      extractionSource: 'fallback',
    };
    const upstreamBody = JSON.stringify({
      job_id: 'done-456',
      status: 'completed',
      result,
    });

    mockFetch(new Map([['jobs/done-456', { status: 200, body: upstreamBody }]]));
    const res = await fetchApp(app, 'GET', '/api/extract/done-456');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'completed');
    assert.equal(json.result.candidateName, 'Bob');
    assert.ok(!('storageObjectPath' in (json.result ?? {})), 'storageObjectPath must not be returned');
  });

  it('returns 504 on upstream timeout', async () => {
    (globalThis as Record<string, unknown>).fetch = async (url: string | URL, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('127.0.0.1')) return realFetch(url, init);
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    };
    const res = await fetchApp(app, 'GET', '/api/extract/slow-job');
    assert.equal(res.status, 504);
  });

  it('returns 502 on network error', async () => {
    (globalThis as Record<string, unknown>).fetch = async (url: string | URL, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('127.0.0.1')) return realFetch(url, init);
      throw new Error('ECONNREFUSED');
    };
    const res = await fetchApp(app, 'GET', '/api/extract/netfail-job');
    assert.equal(res.status, 502);
  });
});
