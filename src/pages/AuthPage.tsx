import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { AuthUser, useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { isFirebaseConfigured } from "@/lib/firebase";

type AuthMode = "login" | "signup";

type BackendAuthResponse = {
  user?: AuthUser;
  accessToken: string;
  refreshToken: string;
  otp?: string;
  message?: string;
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, login } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Email/password form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP verification state
  const [otp, setOtp] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState("");
  const [showOtpForm, setShowOtpForm] = useState(false);

  // Forgot password state
  const [authView, setAuthView] = useState<"main" | "forgot" | "reset">("main");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      const redirect = searchParams.get("redirect") || "/dashboard";
      navigate(redirect, { replace: true });
    }
  }, [user, authLoading, navigate, searchParams]);

  // Check for OAuth error redirect from backend
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const codeParam = searchParams.get("code");
    if (errorParam) {
      setError(`OAuth error: ${decodeURIComponent(errorParam)}`);
    } else if (codeParam) {
      setError(`OAuth error: ${decodeURIComponent(codeParam)}`);
    }
  }, [searchParams]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "✔" : type === "error" ? "✖" : "ℹ";
    toast.innerHTML = `<span style="flex-shrink:0;font-weight:700;font-size:1.1rem">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  // ── Forgot Password Handlers ──

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await api.post("/api/auth/forgot-password", {
        email: forgotEmail.trim().toLowerCase(),
      });
      showToast("If an account exists, a reset code has been sent.", "success");
      setAuthView("reset");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || "Failed to send reset code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetOtp.trim() || resetOtp.trim().length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    if (!newPassword.trim()) {
      setError("Please enter a new password.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await api.post("/api/auth/reset-password", {
        email: forgotEmail.trim().toLowerCase(),
        otp: resetOtp.trim(),
        newPassword,
      });
      showToast("Password reset successful! Please sign in.", "success");
      setAuthView("main");
      setForgotEmail("");
      setResetOtp("");
      setNewPassword("");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || "Password reset failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Email/Password Handlers ──

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      if (mode === "signup") {
        const payload = await api.post<BackendAuthResponse>("/api/auth/signup", {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
        // Store credentials but don't call login() yet — wait for OTP verification
        setPendingVerificationEmail(email.trim().toLowerCase());
        setPendingVerificationPassword(password);
        setShowOtpForm(true);
        showToast("Account created! Please enter the verification code.", "success");
      } else {
        const payload = await api.post<BackendAuthResponse>("/api/auth/login", {
          email: email.trim().toLowerCase(),
          password,
        });
        login({ accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, user: payload.data.user! });
        showToast("Signed in successfully!", "success");
        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; code?: string } } };
      const message = axiosErr?.response?.data?.message || "Authentication failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await api.post("/api/auth/verify-otp", {
        email: pendingVerificationEmail,
        otp: otp.trim(),
      });
      showToast("Email verified successfully!", "success");
      setShowOtpForm(false);
      setPendingVerificationEmail("");
      setOtp("");
      // Now that OTP is verified, log the user in
      const loginPayload = await api.post<BackendAuthResponse>("/api/auth/login", {
        email: pendingVerificationEmail,
        password: pendingVerificationPassword,
      });
      login({ accessToken: loginPayload.data.accessToken, refreshToken: loginPayload.data.refreshToken, user: loginPayload.data.user! });
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Google Handler ──

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(firebaseAuth!, provider);
      const idToken = await result.user.getIdToken();

      const payload = await api.post<BackendAuthResponse>("/api/auth/google", {
        credential: idToken,
      });

      login({ accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, user: payload.data.user! });
      showToast("Signed in with Google successfully", "success");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const error = err as { code?: string } | undefined;
      const fbCode = error?.code || "";
      const googleError = error as { code?: string; message?: string; error?: { code?: number; message?: string } } | undefined;

      const message = fbCode === "auth/popup-closed-by-user"
        ? "Sign-in cancelled"
        : fbCode === "auth/popup-blocked"
          ? "Pop-up was blocked by your browser. Please allow pop-ups and try again."
          : fbCode === "auth/unauthorized-domain"
            ? `This domain (${window.location.origin}) is not authorized for Google sign-in. Add it to the Authorized JavaScript Origins in Google Cloud Console > APIs & Services > Credentials.`
            : fbCode === "auth/operation-not-supported-in-this-environment"
              ? "Google sign-in is not supported in this browser environment. Try a different browser."
              : fbCode === "auth/cancelled-popup-request"
                ? "Another sign-in request is already open. Please close all pop-ups and try again."
                : fbCode === "auth/credential-already-in-use"
                  ? "This Google account is already linked to another account."
                  : fbCode === "auth/account-exists-with-different-credential"
                    ? "An account with this email already exists using a different sign-in method."
                    : fbCode === "auth/access-denied" || fbCode === "Access blocked" || (googleError?.message || "").includes("Access blocked")
                      ? "Access Blocked: Your Google account or this app is not authorized. Ensure the OAuth consent screen is published or your email is added as a test user in Google Cloud Console > APIs & Services > OAuth consent screen."
                      : "Google sign-in failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Brand Header (reused across views) ──
  const BrandHeader = () => (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7b2ff7] flex items-center justify-center text-[#0a0a0f] font-bold text-lg shadow-lg shadow-[#00d4ff]/20">
          Z
        </div>
        <span className="text-2xl font-bold" style={{ color: "var(--theme-text)" }}>
          ZeroDay <span style={{ color: "var(--theme-accent-blue)" }}>Guardian</span>
        </span>
      </div>
    </div>
  );

  // ── Forgot Password Screen (email entry) ──
  if (authView === "forgot") {
    return (
      <div className="auth-screen relative min-h-screen flex items-center justify-center p-4">
        <div className="auth-grid-bg" aria-hidden="true" />
        <div className="w-full max-w-md animate-fade-in-up">
          <BrandHeader />
          <div className="auth-card p-6 md:p-12">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#7b2ff7]/10 border border-[#7b2ff7]/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" style={{ color: "var(--theme-accent-blue)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--theme-text)" }}>Forgot Password?</h2>
              <p className="text-sm mt-2" style={{ color: "var(--theme-text-muted)" }}>
                Enter your email and we'll send you a reset code.
              </p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                  }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || !forgotEmail.trim()}
                className="w-full px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #7b2ff7)",
                  color: "#0a0a0f",
                }}
              >
                {isLoading ? <div className="spinner-cyber" /> : "Send Reset Code"}
              </button>
              <button
                type="button"
                onClick={() => { setAuthView("main"); setError(null); setForgotEmail(""); }}
                className="w-full text-sm py-2"
                style={{ color: "var(--theme-accent-blue)" }}
              >
                Back to sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset Password Screen (OTP + new password) ──
  if (authView === "reset") {
    return (
      <div className="auth-screen relative min-h-screen flex items-center justify-center p-4">
        <div className="auth-grid-bg" aria-hidden="true" />
        <div className="w-full max-w-md animate-fade-in-up">
          <BrandHeader />
          <div className="auth-card p-6 md:p-12">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#7b2ff7]/10 border border-[#7b2ff7]/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" style={{ color: "var(--theme-accent-blue)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold" style={{ color: "var(--theme-text)" }}>Reset Password</h2>
              <p className="text-sm mt-2" style={{ color: "var(--theme-text-muted)" }}>
                Enter the 6-digit code sent to <strong>{forgotEmail}</strong> and your new password.
              </p>
            </div>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="reset-otp" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                  Verification Code
                </label>
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={resetOtp}
                  onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-lg text-center text-lg tracking-[0.5em] font-mono transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 pr-12 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--color-bg-secondary)",
                      color: "var(--color-text-primary)",
                      border: "1px solid var(--color-border)",
                    }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: "var(--theme-text-muted)" }}
                    tabIndex={-1}
                  >
                    {showNewPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || resetOtp.length !== 6 || !newPassword.trim()}
                className="w-full px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #7b2ff7)",
                  color: "#0a0a0f",
                }}
              >
                {isLoading ? <div className="spinner-cyber" /> : "Reset Password"}
              </button>
              <button
                type="button"
                onClick={() => { setAuthView("forgot"); setError(null); setResetOtp(""); setNewPassword(""); }}
                className="w-full text-sm py-2"
                style={{ color: "var(--theme-accent-blue)" }}
              >
                Back to email entry
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── OTP Verification Screen ──

  if (showOtpForm) {
    return (
      <div className="auth-screen relative min-h-screen flex items-center justify-center p-4">
        <div className="auth-grid-bg" aria-hidden="true" />
        <div className="w-full max-w-md animate-fade-in-up">
          <BrandHeader />
          <div className="text-center mb-4">
            <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
              Verify your email
            </p>
          </div>
          <div className="auth-card p-6 md:p-12">
            <form onSubmit={handleOtpVerify} className="space-y-4">
              <p className="text-sm text-center" style={{ color: "var(--theme-text-muted)" }}>
                A 6-digit code was sent to <strong>{pendingVerificationEmail}</strong>. Enter it below to verify your account.
              </p>
              <div>
                <label htmlFor="otp" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-lg text-center text-lg tracking-[0.5em] font-mono transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                  }}
                  autoFocus
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #00d4ff, #7b2ff7)",
                  color: "#0a0a0f",
                }}
              >
                {isLoading ? <div className="spinner-cyber" /> : "Verify Email"}
              </button>
              <button
                type="button"
                onClick={() => { setShowOtpForm(false); setError(null); setOtp(""); }}
                className="w-full text-sm py-2"
                style={{ color: "var(--theme-accent-blue)" }}
              >
                Back to sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // If Firebase is not configured (missing env vars), show a configuration error
  if (!isFirebaseConfigured) {
    return (
      <div className="auth-screen relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center animate-fade-in-up">
          <div className="auth-card p-8">
            <div className="text-red-400 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--theme-text)" }}>Authentication Unavailable</h2>
            <p className="text-sm mb-4" style={{ color: "var(--theme-text-muted)" }}>
              Authentication service is not configured. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If Firebase is configured but not yet initialized, show loading
  if (!firebaseAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--theme-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="spinner-cyber spinner-lg" />
          <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
            Initializing secure connection...
          </p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--theme-bg)" }}>
        <div className="spinner-cyber spinner-lg" />
      </div>
    );
  }

  return (
    <div className="auth-screen relative min-h-screen flex items-center justify-center p-4">
      <div className="auth-grid-bg" aria-hidden="true" />

      <div className="w-full max-w-md animate-fade-in-up">
        {/* Brand Header */}
        <BrandHeader />
        <p className="text-sm text-center mb-8" style={{ color: "var(--theme-text-muted)" }}>
          Master Cybersecurity with AI
        </p>

        {/* Auth Card */}
        <div className="auth-card p-6 md:p-12">
          {/* Mode Toggle */}
          <div className="flex rounded-lg p-1 mb-6" style={{ backgroundColor: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                mode === "login" ? "shadow-sm" : ""
              }`}
              style={{
                backgroundColor: mode === "login" ? "var(--theme-bg)" : "transparent",
                color: mode === "login" ? "var(--theme-text)" : "var(--theme-text-muted)",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                mode === "signup" ? "shadow-sm" : ""
              }`}
              style={{
                backgroundColor: mode === "signup" ? "var(--theme-bg)" : "transparent",
                color: mode === "signup" ? "var(--theme-text)" : "var(--theme-text-muted)",
              }}
            >
              Sign Up
            </button>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                  }}
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                style={{
                  backgroundColor: "var(--color-bg-secondary)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border)",
                }}
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Min 6 characters" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 pr-12 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--color-bg-secondary)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border)",
                  }}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: "var(--theme-text-muted)" }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password Link (login mode only) */}
            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setAuthView("forgot"); setError(null); setForgotEmail(email); }}
                  className="text-xs font-medium hover:underline transition-colors"
                  style={{ color: "var(--theme-accent-blue)" }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm animate-fade-in" role="status">
                {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-8 py-3 rounded-lg text-base font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #7b2ff7)",
                color: "#0a0a0f",
              }}
            >
              {isLoading ? <div className="spinner-cyber" /> : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
            <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>OR</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-border)" }} />
          </div>

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-8 py-3.5 rounded-lg text-base font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 1px 3px var(--color-shadow)'
            }}
          >
            {isLoading ? (
              <div className="spinner-cyber" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>
            Secure • Private • Encrypted
          </p>
          <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>
            © 2025 ZeroDay Guardian • Secure Login
          </p>
        </div>
      </div>
    </div>
  );
}
