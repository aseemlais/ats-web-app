import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase Client] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Please set these environment variables in your client configuration.'
  );
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
