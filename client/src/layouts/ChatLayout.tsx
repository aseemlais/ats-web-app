import { Outlet, Navigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';

export default function ChatLayout() {
  const { session, loading } = useSession();

  // Wait for session to load
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-500 animate-pulse">
          Loading DataPattern ATS...
        </div>
      </div>
    );
  }

  // If no authenticated user session exists, redirect immediately to login
  if (!session?.user) {
    return <Navigate to="/" replace />;
  }

  // Render the Resume Screening application
  return (
    <div className="min-h-screen w-full bg-background">
      <Outlet />
    </div>
  );
}
