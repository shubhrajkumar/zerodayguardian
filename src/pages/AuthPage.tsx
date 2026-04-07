import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { hasConfiguredApiBase, resolveBackendUrl } from "@/lib/apiConfig";
import { ApiError, apiGetJson, apiPostJson, resolvePublicApiUrl, setStoredAccessToken } from "@/lib/apiClient";
import { applyReferralSignup, findReferrerByCode } from "@/lib/firestoreGrowth";

declare global {
  interface Window {
    google?: unknown;
  }
}

type BackendAuthPayload = {
  accessToken?: string;
  user?: { id: string; email: string; name?: string | null; authProvider?: string; emailVerified?: boolean; avatarUrl?: string };
};

type ResetOtpResponse = {
  sent?: boolean;
  delivery?: "email";
  destination?: string;
  expiresInMinutes?: number;
  message?: string;
};

type AuthProvidersResponse = {
  google?: {
    enabled?: boolean;
    clientId?: string;
    backendFlow?: boolean;
    startUrl?: string;
    callbackUrl?: string;
    frontendOrigin?: string;
    authorizedOrigins?: string[];
    redirectUri?: string;
  };
};

const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
const loadAuthProviders = async (): Promise<AuthProvidersResponse> => {
  const candidates = [resolvePublicApiUrl("/api/auth/providers"), resolveBackendUrl("/auth/providers")];
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await apiGetJson<AuthProvidersResponse>(candidate);
    } catch (error) {
      lastError = error;
      if (!isApiError(error) || error.status !== 404) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Auth providers unavailable");
};

const runtimeSiteOrigin =
  typeof window !== "undefined"
    ? String(window.location.origin || "").replace(/\/+$/, "")
    : String(import.meta.env.VITE_SITE_URL || __SITE_URL__ || "").replace(/\/+$/, "");
const configuredAuthProvidersUrl = resolvePublicApiUrl("/api/auth/providers");
const hasRuntimeApiBase = hasConfiguredApiBase || /^https?:\/\//i.test(String(configuredAuthProvidersUrl || ""));
const isHostedRuntime =
  Boolean(runtimeSiteOrigin) &&
  !/localhost|127\.0\.0\.1/i.test(runtimeSiteOrigin);
const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  password: z.string().min(10).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/),
});

const AuthPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, refreshAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleStartUrl, setGoogleStartUrl] = useState("");
  const [googleStatus, setGoogleStatus] = useState("");
  const [googleConfigResolved, setGoogleConfigResolved] = useState(false);
  const resetOtpInputRef = useRef<HTMLInputElement | null>(null);
  const requestedResetEmailRef = useRef("");
  const canUseGoogleOauth = Boolean(googleConfigResolved && googleStartUrl && googleClientId);
  const referralCode = String(searchParams.get("ref") || localStorage.getItem("zdg:referral_code") || "").trim().toUpperCase();

  useEffect(() => {
    const code = String(searchParams.get("ref") || "").trim().toUpperCase();
    if (!code) return;
    localStorage.setItem("zdg:referral_code", code);
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const envClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    let active = true;
    loadAuthProviders()
      .then((payload) => {
        if (!active) return;
        const clientId = String(payload?.google?.clientId || envClientId || "").trim();
        const startUrl = String(payload?.google?.startUrl || "").trim();
        setGoogleStartUrl(startUrl);
        setGoogleConfigResolved(true);
        if (payload?.google?.enabled && clientId && startUrl) {
          setGoogleClientId(clientId);
          setGoogleStatus("");
          return;
        }
        setGoogleClientId("");
        setGoogleStartUrl("");
        setGoogleStatus("Google sign-in is not configured on the backend yet.");
      })
      .catch((error) => {
        if (!active) return;
        setGoogleConfigResolved(true);
        setGoogleClientId("");
        setGoogleStartUrl("");
        if (isApiError(error) && error.status === 404) {
          const fallbackStatus =
            isHostedRuntime && !hasRuntimeApiBase
              ? "Google sign-in backend is not mounted on this Vercel deployment yet. Set BACKEND_PUBLIC_URL or VITE_API_BASE_URL to your live backend origin."
              : "Google sign-in endpoint is not available yet. Verify the deployed backend origin and production auth env values.";
          setGoogleStatus(fallbackStatus);
          return;
        }
        setGoogleStatus("Could not load Google sign-in configuration.");
      });
    return () => {
      active = false;
    };
  }, []);

  const startGoogleOauth = () => {
    if (!canUseGoogleOauth) return;
    const next = encodeURIComponent("/dashboard");
    const separator = googleStartUrl.includes("?") ? "&" : "?";
    window.location.assign(`${googleStartUrl}${separator}next=${next}`);
  };

  const backendHint = useMemo(() => {
    if (canUseGoogleOauth) return "";
    if (hasRuntimeApiBase) return `Backend target: ${configuredAuthProvidersUrl}`;
    if (isHostedRuntime) return "Production note: this frontend needs BACKEND_PUBLIC_URL or VITE_API_BASE_URL pointing at the live backend.";
    return "";
  }, [canUseGoogleOauth]);

  const signupPasswordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 10) score += 30;
    if (/[A-Z]/.test(password)) score += 20;
    if (/[a-z]/.test(password)) score += 20;
    if (/\d/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 15;
    return Math.min(score, 100);
  }, [password]);

  const resetPasswordStrength = useMemo(() => {
    let score = 0;
    if (resetPassword.length >= 10) score += 30;
    if (/[A-Z]/.test(resetPassword)) score += 20;
    if (/[a-z]/.test(resetPassword)) score += 20;
    if (/\d/.test(resetPassword)) score += 15;
    if (/[^A-Za-z0-9]/.test(resetPassword)) score += 15;
    return Math.min(score, 100);
  }, [resetPassword]);

  const getAuthErrorMessage = (error: unknown, currentMode: "login" | "signup") => {
    if (!isApiError(error)) return "Authentication failed.";
    if (error.status === 429) return error.message;
    if (error.code === "google_auth_not_configured") {
      return "Google sign-in is not configured on the backend.";
    }
    if (error.code === "google_token_required") {
      return "Google did not return a valid credential.";
    }
    if (error.code === "google_identity_invalid") {
      return "Google identity verification failed. Check the client ID and authorized origins.";
    }
    if (error.code === "google_email_not_verified") {
      return "Your Google account email must be verified before sign-in is allowed.";
    }
    if (error.code === "db_unavailable_auth") {
      return "Login is unavailable because MongoDB is not connected. Check the backend database connection first.";
    }
    if (currentMode === "login" && ["wrong_password", "user_not_found"].includes(error.code)) {
      return "Email or password is incorrect.";
    }
    if (currentMode === "signup" && error.code === "user_exists") {
      return "An account with this email already exists. Please sign in instead.";
    }
    return error.message || "Authentication failed.";
  };

  const getResetErrorMessage = (error: unknown, fallback: string) => {
    if (!isApiError(error)) return fallback;
    if (error.status === 429) return error.message;
    if (error.code === "user_not_found") return "We couldn't find an account with that email address.";
    if (error.code === "otp_not_requested") return "Request a reset OTP first, then enter it here.";
    if (error.code === "otp_expired") return "That OTP has expired. Request a fresh one and try again.";
    if (error.code === "invalid_otp") return "That OTP doesn't match. Double-check the code and try again.";
    if (error.code === "mail_not_configured") return "Password reset email is temporarily unavailable. Please try again shortly.";
    if (error.code === "mail_delivery_failed") return "We couldn't send the reset email right now. Please try again shortly.";
    return error.message || fallback;
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthStatus("");

    try {
      if (mode === "signup") {
        signupSchema.parse({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        const payload = await apiPostJson<BackendAuthPayload>("/api/auth/signup", {
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (payload.user?.id && referralCode) {
          const referrerUserId = await findReferrerByCode(referralCode);
          if (referrerUserId && referrerUserId !== payload.user.id) {
            await applyReferralSignup(referrerUserId, payload.user.id);
            localStorage.removeItem("zdg:referral_code");
          }
        }
        if (payload.accessToken) {
          setStoredAccessToken(payload.accessToken);
          await refreshAuth();
        }
        setAuthStatus("Account created successfully. Redirecting to your dashboard...");
      } else {
        loginSchema.parse({
          email: email.trim(),
          password,
        });
        const payload = await apiPostJson<BackendAuthPayload>("/api/auth/login", {
          email: email.trim(),
          password,
          rememberMe,
        });
        if (payload.accessToken) {
          setStoredAccessToken(payload.accessToken);
          await refreshAuth();
        }
        setAuthStatus("Login successful. Redirecting to your dashboard...");
      }
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 250);
    } catch (error) {
      setAuthStatus(error instanceof z.ZodError ? "Please use a valid email and a stronger password." : getAuthErrorMessage(error, mode));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSendOtp = async (event: FormEvent) => {
    event.preventDefault();
    setSendingOtp(true);
    setResetStatus("");

    try {
      const payload = await apiPostJson<ResetOtpResponse>("/api/auth/send-otp", {
        email: resetEmail.trim(),
      });

      requestedResetEmailRef.current = resetEmail.trim().toLowerCase();
      setOtpSent(true);
      setResetOtp("");

      if (payload.destination) {
        const expiry = payload.expiresInMinutes ? ` It expires in ${payload.expiresInMinutes} minutes.` : "";
        setResetStatus(`A 6-digit OTP was sent to ${payload.destination}. Check your inbox and spam folder, then enter it below.${expiry}`);
      } else {
        setResetStatus(payload.message || "Reset OTP sent successfully.");
      }

      window.setTimeout(() => resetOtpInputRef.current?.focus(), 50);
    } catch (error) {
      setOtpSent(false);
      setResetStatus(getResetErrorMessage(error, "Unable to send reset OTP."));
    } finally {
      setSendingOtp(false);
    }
  };

  const submitResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setResettingPassword(true);
    setResetStatus("");

    try {
      resetSchema.parse({
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        password: resetPassword,
      });
      const payload = await apiPostJson<BackendAuthPayload>("/api/auth/reset-password", {
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        password: resetPassword,
      });
      if (payload.accessToken) setStoredAccessToken(payload.accessToken);
      setResetStatus("Password reset successful. Redirecting to your dashboard...");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 250);
    } catch (error) {
      setResetStatus(error instanceof z.ZodError ? "Enter a valid email, 6-digit OTP, and a stronger password." : getResetErrorMessage(error, "Unable to reset password."));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`home-clean-mini-cta-link ${mode === "login" ? "nav-pill-active" : ""}`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`home-clean-mini-cta-link ${mode === "signup" ? "nav-pill-active" : ""}`}
              onClick={() => setMode("signup")}
            >
              Signup
            </button>
          </div>
          {referralCode ? (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
              Referral detected: <span className="font-semibold">{referralCode}</span>. Creating your account through this link will unlock referral XP rewards.
            </div>
          ) : null}

          <form className="mt-6 grid gap-3" onSubmit={submitAuth}>
            {mode === "signup" ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 rounded-md border border-primary/20 bg-background px-3 text-sm"
                placeholder="Full name"
                required
              />
            ) : null}

            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Email"
              type="email"
              required
            />

            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="inline-flex w-fit items-center gap-2 text-xs text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPassword ? "Hide password" : "Show password"}
            </button>

            {mode === "login" ? (
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border border-primary/30 bg-background"
                />
                Keep me signed in
              </label>
            ) : (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded bg-cyan-500/15">
                  <div className="h-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22d3ee)]" style={{ width: `${signupPasswordStrength}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">Use 10+ characters with uppercase, lowercase, number, and symbol.</p>
              </div>
            )}

            <button type="submit" className="h-11 rounded-md border border-primary/40 text-sm font-mono hover:bg-primary/10" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait...
                </span>
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-4 space-y-3 border-t border-primary/10 pt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Google Sign-In</p>
            <div className="min-h-[44px]">
              {canUseGoogleOauth ? (
                <button
                  type="button"
                  onClick={startGoogleOauth}
                  className="inline-flex h-11 w-full items-center justify-center rounded-md border border-primary/20 bg-background px-3 text-sm transition-colors hover:bg-muted"
                >
                  Continue with Google
                </button>
              ) : null}
              {!canUseGoogleOauth && googleStatus ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/8 px-4 py-3 text-sm leading-6 text-amber-100/90">
                  {googleStatus}
                </div>
              ) : null}
            </div>
            {googleStatus ? <p className="text-sm text-muted-foreground">{googleStatus}</p> : null}
            {backendHint ? <p className="text-xs text-muted-foreground/80">{backendHint}</p> : null}
          </div>

          {authStatus ? <p className="mt-4 text-sm text-muted-foreground">{authStatus}</p> : null}
        </section>

        <section className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-cyan-200" />
            <h2 className="font-mono text-lg">Reset Password</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Enter your email, request a 6-digit OTP, then choose a new password.</p>

          <form className="mt-4 grid gap-3" onSubmit={submitSendOtp}>
            <input
              value={resetEmail}
              onChange={(event) => {
                const nextEmail = event.target.value;
                const normalizedNextEmail = nextEmail.trim().toLowerCase();
                setResetEmail(nextEmail);

                if (otpSent && requestedResetEmailRef.current && normalizedNextEmail !== requestedResetEmailRef.current) {
                  setOtpSent(false);
                  setResetOtp("");
                  setResetStatus("Email changed. Request a fresh OTP for this address to continue.");
                }
              }}
              className="h-11 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Account email"
              type="email"
              autoComplete="email"
              required
            />
            <button
              type="submit"
              className="h-10 rounded-md border border-cyan-300/30 text-sm hover:bg-cyan-500/10"
              disabled={sendingOtp || !resetEmail.trim()}
            >
              {sendingOtp ? "Sending reset OTP..." : otpSent ? "Resend OTP" : "Send reset OTP"}
            </button>
          </form>

          {resetStatus ? <p className="mt-4 text-sm text-muted-foreground">{resetStatus}</p> : null}
          {otpSent ? (
            <p className="mt-2 text-xs text-cyan-200/80">
              Use the same email address for the next step. If you request a new code, only the latest OTP will work.
            </p>
          ) : null}

          <form className="mt-6 grid gap-3 border-t border-cyan-300/15 pt-4" onSubmit={submitResetPassword}>
            <input
              ref={resetOtpInputRef}
              value={resetOtp}
              onChange={(event) => setResetOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="6-digit OTP"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
            <input
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              className="h-11 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="New password"
              type="password"
              autoComplete="new-password"
              required
            />
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded bg-cyan-500/15">
                <div className="h-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22d3ee)]" style={{ width: `${resetPasswordStrength}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground">Your new password follows the same strength requirements.</p>
            </div>
            <button
              type="submit"
              className="h-10 rounded-md border border-cyan-300/30 text-sm hover:bg-cyan-500/10"
              disabled={resettingPassword || !resetEmail.trim() || resetOtp.trim().length !== 6 || !resetPassword}
            >
              {resettingPassword ? "Resetting password..." : "Reset password"}
            </button>
          </form>

          <p className="mt-5 inline-flex items-center gap-2 text-xs text-cyan-200/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Email/password authentication is handled by the ZeroDay Guardian backend session service.
          </p>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
