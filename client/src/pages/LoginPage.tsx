import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
type AuthView = "login" | "create" | "forgot";

type RegisteredUser = {
  name: string;
  email: string;
  password: string;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        <path d="m4 4 16 16" />
      </svg>
    );
  }

  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage
// removed mock local storage

export default function LoginPage() {
  const navigate = useNavigate();

  const [view, setView] = useState<AuthView>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccessMessage("");
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // On mount, check if a Supabase session or legacy reviewer session exists
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const isConfirmed = Boolean(session.user.email_confirmed_at || session.user.confirmed_at);
        if (isConfirmed) {
          navigate('/screening');
          return;
        }
      }

      // Check legacy session endpoint
      fetch('/api/auth/me', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user?.email) {
            navigate('/screening');
          }
        })
        .catch(() => {});
    });
  }, [navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();

    const enteredEmail = email.trim().toLowerCase();

    if (!enteredEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      // 1. Try Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: enteredEmail,
        password,
      });

      if (!signInError && data?.user) {
        const isConfirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
        if (!isConfirmed) {
          await supabase.auth.signOut().catch(() => {});
          setError('Please verify your email address before accessing the ATS. Check your inbox for the confirmation link.');
          return;
        }
        navigate('/screening');
        return;
      }

      // 2. Fallback to server-side reviewer credentials (during transition)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: enteredEmail, password }),
      });

      if (res.ok) {
        navigate('/screening');
        return;
      }

      // Provide generic error message without revealing user existence
      if (signInError?.message?.toLowerCase().includes('email not confirmed')) {
        setError('Please verify your email address before accessing the ATS. Check your inbox for the confirmation link.');
      } else {
        setError('Invalid email or password.');
      }
    } catch {
      setError('Unable to connect to the authentication service. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setError('Please complete all fields.');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Password strength check
    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsRegistering(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
            // role is explicitly defaulted to reviewer server-side/trigger
          },
        },
      });

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Please sign in.');
        } else {
          setError(signUpError.message || 'Unable to register account. Please try again.');
        }
        return;
      }

      if (data?.user) {
        const isConfirmed = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);
        if (isConfirmed) {
          setSuccessMessage('Account created and verified successfully. You can now sign in.');
        } else {
          setSuccessMessage('Registration successful! Please check your email inbox to verify your account before signing in.');
        }
        setPassword('');
        setConfirmPassword('');
      }
    } catch {
      setError('Unable to connect to the registration service. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleForgotPassword = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    clearMessages();

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }

    try {
      const response = await fetch(
        "/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "Unable to process your password reset request.",
        );
        return;
      }

      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent.",
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error,
      );

      setError(
        "Unable to connect to the server. Please try again.",
      );
    }
  };

  const goToLogin = () => {
    clearMessages();
    setView("login");
    setPassword("");
    setConfirmPassword("");
  };

  const goToCreateAccount = () => {
    clearMessages();
    setView("create");
    setPassword("");
    setConfirmPassword("");
  };

  const goToForgotPassword = () => {
    clearMessages();
    setView("forgot");
    setPassword("");
    setConfirmPassword("");
  };

  const registeredUsers = getRegisteredUsers();

  const isReturningUser =
    email.trim() !== "" &&
    registeredUsers.some(
      (user) =>
        user.email.toLowerCase() ===
        email.trim().toLowerCase(),
    );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 relative overflow-hidden">

      {/* Background Animation */}
      <style>{`
        @keyframes floatBlue {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(25px, -20px, 0) scale(1.05);
          }
        }

        @keyframes floatIndigo {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(-30px, 20px, 0) scale(1.08);
          }
        }

        @keyframes softPulse {
          0%, 100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.55;
          }
        }

        .login-bg-blue {
          animation: floatBlue 12s ease-in-out infinite;
        }

        .login-bg-indigo {
          animation: floatIndigo 15s ease-in-out infinite;
        }

        .login-bg-pulse {
          animation: softPulse 8s ease-in-out infinite;
        }
      `}</style>

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">

        <div
          className="login-bg-blue absolute -top-48 -right-40 w-[620px] h-[620px] rounded-full blur-3xl bg-blue-300/30"
        />

        <div
          className="login-bg-indigo absolute -bottom-56 -left-40 w-[620px] h-[620px] rounded-full blur-3xl bg-indigo-300/25"
        />

        <div
          className="login-bg-pulse absolute top-[35%] left-[38%] w-[360px] h-[360px] rounded-full blur-3xl bg-sky-200/20"
        />

        <div className="absolute inset-0 opacity-[0.035]">
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>
      </div>

      {/* DataPattern Header */}
      <header className="relative z-10 px-7 sm:px-8 py-5 sm:py-6">

        <div className="flex items-center gap-3">

          <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-sm tracking-tight">
              DP
            </span>
          </div>

          <div>
            <div className="text-lg font-bold tracking-tight text-slate-950">
              DataPattern
            </div>

            <div className="text-xs text-slate-500">
              AI-powered screening platform
            </div>
          </div>

        </div>

      </header>

      {/* Main */}
      <main className="relative z-10 min-h-[calc(100vh-88px)] flex items-start justify-center px-6 pb-12 pt-6">

        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 lg:gap-20 items-start">

          {/* LEFT SIDE — DO NOT CHANGE */}
          <section className="hidden lg:block">

            <div className="max-w-xl">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-slate-200 shadow-sm mb-6">

                <span className="w-2 h-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-medium text-slate-600">
                  AI-powered candidate screening
                </span>

              </div>

              {/* Heading */}
              <h1 className="text-5xl font-bold tracking-tight leading-[1.08] text-slate-950">

                Find the right
                <br />

                <span className="text-blue-600">
                  talent, faster.
                </span>

              </h1>

              {/* Description */}
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-lg">
                Screen resumes, compare candidates against
                job requirements, identify the strongest
                matches, and streamline your shortlisting
                process with an intelligent screening workflow.
              </p>

              {/* Feature Cards */}
              <div className="mt-10 grid grid-cols-2 gap-4">

                <div className="rounded-2xl bg-white/80 border border-slate-200 p-5 shadow-sm">

                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-4">

                    <span className="text-blue-600 font-bold text-sm">
                      AI
                    </span>

                  </div>

                  <div className="font-semibold text-slate-900">
                    Intelligent Matching
                  </div>

                  <div className="text-sm text-slate-500 mt-1 leading-5">
                    Compare candidate profiles with role
                    requirements.
                  </div>

                </div>

                <div className="rounded-2xl bg-white/80 border border-slate-200 p-5 shadow-sm">

                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">

                    <span className="text-emerald-600 font-bold">
                      ✓
                    </span>

                  </div>

                  <div className="font-semibold text-slate-900">
                    Faster Shortlisting
                  </div>

                  <div className="text-sm text-slate-500 mt-1 leading-5">
                    Rank candidates and focus on the strongest
                    fits.
                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* RIGHT AUTHENTICATION BOX */}
          <section className="w-full max-w-md mx-auto lg:ml-auto">

            <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-2xl shadow-slate-900/10 p-8 sm:p-9">

              {/* Header */}
              <div className="mb-7">

                <div className="text-sm font-semibold text-blue-600 mb-2">
                  AI SCREENING PLATFORM
                </div>

                {view === "login" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-950">
                      {isReturningUser
                        ? "Welcome back"
                        : "Welcome"}
                    </h2>

                    <p className="text-sm text-slate-500 mt-2">
                      Sign in to continue to your screening
                      workspace.
                    </p>
                  </>
                )}

                {view === "create" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-950">
                      Create your account
                    </h2>

                    <p className="text-sm text-slate-500 mt-2">
                      Set up your account to access the
                      screening platform.
                    </p>
                  </>
                )}

                {view === "forgot" && (
                  <>
                    <h2 className="text-2xl font-bold text-slate-950">
                      Forgot your password?
                    </h2>
                  </>
                )}

              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Success */}
              {successMessage && (
                <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">

                  <div className="flex items-center gap-2">

                    <span className="font-semibold">
                      ✓
                    </span>

                    <span>
                      {successMessage}
                    </span>

                  </div>

                </div>
              )}

              {/* LOGIN */}
              {view === "login" && (
                <form
                  onSubmit={handleLogin}
                  className="space-y-5"
                >

                  {/* Email */}
                  <div>

                    <label
                      htmlFor="login-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email
                    </label>

                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      autoComplete="username"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your email"
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Password */}
                  <div>

                    <div className="flex items-center justify-between mb-2">

                      <label
                        htmlFor="login-password"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={goToForgotPassword}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Forgot password?
                      </button>

                    </div>

                    <div className="relative">

                      <input
                        id="login-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        autoComplete="current-password"
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setError("");
                          setSuccessMessage("");
                        }}
                        placeholder="Enter your password"
                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <EyeIcon open={showPassword} />
                      </button>

                    </div>

                  </div>

                  {/* Remember Me */}
                  <div>

                    <label className="flex items-center gap-2 cursor-pointer">

                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) =>
                          setRememberMe(
                            event.target.checked,
                          )
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      <span className="text-sm text-slate-600">
                        Remember me
                      </span>

                    </label>

                  </div>

                  {/* Sign In */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 transition cursor-pointer"
                  >
                    Sign In
                  </button>

                  {/* Create Account */}
                  <div className="text-center pt-2">

                    <span className="text-sm text-slate-500">
                      Don't have an account?{" "}
                    </span>

                    <button
                      type="button"
                      onClick={goToCreateAccount}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Create account
                    </button>

                  </div>

                </form>
              )}

              {/* CREATE ACCOUNT */}
              {view === "create" && (
                <form
                  onSubmit={handleCreateAccount}
                  className="space-y-4"
                >

                  {/* Name */}
                  <div>

                    <label
                      htmlFor="create-name"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Full name
                    </label>

                    <input
                      id="create-name"
                      type="text"
                      value={name}
                      autoComplete="name"
                      onChange={(event) => {
                        setName(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your full name"
                      className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Email */}
                  <div>

                    <label
                      htmlFor="create-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email
                    </label>

                    <input
                      id="create-email"
                      type="email"
                      value={email}
                      autoComplete="email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your email"
                      className="w-full h-12 rounded-xl border border-slate-300 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Password */}
                  <div>

                    <label
                      htmlFor="create-password"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Password
                    </label>

                    <div className="relative">

                      <input
                        id="create-password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={password}
                        autoComplete="new-password"
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setError("");
                          setSuccessMessage("");
                        }}
                        placeholder="Create a password"
                        className="w-full h-12 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <EyeIcon open={showPassword} />
                      </button>

                    </div>

                  </div>

                  {/* Confirm Password */}
                  <div>

                    <label
                      htmlFor="confirm-password"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Confirm password
                    </label>

                    <div className="relative">

                      <input
                        id="confirm-password"
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={confirmPassword}
                        autoComplete="new-password"
                        onChange={(event) => {
                          setConfirmPassword(
                            event.target.value,
                          );
                          setError("");
                          setSuccessMessage("");
                        }}
                        placeholder="Confirm your password"
                        className="w-full h-12 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword,
                          )
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <EyeIcon
                          open={showConfirmPassword}
                        />
                      </button>

                    </div>

                  </div>

                  {/* Create Account */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 transition cursor-pointer mt-2"
                  >
                    Create Account
                  </button>

                  {/* Sign In */}
                  <div className="text-center pt-2">

                    <span className="text-sm text-slate-500">
                      Already have an account?{" "}
                    </span>

                    <button
                      type="button"
                      onClick={goToLogin}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Sign in
                    </button>

                  </div>

                </form>
              )}

              {/* FORGOT PASSWORD */}
              {view === "forgot" && (
                <form
                  onSubmit={handleForgotPassword}
                  className="space-y-5"
                >

                  <div>

                    <label
                      htmlFor="forgot-email"
                      className="block text-sm font-medium text-slate-700 mb-2"
                    >
                      Email
                    </label>

                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      autoComplete="email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setError("");
                        setSuccessMessage("");
                      }}
                      placeholder="Enter your email"
                      className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                  {/* Reset Button */}
                  <button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:bg-blue-800 transition cursor-pointer"
                  >
                    Send Reset Link
                  </button>

                  {/* Back */}
                  <div className="text-center">

                    <button
                      type="button"
                      onClick={goToLogin}
                      className="text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      ← Back to Sign in
                    </button>

                  </div>

                </form>
              )}

              {/* Footer */}
              <div className="mt-8 pt-5 border-t border-slate-100">

                <div className="flex items-center justify-center gap-2">

                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />

                  <p className="text-xs text-slate-400">
                    Secure and intelligent candidate screening
                  </p>

                </div>

              </div>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}
