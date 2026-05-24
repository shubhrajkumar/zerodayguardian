import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import AnimatedCyberBackground from "@/components/AnimatedCyberBackground";

type AuthMode = "login" | "register" | "reset";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
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
      await signInWithPopup(auth, provider);
      showToast("Signed in with Google successfully", "success");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const message = err?.code === "auth/popup-closed-by-user"
        ? "Sign-in cancelled"
        : err?.code === "auth/popup-blocked"
          ? "Pop-up was blocked by your browser. Please allow pop-ups and try again."
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

    if (!email.trim() || (mode !== "reset" && !password.trim())) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (mode !== "reset" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        setSuccess("Account created! Check your email for verification.");
        showToast("Account created! Verify your email.", "success");
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Password reset email sent! Check your inbox.");
        showToast("Reset email sent!", "success");
        setTimeout(() => setMode("login"), 3000);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Welcome back!", "success");
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      const map: Record<string, string> = {
        "auth/user-not-found": "No account with this email",
        "auth/wrong-password": "Incorrect password",
        "auth/invalid-credential": "Invalid email or password",
        "auth/email-already-in-use": "An account with this email already exists",
        "auth/too-many-requests": "Too many attempts. Please try again later",
        "auth/invalid-email": "Invalid email address",
      };
      setError(map[err?.code] || err?.message || "Authentication failed");
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
      <div className="relative min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--theme-bg)" }}>
        <AnimatedCyberBackground />
        <div className="w-full max-w-md text-center animate-fade-in-up">
          <div className="glass-card p-8 cyber-glow">
            <div className="text-red-400 text-4xl mb-4">⚠</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--theme-text)" }}>Authentication Unavailable</h2>
            <p className="text-sm mb-4" style={{ color: "var(--theme-text-muted)" }}>
              Authentication service is not configured. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const auth = firebaseAuth;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--theme-bg)" }}>
        <div className="spinner-cyber spinner-lg" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--theme-bg)" }}>
      <AnimatedCyberBackground />

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
            {mode === "login"
              ? "Sign in to your secure dashboard"
              : mode === "register"
                ? "Create your security command center"
                : "Reset your password"}
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-card p-6 md:p-8 cyber-glow">
          {/* Google Login Button */}
          {mode !== "reset" && (
            <>
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed group"
                style={{ border: "1px solid var(--theme-border)", backgroundColor: "var(--theme-overlay)", color: "var(--theme-text)" }}
              >
                {isLoading ? (
                  <div className="spinner-cyber" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text-muted)" }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-cyber"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  disabled={isLoading}
                />
              </div>
            )}

            {mode === "register" && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text-muted)" }}>
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-cyber"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Error / Success Messages */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm animate-fade-in">
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
                  {mode === "login" ? "Signing in..." : mode === "register" ? "Creating account..." : "Sending..."}
                </span>
              ) : (
                mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Email"
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
              {mode === "reset" ? (
                <button onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
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

        {/* Security Notice */}
        <p className="text-center mt-6 text-xs" style={{ color: "var(--theme-text-dim)" }}>
          Protected by end-to-end encryption 🔒
        </p>
      </div>
    </div>
  );
}
