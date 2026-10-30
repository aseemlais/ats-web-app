import type { Request, Response, NextFunction } from 'express';
import { getAuthSession, type AuthSession } from '@chat-template/auth';
import { checkChatAccess } from '@chat-template/core';
import { ChatSDKError } from '@chat-template/core/errors';
import { verifyReviewerCookie } from '../lib/reviewer-auth';
import { verifySupabaseToken } from '../lib/supabase-auth';

// Extend Express Request type to include session
declare global {
  namespace Express {
    interface Request {
      session?: AuthSession;
    }
  }
}

/**
 * Middleware to authenticate requests and attach session to request object.
 *
 * Authentication Priority:
 *  1. Verified Databricks SSO identity (in a genuine Databricks environment)
 *  2. Verified Supabase Auth token (Authorization: Bearer <token>)
 *  3. Reviewer HMAC-signed session cookie (legacy migration fallback)
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    // 1. Check Databricks SSO (takes precedence in Databricks Apps or CLI auth)
    const databricksSession = await getAuthSession({
      getRequestHeader: (name: string) =>
        req.headers[name.toLowerCase()] as string | null,
    });

    if (databricksSession) {
      req.session = databricksSession;
      return next();
    }

    // 2. Check Supabase Auth access token in Authorization: Bearer <token>
    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const supabaseSession = await verifySupabaseToken(token);
      if (supabaseSession) {
        req.session = supabaseSession;
        return next();
      }
    }

    // 3. Fallback: reviewer session cookie (for smooth transition during migration)
    const reviewerSession = verifyReviewerCookie(req);
    req.session = reviewerSession ?? undefined;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    next(error);
  }
}

/**
 * Middleware to require authentication - returns 401 if no session
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    const response = new ChatSDKError('unauthorized:chat').toResponse();
    return res.status(response.status).json(response.json);
  }
  next();
}

export async function requireChatAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = getIdFromRequest(req);
  if (!id) {
    console.error(
      'Chat access middleware error: no chat ID provided',
      req.params,
    );
    const error = new ChatSDKError('bad_request:api');
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }
  const { allowed, reason } = await checkChatAccess(id, req.session?.user.id);
  if (!allowed) {
    console.error(
      'Chat access middleware error: user does not have access to chat',
      reason,
    );
    const error = new ChatSDKError('forbidden:chat', reason);
    const response = error.toResponse();
    return res.status(response.status).json(response.json);
  }
  next();
}

export const getIdFromRequest = (req: Request): string | undefined => {
  const { id } = req.params;
  if (!id) return undefined;
  return typeof id === 'string' ? id : id[0];
};
