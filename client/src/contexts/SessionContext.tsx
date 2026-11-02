import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { ClientSession } from '@chat-template/auth';

interface SessionContextType {
  session: ClientSession | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const initialFetchDone = useRef(false);

  const fetchSession = useCallback(async (showLoading = false) => {
    try {
      if (showLoading || !initialFetchDone.current) {
        setLoading(true);
      }
      setError(null);
      const response = await apiFetch('/api/session');

      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const data = (await response.json()) as ClientSession;
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setSession(null);
    } finally {
      initialFetchDone.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on application boot
    fetchSession(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setLoading(false);
        return;
      }

      // On TOKEN_REFRESHED, USER_UPDATED, or re-focus, silently revalidate
      // without setting loading: true to prevent unmounting child pages.
      fetchSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchSession]);

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        error,
        refetch: async () => fetchSession(false),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
