import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DataPatternLogo } from '../components/DataPatternLogo';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTokenValidating, setIsTokenValidating] = useState(true);
  const [isRecoverySessionReady, setIsRecoverySessionReady] = useState(false);
  const [hasInvalidTokenError, setHasInvalidTokenError] = useState(false);

  // Prevent duplicate PKCE code exchanges
  const codeExchangeAttempted = useRef(false);

  useEffect(() => {
    let mounted = true;

    // 1. Inspect URL search and hash parameters
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const error = searchParams.get('error') || hashParams.get('error');
    const errorCode = searchParams.get('error_code') || hashParams.get('error_code');
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');

    // Handle error flags (e.g. otp_expired)
    if (error || errorCode) {
      if (
        errorCode === 'otp_expired' ||
        error === 'access_denied' ||
        (errorDescription && errorDescription.toLowerCase().includes('expired'))
      ) {
        setErrorMessage(
          'Your password reset link is invalid or has expired. Please request a new one.',
        );
      } else {
        setErrorMessage(
          errorDescription
            ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
            : 'Unable to verify reset link. Please request a new password reset.',
        );
      }
      setHasInvalidTokenError(true);
      setIsTokenValidating(false);
      return;
    }

    // 2. Listen for Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsRecoverySessionReady(true);
        setIsTokenValidating(false);
        setErrorMessage(null);
        setHasInvalidTokenError(false);
      }
    });

    // 3. Process recovery callback: handle PKCE code exchange or token session
    const initRecovery = async () => {
      try {
        const code = searchParams.get('code') || hashParams.get('code');

        // PKCE Flow: Exchange code for session if present
        if (code && !codeExchangeAttempted.current) {
          codeExchangeAttempted.current = true;
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          // Strip sensitive code from address bar once processed
          try {
            window.history.replaceState(null, '', window.location.pathname);
          } catch {
            // Ignore history errors
          }

          if (exchangeError) {
            if (!mounted) return;
            setErrorMessage('Your password reset link is invalid or has expired. Please request a new one.');
            setHasInvalidTokenError(true);
            setIsTokenValidating(false);
            return;
          }

          if (data?.session) {
            if (!mounted) return;
            setIsRecoverySessionReady(true);
            setIsTokenValidating(false);
            setErrorMessage(null);
            return;
          }
        }

        // Token-based / existing session check
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const isRecoveryType =
          searchParams.get('type') === 'recovery' ||
          hashParams.get('type') === 'recovery';
        const hasAccessToken =
          Boolean(searchParams.get('access_token')) ||
          Boolean(hashParams.get('access_token'));

        if (session || isRecoveryType || hasAccessToken) {
          // Clean hash tokens from address bar to avoid history leaks
          if (window.location.hash) {
            try {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch {
              // Ignore history errors
            }
          }
          setIsRecoverySessionReady(true);
          setIsTokenValidating(false);
        } else {
          // If no session exists after checking
          setTimeout(() => {
            if (mounted && !isRecoverySessionReady) {
              setIsTokenValidating(false);
            }
          }, 800);
        }
      } catch (err) {
        if (mounted) {
          console.warn('[ResetPassword] Recovery initialization error:', err);
          setIsTokenValidating(false);
        }
      }
    };

    initRecovery();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isRecoverySessionReady) {
      setErrorMessage('No active password reset session found. Please use the reset link sent to your email.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMessage(error.message || 'Failed to update password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('Password reset successfully! Redirecting you to sign in...');

      // Safe cleanup: invalidate the recovery session now that password has updated
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signout cleanup errors
      }

      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while resetting your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center flex flex-col items-center">
        <DataPatternLogo
          className="h-10 w-auto select-none object-contain mb-4"
          alt="DataPattern - Ensure Transformation"
        />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Reset your password
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter a new secure password for your DataPattern account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {isTokenValidating ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm">Verifying reset credentials...</p>
            </div>
          ) : hasInvalidTokenError ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                <div>
                  <p className="font-semibold text-red-800">Invalid or Expired Link</p>
                  <p className="mt-1">{errorMessage}</p>
                </div>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  to="/login"
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : !isRecoverySessionReady ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-900">Session Required</p>
                  <p className="mt-1">
                    No active password reset session was found. If you need to reset your password, please request a reset link from the sign in page.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : successMessage ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Success</p>
                  <p className="mt-1">{successMessage}</p>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition"
                >
                  Sign In Now
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* New Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  New Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="block w-full pl-10 pr-10 py-2.5 sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="block w-full pl-10 pr-10 py-2.5 sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !isRecoverySessionReady}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
