import { Router } from 'express';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import { eq } from 'drizzle-orm';

import { user, passwordResetToken } from '@chat-template/db';
import { getDb } from '@chat-template/db';

const router = Router();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
      });
    }

    const db = await getDb();

    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    // Do not reveal whether the email exists.
    if (!existingUser) {
      return res.json({
        message:
          'If an account exists for this email, a password reset link has been sent.',
      });
    }

    // Resend is optional. The application should still start
    // when RESEND_API_KEY is not configured.
    if (!resend) {
      console.warn(
        '[forgot-password] RESEND_API_KEY is not configured.',
      );

      return res.status(503).json({
        error: 'Password reset email service is not configured.',
      });
    }

    // Generate secure one-time token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // Token valid for 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Invalidate previous reset tokens
    await db
      .update(passwordResetToken)
      .set({
        usedAt: new Date(),
      })
      .where(eq(passwordResetToken.userId, existingUser.id));

    await db.insert(passwordResetToken).values({
      userId: existingUser.id,
      tokenHash,
      expiresAt,
    });

    const appUrl =
      process.env.APP_URL ||
      'http://localhost:3000';

    const resetUrl =
      `${appUrl}/reset-password?token=${rawToken}`;

    await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL ||
        'Resume Screening <onboarding@resend.dev>',
      to: email,
      subject: 'Reset your Resume Screening password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
          <h2>Password Reset</h2>

          <p>Hello ${existingUser.name},</p>

          <p>
            We received a request to reset your Resume Screening account password.
          </p>

          <p>
            Click the button below to create a new password.
          </p>

          <p>
            <a
              href="${resetUrl}"
              style="
                display:inline-block;
                padding:12px 20px;
                background:#0066cc;
                color:white;
                text-decoration:none;
                border-radius:6px;
              "
            >
              Reset Password
            </a>
          </p>

          <p>
            This link will expire in 30 minutes.
          </p>

          <p>
            If you did not request this, you can safely ignore this email.
          </p>

          <p>Thanks,<br/>Resume Screening Team</p>
        </div>
      `,
    });

    return res.json({
      message:
        'If an account exists for this email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('[forgot-password] Error:', error);

    return res.status(500).json({
      error: 'Unable to process password reset request',
    });
  }
});

export default router;