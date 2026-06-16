import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import GlassCard from "@/components/ui/GlassCard";
import { AuthUser, useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import PasswordInput from "@/components/ui/PasswordInput";

type AuthMode = "login" | "register" | "reset" | "reset-otp";

type BackendAuthResponse = {
  user?: AuthUser;
  accessToken: string;
  refreshToken: string;
};

const getDisplayNameFromEmail = (value: string) => {
  const name = value.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return name && name.length >= 2 ? name : "Guardian";
};

const getPasswordValidationError = (value: string) => {
  if (value.length < 10) return "Password must be at least 10 characters";
  if (!/[a-z]/.test(value)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(value)) return "Password must include an uppercase letter";
  if (!/\d/.test(value)) return "Password must include a number";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must include a symbol";
  return "";
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, login } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      const redirect = searchParams.get("redirect") || "/dashboard";
      navigate(redirect, { replace: true });
    }
  }, [user, authLoading, navigate, searchParams]);

  // Check for OTP redirect
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "resetPassword") setMode("reset");
  }, [searchParams]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "âœ“" : type === "error" ? "âœ•" : "â„¹";
    toast.innerHTML = `<span style="flex-shrink:0;font-weight:700;font-size:1.1rem">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
       setError(null);
       const provider = new GoogleAuthProvider();
       provider.setCustomParameters({ prompt: "select_account" });
       const result = await signInWithPopup(firebaseAuth!, provider);
       const idToken = await result.user.getIdToken();

       const payload = await api.post<BackendAuthResponse>("/api/auth/google", {
         idToken,
       });

       login({ accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, user: payload.data.user! });
       showToast("Signed in with Google successfully", "success");
       navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const error = err as { code?: string } | undefined;
      const message = error?.code === "auth/popup-closed-by-user"
        ? "Sign-in cancelled"
        : error?.code === "auth/popup-blocked"
          ? "Pop-up was blocked by your browser. Please allow pop-ups and try again."
          : error?.code === "auth/unauthorized-domain"
            ? "This domain is not authorized for sign-in. Try using email/password instead."
            : "Google sign-in failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || (mode !== "reset" && mode !== "reset-otp" && !password.trim())) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const passwordValidationError = mode === "register" ? getPasswordValidationError(password) : "";
    if (mode === "login" && password.length < 1) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "reset-otp" && !otp.trim()) {
      setError("Please enter the verification code");
      return;
    }
    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "register") {
        const payload = await api.post<BackendAuthResponse>("/api/auth/signup", {
          name: getDisplayNameFromEmail(email),
          email,
          password,
        });
        login({ accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, user: payload.data.user! });
        setSuccess("Account created. Welcome to your dashboard.");
        showToast("Account created successfully.", "success");
        navigate("/dashboard", { replace: true });
      } else if (mode === "reset") {
        // Step 1: Send OTP via backend
        const otpResult = await api.post<{ sent: boolean; delivery: string; destination?: string; expiresInMinutes?: number; otpPreview?: string }>("/api/auth/send-otp", { email });
        const delivery = otpResult.data.delivery || "email";
        setSuccess(
          delivery === "preview"
            ? `Reset OTP: ${otpResult.data.otpPreview || "(check console)"} — expires in ${otpResult.data.expiresInMinutes || 10} min`
            : `Verification code sent to ${otpResult.data.destination || email}. Check your inbox.`
        );
        showToast("Verification code sent!", "success");
        setMode("reset-otp");
      } else if (mode === "reset-otp") {
        // Step 2: Verify OTP and reset password
        if (!otp.trim()) {
          setError("Please enter the verification code");
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          return;
        }
        const passwordError = getPasswordValidationError(password);
        if (passwordError) {
          setError(passwordError);
          return;
        }
        await api.post("/api/auth/reset-password", { email, otp, password });
        setSuccess("Password reset successful! You can now sign in.");
        showToast("Password reset successful!", "success");
        setTimeout(() => { setMode("login"); setOtp(""); setPassword(""); setConfirmPassword(""); }, 2000);
      } else {
        const payload = await api.post<BackendAuthResponse>("/api/auth/login", {
          email,
          password,
          rememberMe: true,
        });
        login({ accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, user: payload.data.user! });
        showToast("Welcome back!", "success");
        navigate("/dashboard", { replace: true });
      }
    } catch (err: unknown) {
      // Extract backend error from Axios response (error.response?.data?.code)
      // vs Firebase error (error.code) vs network error (error.message)
      const axiosErr = err as { response?: { data?: { code?: string; message?: string } }; code?: string; message?: string } | undefined;
      const backendCode = axiosErr?.response?.data?.code;
      const backendMessage = axiosErr?.response?.data?.message;
      const firebaseCode = axiosErr?.code;
      const genericMessage = axiosErr?.message;

      const map: Record<string, string> = {
        // Backend error codes (from POST /api/auth/login, /api/auth/signup)
        "user_not_found": "No account with this email address",
        "wrong_password": "Incorrect email or password",
        "password_not_set": "This account uses Google sign-in. Please sign in with Google.",
        "user_exists": "An account with this email already exists",
        "mail_not_configured": "Email service is not configured on the server.",
        "mail_delivery_failed": "Failed to send email. Please try again later.",
        "invalid_otp": "Invalid verification code. Please try again.",
        "otp_expired": "Verification code has expired. Please request a new one.",
        "otp_not_requested": "Please request a verification code first.",
        "google_auth_not_configured": "Google sign-in is not configured on the backend.",
        "google_identity_invalid": "Google sign-in failed — identity could not be verified.",
        "google_email_not_verified": "Your Google email is not verified.",
        "rate_limited": "Too many attempts. Please wait and try again.",
        "db_unavailable_auth": "Authentication service is temporarily unavailable. Please retry.",
        // Firebase error codes (from Firebase Auth)
        "auth/user-not-found": "No account with this email",
        "auth/wrong-password": "Incorrect email or password",
        "auth/invalid-credential": "Invalid email or password",
        "auth/email-already-in-use": "An account with this email already exists",
        "auth/too-many-requests": "Too many attempts. Please try again later",
        "auth/invalid-email": "Invalid email address",
        "auth/operation-not-allowed": "Email/password sign-up is disabled in Firebase. Enable Email/Password in Firebase Console > Authentication > Sign-in method.",
        "auth/weak-password": "Password is too weak. Use at least 10 characters with uppercase, lowercase, number, and symbol.",
        "auth/api-key-not-valid": "Firebase API key is invalid. Check your VITE_FIREBASE_* settings.",
        "auth/network-request-failed": "Network error while contacting Firebase. Please check your connection and try again.",
      };

      // Priority: 1. Backend response code, 2. Backend response message, 3. Firebase code, 4. Axios message
      const matchedMessage = (backendCode && map[backendCode])
        || (firebaseCode && map[firebaseCode])
        || backendMessage
        || genericMessage
        || "Authentication failed";
      setError(matchedMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
    setSuccess(null);
  };

  // If Firebase auth is not configured, show a configuration error
  if (!firebaseAuth) {
    return (
      <div className="auth-screen relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center animate-fade-in-up">
          <GlassCard className="p-8 cyber-glow">
            <div className="text-red-400 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--theme-text)" }}>Authentication Unavailable</h2>
            <p className="text-sm mb-4" style={{ color: "var(--theme-text-muted)" }}>
              Authentication service is not configured. Please contact your administrator.
            </p>
          </GlassCard>
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4ff] to-[#7b2ff7] flex items-center justify-center text-[#0a0a0f] font-bold text-lg shadow-lg shadow-[#00d4ff]/20">
              Z
            </div>
            <span className="text-2xl font-bold" style={{ color: "var(--theme-text)" }}>
              ZeroDay <span style={{ color: "var(--theme-accent-blue)" }}>Guardian</span>
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
            {mode === "reset" ? "Reset your password" : "Master Cybersecurity with AI"}
          </p>
        </div>

        {/* Auth Card */}
        <div className="auth-card p-6 md:p-12">
          {/* Google Login Button */}
          {mode !== "reset" && mode !== "reset-otp" && (
            <>
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

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: "var(--theme-border)" }} />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3" style={{ backgroundColor: "var(--theme-card)", color: "var(--theme-text-dim)" }}>or continue with email</span>
                </div>
              </div>
            </>
          )}

          {/* Email Auth Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text-muted)" }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-cyber"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            {mode !== "reset" && (
              <PasswordInput
                label={mode === "reset-otp" ? "New password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "register" || mode === "reset-otp" ? "new-password" : "current-password"}
                disabled={isLoading}
                showStrength={mode === "register" || mode === "reset-otp"}
              />
            )}

            {mode === "reset-otp" && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text-muted)" }}>
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="input-cyber text-center text-xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                  maxLength={6}
                />
              </div>
            )}

            {mode === "reset-otp" && (
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                name="confirmPassword"
                id="confirmPassword"
                autoComplete="new-password"
                disabled={isLoading}
              />
            )}

            {mode === "register" && (
              <PasswordInput
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                name="confirmPassword"
                id="confirmPassword"
                autoComplete="new-password"
                disabled={isLoading}
              />
            )}

            {/* Error / Success Messages */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm animate-fade-in" role="status" aria-live="polite">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-cyber w-full py-3 text-base"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="spinner-cyber spinner-sm" />
                  {mode === "login" ? "Signing in..." : mode === "register" ? "Creating account..." : mode === "reset-otp" ? "Resetting password..." : "Sending..."}
                </span>
              ) : (
                mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : mode === "reset-otp" ? "Reset Password" : "Send Reset Email"
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === "login" && (
              <button
                onClick={() => { setMode("reset"); setError(null); setSuccess(null); }}
                className="transition-colors"
                style={{ color: "var(--theme-text-dim)" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--theme-accent-blue)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--theme-text-dim)"}
              >
                Forgot your password?
              </button>
            )}

            <div style={{ color: "var(--theme-text-dim)" }}>
              {mode === "reset" || mode === "reset-otp" ? (
                <button onClick={() => { setMode("login"); setOtp(""); setError(null); setSuccess(null); }}
                  className="transition-colors ml-1"
                  style={{ color: "var(--theme-accent-blue)" }}>
                  Back to sign in
                </button>
              ) : (
                <>
                  {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                  <button onClick={toggleMode}
                    className="transition-colors ml-1"
                    style={{ color: "var(--theme-accent-blue)" }}>
                    {mode === "login" ? "Sign up" : "Sign in"}
                  </button>
                </>
              )}
            </div>
          </div>
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

