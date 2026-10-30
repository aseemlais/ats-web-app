/**
 * Server-side Supabase Auth Verification Module
 *
 * Verifies Supabase Auth JWT access tokens received in the Authorization: Bearer <token>
 * header using Supabase Auth's getUser(accessToken) API.
 *
 * Confirms:
 * 1. The token is cryptographically valid and unexpired.
 * 2. The user's email has been verified (email_confirmed_at).
 * 3. Enforces that a corresponding ReviewerProfile exists in ai_chatbot."ReviewerProfile".
 *    Accounts without a profile are rejected safely.
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AuthSession } from '@chat-template/auth';

let _supabaseServerClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (_supabaseServerClient) return _supabaseServerClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key if available for administrative/profile reads, otherwise anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_KEY ||
              process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  _supabaseServerClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseServerClient;
}

export function setMockSupabaseServerClient(client: SupabaseClient | null): void {
  _supabaseServerClient = client;
}

export interface VerifiedReviewer {
  id: string;
  email: string;
  name: string;
  role: string;
  emailConfirmed: boolean;
}

/**
 * Verifies a Supabase access token extracted from the Authorization: Bearer <token> header.
 * Rejects unconfirmed emails and accounts without a valid ReviewerProfile.
 */
export async function verifySupabaseToken(
  token: string,
): Promise<AuthSession | null> {
  if (!token || typeof token !== 'string') return null;

  const client = getSupabaseServerClient();
  if (!client) {
    // Supabase server client not configured in environment
    return null;
  }

  try {
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // Email verification check:
    // If confirmation is required, email_confirmed_at must be populated
    const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);

    // If confirmation is not yet completed, reject access
    if (!isEmailConfirmed) {
      return null;
    }

    // Strict Profile Verification:
    // User must have an active ReviewerProfile row in ai_chatbot."ReviewerProfile"
    let profile: { role?: string; name?: string; id?: string } | null = null;
    try {
      const { data, error: profileErr } = await client
        .schema('ai_chatbot')
        .from('ReviewerProfile')
        .select('id, role, name')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('[verifySupabaseToken] Profile lookup query failed:', profileErr.message);
      } else {
        profile = data;
      }
    } catch (profileLookupErr) {
      console.warn('[verifySupabaseToken] Exception reading ReviewerProfile:', profileLookupErr);
    }

    // If the database has ReviewerProfile table, require the profile to exist.
    // If not found, reject access safely (no orphaned auth.users access).
    if (!profile) {
      console.warn(`[verifySupabaseToken] Access denied: No ReviewerProfile found for user ${user.id}`);
      return null;
    }

    const email = user.email || '';
    const fullName =
      profile.name ||
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      email.split('@')[0] ||
      'Reviewer';

    const session: AuthSession = {
      user: {
        id: user.id,
        email,
        name: fullName,
        preferredUsername: fullName,
        type: 'regular',
      },
    };

    return session;
  } catch (err) {
    console.error('[verifySupabaseToken] Unexpected error during token verification:', err);
    return null;
  }
}
