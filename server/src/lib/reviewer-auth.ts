/**
 * Reviewer authentication helpers for Render deployment.
 *
 * Uses HMAC-signed cookies (Node built-in crypto) — no session store
 * required. The cookie contains a JSON payload signed with
 * ATS_SESSION_SECRET; the server verifies the signature on every request.
 *
 * Environment variables (server-side only):
 *   ATS_SESSION_SECRET   — strong random secret (required)
 *   ATS_REVIEWER_EMAIL   — reviewer email / username
 *   ATS_REVIEWER_PASSWORD_HASH — bcrypt hash of the reviewer password
 *
 * Cookie:
 *   Name:     ats_reviewer_session
 *   Flags:    HttpOnly, Secure (production), SameSite=Lax
 *   Max-Age:  8 hours
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import type { AuthSession } from '@chat-template/auth';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

export const REVIEWER_COOKIE_NAME = 'ats_reviewer_session';
const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.ATS_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'ATS_SESSION_SECRET is not set or is too short (need ≥ 32 chars).',
    );
  }
  return secret;
}

function sign(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

function createToken(email: string, issuedAt: number): string {
  const secret = getSecret();
  const payload = JSON.stringify({ email, iat: issuedAt });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = sign(encoded, secret);
  return `${encoded}.${sig}`;
}

function parseToken(
  token: string,
): { email: string; iat: number } | null {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return null;

    const encoded = token.slice(0, dot);
    const sig = token.slice(dot + 1);

    const secret = getSecret();
    const expected = sign(encoded, secret);

    // Constant-time comparison to prevent timing attacks
    if (
      expected.length !== sig.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expected, 'base64url'),
        Buffer.from(sig, 'base64url'),
      )
    ) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    );
    if (
      typeof parsed?.email !== 'string' ||
      typeof parsed?.iat !== 'number'
    ) {
      return null;
    }

    return parsed as { email: string; iat: number };
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Verify reviewer credentials from environment variables.
 * Returns true if the email + password match.
 */
export async function verifyReviewerCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const reviewerEmail = process.env.ATS_REVIEWER_EMAIL;
  const reviewerHash = process.env.ATS_REVIEWER_PASSWORD_HASH;

  if (!reviewerEmail || !reviewerHash) {
    // No reviewer credentials configured — reviewer login not available.
    return false;
  }

  const emailMatch =
    email.trim().toLowerCase() === reviewerEmail.trim().toLowerCase();
  if (!emailMatch) return false;

  return bcrypt.compare(password, reviewerHash);
}

/**
 * Issue a signed reviewer session cookie on the response.
 */
export function issueReviewerCookie(res: Response, email: string): void {
  const token = createToken(email, Date.now());
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(REVIEWER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_SECONDS * 1000, // ms
    path: '/',
  });
}

/**
 * Clear the reviewer session cookie.
 */
export function clearReviewerCookie(res: Response): void {
  res.clearCookie(REVIEWER_COOKIE_NAME, { path: '/' });
}

/**
 * Read and verify the reviewer session cookie from the request.
 * Returns an AuthSession-compatible object or null.
 *
 * Expires tokens older than COOKIE_MAX_AGE_SECONDS even if the cookie
 * itself is still present (defence-in-depth).
 */
export function verifyReviewerCookie(req: Request): AuthSession | null {
  const raw = req.cookies?.[REVIEWER_COOKIE_NAME];
  if (!raw || typeof raw !== 'string') return null;

  let parsed: { email: string; iat: number } | null;
  try {
    parsed = parseToken(raw);
  } catch {
    return null;
  }

  if (!parsed) return null;

  // Check server-side expiry
  const ageMs = Date.now() - parsed.iat;
  if (ageMs > COOKIE_MAX_AGE_SECONDS * 1000) return null;

  return {
    user: {
      email: parsed.email,
      name: parsed.email,
      preferredUsername: parsed.email,
      id: parsed.email,
    },
  } as AuthSession;
}
