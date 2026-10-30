import { supabase } from '@/lib/supabase';

/**
 * Perform an authenticated fetch request to the Node.js backend.
 * Automatically attaches the current Supabase session access token in the
 * Authorization header as `Bearer <token>`.
 *
 * If no session is active, credentials: 'include' is still passed to allow
 * fallback to cookie-based authentication (e.g. Databricks or transition HMAC).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch (err) {
    console.warn('[apiFetch] Could not retrieve Supabase session token:', err);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });
}
