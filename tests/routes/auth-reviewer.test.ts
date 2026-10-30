/**
 * Reviewer Authentication Routes — unit/integration tests
 *
 * Tests: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
 *
 * Run with:
 *   TEST_MODE=ephemeral npx playwright test tests/routes/auth-reviewer.test.ts --project=routes --reporter=line
 *
 * Note on test-mode auth:
 *   When PLAYWRIGHT=True, the auth middleware injects a test session by default.
 *   To simulate unauthenticated requests, tests must send `X-Anonymous: true`
 *   which triggers the test-mode null-session path in databricks-auth.ts.
 *   Tests that need a real HMAC token (ATS_SESSION_SECRET) are skipped if
 *   the env var is not set.
 */

import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3001';

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

/** Headers that simulate an unauthenticated request in PLAYWRIGHT test mode */
const ANON_HEADERS = { 'X-Anonymous': 'true' };

// ----------------------------------------------------------------
// Tests: POST /api/auth/login
// ----------------------------------------------------------------

test.describe('POST /api/auth/login', () => {
  test('returns 400 when email or password is missing', async ({ request }) => {
    const res = await request.post(apiUrl('/api/auth/login'), {
      data: {},
      headers: { 'Content-Type': 'application/json', ...ANON_HEADERS },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 401 with wrong credentials', async ({ request }) => {
    const res = await request.post(apiUrl('/api/auth/login'), {
      data: { email: 'wrong@example.com', password: 'wrongpassword' },
      headers: { 'Content-Type': 'application/json', ...ANON_HEADERS },
    });
    expect([400, 401]).toContain(res.status());
  });

  test('returns 401 when reviewer env vars are not configured', async ({
    request,
  }) => {
    // In ephemeral test mode, ATS_REVIEWER_EMAIL/HASH are not set.
    // verifyReviewerCredentials returns false → 401.
    const res = await request.post(apiUrl('/api/auth/login'), {
      data: { email: 'test@example.com', password: 'testpassword' },
      headers: { 'Content-Type': 'application/json', ...ANON_HEADERS },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ----------------------------------------------------------------
// Tests: POST /api/auth/logout
// ----------------------------------------------------------------

test.describe('POST /api/auth/logout', () => {
  test('clears cookie and returns ok:true', async ({ request }) => {
    const res = await request.post(apiUrl('/api/auth/logout'));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // Cookie should be cleared (Set-Cookie header with empty value / Max-Age=0)
    const setCookie = res.headers()['set-cookie'] ?? '';
    if (setCookie) {
      expect(setCookie).toMatch(/ats_reviewer_session=;|Max-Age=0/);
    }
  });
});

// ----------------------------------------------------------------
// Tests: GET /api/auth/me
// ----------------------------------------------------------------

test.describe('GET /api/auth/me', () => {
  test('returns user:null when no cookie is present', async ({ request }) => {
    const res = await request.get(apiUrl('/api/auth/me'));
    expect(res.status()).toBe(200);
    const body = await res.json();
    // /api/auth/me checks the reviewer cookie only — not the Databricks session
    expect(body.user).toBeNull();
  });

  test('returns user:null with a tampered cookie', async ({ request }) => {
    const res = await request.get(apiUrl('/api/auth/me'), {
      headers: { Cookie: 'ats_reviewer_session=fakepayload.invalidsig' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  test('returns user:null with an expired HMAC token', async ({ request }) => {
    const secret = process.env.ATS_SESSION_SECRET;
    if (!secret) {
      test.skip();
      return;
    }

    // 9 hours ago — beyond the 8-hour server-side expiry
    const iat = Date.now() - 9 * 60 * 60 * 1000;
    const payload = JSON.stringify({ email: 'test@example.com', iat });
    const encoded = Buffer.from(payload).toString('base64url');
    const sig = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('base64url');
    const token = `${encoded}.${sig}`;

    const res = await request.get(apiUrl('/api/auth/me'), {
      headers: { Cookie: `ats_reviewer_session=${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  test('returns user object with a valid HMAC token', async ({ request }) => {
    const secret = process.env.ATS_SESSION_SECRET;
    if (!secret) {
      test.skip();
      return;
    }

    const iat = Date.now();
    const email = 'reviewer@example.com';
    const payload = JSON.stringify({ email, iat });
    const encoded = Buffer.from(payload).toString('base64url');
    const sig = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('base64url');
    const token = `${encoded}.${sig}`;

    const res = await request.get(apiUrl('/api/auth/me'), {
      headers: { Cookie: `ats_reviewer_session=${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user?.email).toBe(email);
  });
});

// ----------------------------------------------------------------
// Tests: Candidate repository protection
// ----------------------------------------------------------------

test.describe('Candidate repository protection with reviewer cookie', () => {
  test('GET /api/candidates returns 401 without any session', async ({
    request,
  }) => {
    // X-Anonymous: true triggers the test-mode null-session path,
    // simulating a request with no authentication on non-Databricks host.
    const res = await request.get(apiUrl('/api/candidates'), {
      headers: { ...ANON_HEADERS },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/candidates returns 401 with a tampered reviewer cookie', async ({
    request,
  }) => {
    const res = await request.get(apiUrl('/api/candidates'), {
      headers: {
        ...ANON_HEADERS,
        Cookie: 'ats_reviewer_session=fakepayload.invalidsig',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/candidates passes auth with a valid reviewer cookie', async ({
    request,
  }) => {
    const secret = process.env.ATS_SESSION_SECRET;
    if (!secret) {
      test.skip();
      return;
    }

    const iat = Date.now();
    const email = 'reviewer@example.com';
    const payload = JSON.stringify({ email, iat });
    const encoded = Buffer.from(payload).toString('base64url');
    const sig = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('base64url');
    const token = `${encoded}.${sig}`;

    const res = await request.get(apiUrl('/api/candidates'), {
      headers: {
        ...ANON_HEADERS,
        Cookie: `ats_reviewer_session=${token}`,
      },
    });
    // Auth passes (reviewer cookie valid) — proxy may fail with 5xx,
    // but should NOT be 401.
    expect(res.status()).not.toBe(401);
  });
});

// ----------------------------------------------------------------
// Tests: GET /api/session with reviewer cookie
// ----------------------------------------------------------------

test.describe('Session endpoint with reviewer cookie', () => {
  test('GET /api/session returns user:null without reviewer cookie', async ({
    request,
  }) => {
    // Use X-Anonymous to suppress test-mode session injection.
    const res = await request.get(apiUrl('/api/session'), {
      headers: { ...ANON_HEADERS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // No Databricks session + no reviewer cookie → null user
    expect(body.user).toBeNull();
  });

  test('GET /api/session returns reviewer user with valid cookie', async ({
    request,
  }) => {
    const secret = process.env.ATS_SESSION_SECRET;
    if (!secret) {
      test.skip();
      return;
    }

    const iat = Date.now();
    const email = 'reviewer@example.com';
    const payload = JSON.stringify({ email, iat });
    const encoded = Buffer.from(payload).toString('base64url');
    const sig = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('base64url');
    const token = `${encoded}.${sig}`;

    const res = await request.get(apiUrl('/api/session'), {
      headers: {
        ...ANON_HEADERS,
        Cookie: `ats_reviewer_session=${token}`,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user?.email).toBe(email);
  });
});

// ----------------------------------------------------------------
// Security: client-supplied identity headers
// ----------------------------------------------------------------

test.describe('Security: client-supplied identity headers rejected on Render', () => {
  test('X-Forwarded-User header cannot authenticate on non-Databricks host', async ({
    request,
  }) => {
    // On non-Databricks hosts (e.g. Render), isDatabricksEnv is false.
    // X-Forwarded-User should be ignored by getAuthSession.
    // We suppress test-mode injection with X-Anonymous; then add X-Forwarded-User
    // and verify it does NOT grant access to a protected route.
    const res = await request.get(apiUrl('/api/candidates'), {
      headers: {
        ...ANON_HEADERS,
        'X-Forwarded-User': 'admin@example.com',
        'X-Forwarded-Email': 'admin@example.com',
      },
    });
    // Should be 401 — the spoofed header must not grant access
    expect(res.status()).toBe(401);
  });
});
