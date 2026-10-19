import {
  Router,
  type Request,
  type Response,
  type Router as RouterType,
} from 'express';
import { authMiddleware } from '../middleware/auth';
import type { ClientSession } from '@chat-template/auth';

export const sessionRouter: RouterType = Router();

// Apply auth middleware
sessionRouter.use(authMiddleware);

/**
 * GET /api/session - Get current user session
 */
sessionRouter.get('/', async (req: Request, res: Response) => {
  const session = req.session;

  const defaultUser = {
    email: process.env.DEFAULT_USER_EMAIL || 'recruiter@ats-workspace.com',
    name: process.env.DEFAULT_USER_NAME || 'ATS Recruiter',
    preferredUsername: process.env.DEFAULT_USER_NAME || 'ATS Recruiter',
  };

  const clientSession: ClientSession = {
    user: session?.user
      ? {
          email: session.user.email,
          name: session.user.name,
          preferredUsername: session.user.preferredUsername,
        }
      : defaultUser,
  };

  res.json(clientSession);
});
