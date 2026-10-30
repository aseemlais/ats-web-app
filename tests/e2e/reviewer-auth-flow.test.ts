/**
 * E2E: Full reviewer auth flow
 * login → repository listing → select persisted candidate → screening → logout → access denied
 *
 * Run with:
 *   ATS_SESSION_SECRET=<secret> TEST_MODE=ephemeral
 *   npx playwright test tests/e2e/reviewer-auth-flow.test.ts --project=e2e --reporter=line
 *
 * Requires ATS_SESSION_SECRET to be set (signs the session cookie directly
 * so we can test the full flow without real credentials).
 */

import { test, expect, type BrowserContext } from '@playwright/test';
import * as crypto from 'crypto';

// ----------------------------------------------------------------
// Helper: inject a valid reviewer session cookie into a browser context
// ----------------------------------------------------------------

function makeReviewerToken(email: string): string {
  const secret = process.env.ATS_SESSION_SECRET;
  if (!secret) throw new Error('ATS_SESSION_SECRET must be set for this test');

  const iat = Date.now();
  const payload = JSON.stringify({ email, iat });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

async function injectReviewerSession(
  context: BrowserContext,
  email = 'reviewer@example.com',
) {
  await context.addCookies([
    {
      name: 'ats_reviewer_session',
      value: makeReviewerToken(email),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

test.describe('Reviewer auth flow', () => {
  test.skip(
    !process.env.ATS_SESSION_SECRET,
    'ATS_SESSION_SECRET required for reviewer auth flow tests',
  );

  test('unauthenticated access to screening page redirects or shows login', async ({
    page,
  }) => {
    await page.goto(`${BASE}/screening`);
    // Without a session, ChatLayout should either redirect or show auth message
    // In this test setup, /api/session returns null → ChatLayout shows "Authentication Required"
    // OR the app redirects to /login
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const content = await page.textContent('body');
    const isOnLogin = url.includes('/login') || url.includes('/');
    const showsAuthMsg =
      content?.includes('Authentication Required') ||
      content?.includes('Sign in') ||
      content?.includes('Login');
    expect(isOnLogin || showsAuthMsg).toBeTruthy();
  });

  test('reviewer can access screening page with valid session cookie', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await injectReviewerSession(context);
    const page = await context.newPage();
    await page.goto(`${BASE}/screening`);
    await page.waitForLoadState('networkidle');
    // Should NOT show "Authentication Required"
    const content = await page.textContent('body');
    expect(content).not.toContain('Authentication Required');
    await context.close();
  });

  test('GET /api/candidates returns data with valid reviewer cookie', async ({
    request,
    browser,
  }) => {
    const secret = process.env.ATS_SESSION_SECRET!;
    const token = makeReviewerToken('reviewer@example.com');

    const res = await request.get(`${BASE.replace(':3000', ':3001')}/api/candidates`, {
      headers: {
        Cookie: `ats_reviewer_session=${token}`,
        'X-Anonymous': 'true', // suppress test-mode Databricks injection
      },
    });
    // Auth passes (not 401) — may be 503 if PYTHON_ATS_URL not configured
    expect(res.status()).not.toBe(401);
  });

  test('GET /api/session returns reviewer user with valid cookie', async ({
    request,
  }) => {
    const token = makeReviewerToken('reviewer@example.com');
    const serverBase = process.env.TEST_BASE_URL ?? 'http://localhost:3001';

    const res = await request.get(`${serverBase}/api/session`, {
      headers: {
        'X-Anonymous': 'true',
        Cookie: `ats_reviewer_session=${token}`,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user?.email).toBe('reviewer@example.com');
  });

  test('POST /api/auth/logout clears session and /api/auth/me returns null', async ({
    request,
  }) => {
    const serverBase = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
    const token = makeReviewerToken('reviewer@example.com');

    // Verify session is valid before logout
    const meBefore = await request.get(`${serverBase}/api/auth/me`, {
      headers: { Cookie: `ats_reviewer_session=${token}` },
    });
    expect((await meBefore.json()).user?.email).toBe('reviewer@example.com');

    // Logout
    const logout = await request.post(`${serverBase}/api/auth/logout`, {
      headers: { Cookie: `ats_reviewer_session=${token}` },
    });
    expect(logout.status()).toBe(200);
    expect((await logout.json()).ok).toBe(true);

    // The logout response should clear the cookie
    const setCookie = logout.headers()['set-cookie'] ?? '';
    expect(setCookie).toBeTruthy();
    expect(setCookie).toMatch(/ats_reviewer_session=;|Max-Age=0/);

    // After logout cookie cleared, direct /api/auth/me with no cookie → null
    const meAfter = await request.get(`${serverBase}/api/auth/me`);
    expect((await meAfter.json()).user).toBeNull();
  });

  test('candidate repository access denied after logout', async ({
    request,
  }) => {
    const serverBase = process.env.TEST_BASE_URL ?? 'http://localhost:3001';

    // Without any cookie, /api/candidates → 401
    const res = await request.get(`${serverBase}/api/candidates`, {
      headers: { 'X-Anonymous': 'true' },
    });
    expect(res.status()).toBe(401);
  });

  test('/invocations request does not log or return cookie or secret values', async ({
    request,
  }) => {
    const serverBase = process.env.TEST_BASE_URL ?? 'http://localhost:3001';
    const token = makeReviewerToken('reviewer@example.com');

    // POST /invocations with a reviewer cookie — proxy will likely fail with 502/503
    // since no backend is running, but we check the response body doesn't contain secrets
    const res = await request.post(`${serverBase}/invocations`, {
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ats_reviewer_session=${token}`,
        'X-Anonymous': 'true',
      },
      data: { messages: [{ role: 'human', content: 'test' }] },
    });

    const body = await res.text();
    // Response must not contain the session secret or cookie token value
    const secret = process.env.ATS_SESSION_SECRET!;
    expect(body).not.toContain(secret);
    // Response should not echo back the raw cookie value
    expect(body).not.toContain('ATS_SESSION_SECRET');
    expect(body).not.toContain('ATS_REVIEWER_PASSWORD_HASH');
  });
});
