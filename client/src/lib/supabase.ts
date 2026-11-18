import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!env?.VITE_SUPABASE_URL || !env?.VITE_SUPABASE_ANON_KEY) {
  if (typeof window !== 'undefined') {
    console.warn(
      '[Supabase Client] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Please set these environment variables in your client configuration.'
    );
  }
}

/**
 * Shared Supabase browser client for authentication and session management.
 * Preserves session in localStorage via standard Supabase Auth storage.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
