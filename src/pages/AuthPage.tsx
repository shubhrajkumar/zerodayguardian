import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Clock, Eye, EyeOff, KeyRound, Loader2, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL, hasConfiguredApiBase, resolveBackendUrl } from "@/lib/apiConfig";
import { ApiError, apiGetJson, apiPostJson, resolvePublicApiUrl, setStoredAccessToken } from "@/lib/apiClient";
import { applyReferralSignup, findReferrerByCode } from "@/lib/firestoreGrowth";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";

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
  delivery?: "email" | "preview";
  destination?: string;
  expiresInMinutes?: number;
  otpPreview?: string;
  message?: string;
};

type AuthProvidersResponse = {
  degraded?: boolean;
  message?: string;
  action?: string;
  google?: {
    enabled?: boolean;
    clientId?: string;
    backendFlow?: boolean;
    startUrl?: string;
    callbackUrl?: string;
    frontendOrigin?: string;
    authorizedOrigins?: string[];
    redirectUri?: string;
    missingKeys?: string[];
    invalidKeys?: string[];
    action?: string;
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
  Boolean(runtimeSiteOrigin) && !/localhost|127\.0\.0\.1/i.test(runtimeSiteOrigin);

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(10, "Password must be at least 10 characters").regex(/[A-Z]/, "Include an uppercase letter").regex(/[a-z]/, "Include a lowercase letter").regex(/\d/, "Include a number").regex(/[^A-Za-z0-9]/, "Include a special character"),
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const resetSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  password: z.string().min(10, "Password must be at least 10 characters").regex(/[A-Z]/, "Include an uppercase letter").regex(/[a-z]/, "Include a lowercase letter").regex(/\d/, "Include a number").regex(/[^A-Za-z0-9]/, "Include a special character"),
});

const getProviderStatusMessage = (payload: AuthProvidersResponse) => {
  const missingKeys = payload?.google?.missingKeys?.length ? ` Missing: ${payload.google.missingKeys.join(", ")}.` : "";
  const invalidKeys = payload?.google?.invalidKeys?.length ? ` Invalid: ${payload.google.invalidKeys.join(", ")}.` : "";
  const action = payload?.google?.action || payload?.action || "";
  const base = payload?.message || "Google sign-in is disabled on the backend.";
  return `${base}${missingKeys}${invalidKeys}${action ? ` ${action}` : ""}`;
};

const getProviderErrorMessage = (error: unknown) => {
  if (!isApiError(error)) return "Google OAuth configuration check failed.";
  if (error.code === "backend_starting") return "Backend auth service is starting. Retry in a minute, then refresh this page.";
  if (error.code === "db_unavailable_auth") return "Backend auth database is unavailable. Check the Render MongoDB environment and redeploy.";
  if (error.code === "cors_blocked") return "The backend CORS settings do not allow this frontend origin.";
  return error.message || "Google OAuth configuration check failed.";
};

const passwordStrengthScore = (password: string) => {
  let score = 0;
  if (password.length >= 10) score += 25;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[a-z]/.test(password)) score += 20;
  if (/\d/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;
  return Math.min(score, 100);
};

const strengthLabel = (score: number) => {
  if (score < 30) return { label: "Weak", color: "from-red-500 to-red-400" };
  if (score < 55) return { label: "Fair", color: "from-orange-500 to-yellow-400" };
  if (score < 75) return { label: "Good", color: "from-yellow-400 to-lime-400" };
  if (score < 90) return { label: "Strong", color: "from-lime-400 to-emerald-400" };
  return { label: "Excellent", color: "from-emerald-400 to-cyan-400" };
};

const fadeSlideUp = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.97 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

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

  // Reset password state
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDelivery, setOtpDelivery] = useState<"email" | "preview" | null>(null);
  const [otpDestination, setOtpDestination] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);
  const [otpPreviewCode, setOtpPreviewCode] = useState("");

  // Google state
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleStartUrl, setGoogleStartUrl] = useState("");
  const [googleStatus, setGoogleStatus] = useState("");
  const [googleConfigResolved, setGoogleConfigResolved] = useState(false);

  const resetOtpInputRef = useRef<HTMLInputElement | null>(null);
  const resetFormRef = useRef<HTMLFormElement | null>(null);
  const requestedResetEmailRef = useRef("");
  const otpCountdownRef = useRef<number | null>(null);

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
        setGoogleStatus(getProviderStatusMessage(payload));
      })
      .catch((error) => {
        if (!active) return;
        setGoogleConfigResolved(true);
        setGoogleClientId("");
        setGoogleStartUrl("");
        if (isApiError(error) && error.status === 404) {
          const fallbackStatus =
            isHostedRuntime && !hasRuntimeApiBase
              ? "Google OAuth backend configuration is incomplete. Verify the production auth environment variables."
              : "Google OAuth backend configuration is incomplete. Please retry after the backend is updated.";
          setGoogleStatus(fallbackStatus);
          return;
        }
        setGoogleStatus(getProviderErrorMessage(error));
      });
    return () => { active = false; };
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
    if (isHostedRuntime) {
      return `Production note: this frontend needs BACKEND_PUBLIC_URL or VITE_API_BASE_URL pointing at the live backend. Current target is ${API_BASE_URL}`;
    }
    return "";
  }, [canUseGoogleOauth]);

  const signupStrength = useMemo(() => passwordStrengthScore(password), [password]);
  const signupStrengthMeta = useMemo(() => strengthLabel(signupStrength), [signupStrength]);
  const resetStrength = useMemo(() => passwordStrengthScore(resetPassword), [resetPassword]);
  const resetStrengthMeta = useMemo(() => strengthLabel(resetStrength), [resetStrength]);

  const getAuthErrorMessage = useCallback((error: unknown, currentMode: "login" | "signup") => {
    if (!isApiError(error)) {
      if (error instanceof TypeError) return "Backend connection failed. Wait a few seconds and try again (Render may be waking up).";
      return "Authentication failed.";
    }
    if (error.code === "network_error" || error.status === 503) return error.message || "Backend connection failed. Wait a few seconds and try again.";
    if (error.status === 429) return error.message;
    if (error.code === "google_auth_not_configured") return "Google OAuth is not configured correctly on the backend.";
    if (error.code === "google_token_required") return "Google did not return a valid credential.";
    if (error.code === "google_identity_invalid") return "Google identity verification failed. Check the client ID and authorized origins.";
    if (error.code === "google_email_not_verified") return "Your Google account email must be verified before sign-in is allowed.";
    if (error.code === "db_unavailable_auth") return "Login is unavailable because MongoDB is not connected. Check the backend database connection first.";
    if (currentMode === "login" && ["wrong_password", "user_not_found"].includes(error.code)) return "Email or password is incorrect.";
    if (currentMode === "signup" && error.code === "user_exists") return "An account with this email already exists. Please sign in instead.";
    return error.message || "Authentication failed.";
  }, []);

  const getResetErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (!isApiError(error)) return fallback;
    if (error.status === 429) return error.message;
    if (error.code === "user_not_found") return "We couldn't find an account with that email address.";
    if (error.code === "otp_not_requested") return "Request a reset OTP first, then enter it here.";
    if (error.code === "otp_expired") return "That OTP has expired. Request a fresh one and try again.";
    if (error.code === "invalid_otp") return "That OTP doesn't match. Double-check the code and try again.";
    if (error.code === "mail_not_configured") return "Password reset email is not configured on the backend.";
    if (error.code === "mail_delivery_failed") return "Password reset email could not be sent. Confirm SMTP / email environment variables, then retry.";
    if (error.code === "backend_starting") return "Backend auth service is starting. Retry in a minute, then request the OTP again.";
    if (error.code === "db_unavailable_auth") return "Password reset is unavailable because the backend database is not connected.";
    return error.message || fallback;
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "signup") {
        signupSchema.parse({ name: name.trim(), email: email.trim(), password });
        const payload = await apiPostJson<BackendAuthPayload>("/api/auth/signup", {
          name: name.trim(), email: email.trim(), password,
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
        toast.success("Account created successfully. Redirecting to your dashboard...", { duration: 3000 });
      } else {
        loginSchema.parse({ email: email.trim(), password });
        const payload = await apiPostJson<BackendAuthPayload>("/api/auth/login", {
          email: email.trim(), password, rememberMe,
        });
        if (payload.accessToken) {
          setStoredAccessToken(payload.accessToken);
          await refreshAuth();
        }
        toast.success("Login successful. Redirecting to your dashboard...", { duration: 3000 });
      }
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 300);
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Please check your input and try again."
        : getAuthErrorMessage(error, mode);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitSendOtp = async (event: FormEvent) => {
    event.preventDefault();
    setSendingOtp(true);

    try {
      const payload = await apiPostJson<ResetOtpResponse>("/api/auth/send-otp", {
        email: resetEmail.trim(),
      });

      const expiresInMinutes = payload.expiresInMinutes || 10;
      const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

      requestedResetEmailRef.current = resetEmail.trim().toLowerCase();
      setOtpSent(true);
      setResetOtp("");
      setOtpDelivery(payload.delivery || null);
      setOtpDestination(payload.destination || "");
      setOtpExpiry(expiresInMinutes);
      setOtpExpiresAt(expiresAt);
      setOtpCountdown(expiresInMinutes * 60);
      setOtpExpired(false);
      setOtpPreviewCode(payload.otpPreview || "");

      if (payload.delivery === "preview") {
        toast.info(
          `OTP generated for ${payload.destination}${payload.expiresInMinutes ? `. Expires in ${payload.expiresInMinutes} minutes` : ""}`,
          { duration: 5000 }
        );
      } else if (payload.delivery === "email") {
        toast.success(
          `OTP sent to ${payload.destination}${payload.expiresInMinutes ? `. Expires in ${payload.expiresInMinutes} minutes` : ""}. Check your inbox & spam folder.`,
          { duration: 6000 }
        );
      } else {
        toast.success(payload.message || "Reset OTP sent successfully.", { duration: 4000 });
      }

      window.setTimeout(() => resetOtpInputRef.current?.focus(), 100);
    } catch (error) {
      setOtpSent(false);
      setOtpDelivery(null);
      setOtpExpiresAt(null);
      setOtpCountdown(0);
      setOtpExpired(false);
      setOtpPreviewCode("");
      const message = getResetErrorMessage(error, "Unable to send reset OTP.");
      toast.error(message);
    } finally {
      setSendingOtp(false);
    }
  };

  const submitResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setResettingPassword(true);

    try {
      resetSchema.parse({ email: resetEmail.trim(), otp: resetOtp.trim(), password: resetPassword });
      const payload = await apiPostJson<BackendAuthPayload>("/api/auth/reset-password", {
        email: resetEmail.trim(), otp: resetOtp.trim(), password: resetPassword,
      });
      if (payload.accessToken) setStoredAccessToken(payload.accessToken);
      toast.success("Password reset successful. Redirecting to your dashboard...", { duration: 3000 });
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 300);
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Enter a valid email, 6-digit OTP, and a stronger password."
        : getResetErrorMessage(error, "Unable to reset password.");
      toast.error(message);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleOtpChange = useCallback((value: string) => {
    setResetOtp(value);
  }, []);

  const handleOtpComplete = useCallback(() => {
    // Auto-submit reset form when all 6 OTP digits are entered
    // if password also meets requirements
    if (resetFormRef.current && resetPassword.length >= 10) {
      resetFormRef.current.requestSubmit();
    }
  }, [resetPassword]);

  // OTP countdown timer
  useEffect(() => {
    if (!otpSent || !otpExpiresAt) return;

    otpCountdownRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.floor((otpExpiresAt - Date.now()) / 1000));
      setOtpCountdown(remaining);

      if (remaining <= 0) {
        if (otpCountdownRef.current !== null) {
          clearInterval(otpCountdownRef.current);
          otpCountdownRef.current = null;
        }
        setOtpExpired(true);
        toast.error("OTP has expired. Request a new one.", { duration: 4000 });
      }
    }, 200);

    return () => {
      if (otpCountdownRef.current !== null) {
        clearInterval(otpCountdownRef.current);
        otpCountdownRef.current = null;
      }
    };
  }, [otpSent, otpExpiresAt]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const countdownPercent = otpExpiry > 0 ? (otpCountdown / (otpExpiry * 60)) * 100 : 0;
  const countdownUrgency =
    otpCountdown <= 30 ? "text-red-400" :
    otpCountdown <= 90 ? "text-amber-300" :
    "text-cyan-300";

  const handleResetEmailChange = (value: string) => {
    const normalizedNext = value.trim().toLowerCase();
    setResetEmail(value);
    if (otpSent && requestedResetEmailRef.current && normalizedNext !== requestedResetEmailRef.current) {
      setOtpSent(false);
      setResetOtp("");
      setOtpDelivery(null);
      setOtpExpiresAt(null);
      setOtpCountdown(0);
      setOtpExpired(false);
      setOtpPreviewCode("");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Login / Signup Panel */}
        <motion.section
          className="glass-card rounded-xl p-5 md:p-6"
          {...fadeSlideUp}
          key="auth-panel"
        >
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              className={`home-clean-mini-cta-link text-sm ${mode === "login" ? "nav-pill-active" : ""}`}
              onClick={() => { setMode("login"); }}
              whileTap={{ scale: 0.97 }}
            >
              <Mail className="h-4 w-4" />
              Login
            </motion.button>
            <motion.button
              type="button"
              className={`home-clean-mini-cta-link text-sm ${mode === "signup" ? "nav-pill-active" : ""}`}
              onClick={() => { setMode("signup"); }}
              whileTap={{ scale: 0.97 }}
            >
              Signup
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {referralCode ? (
              <motion.div
                key="referral-banner"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden rounded-xl border border-emerald-300/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100"
              >
                Referral detected: <span className="font-semibold">{referralCode}</span>. Creating your account through this link will unlock referral XP rewards.
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              className="mt-6 grid gap-3"
              onSubmit={submitAuth}
              {...fadeSlideUp}
            >
              {mode === "signup" ? (
                <div className="space-y-1">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 w-full rounded-lg border border-primary/20 bg-background px-3 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(0,255,136,0.08)] focus:outline-none"
                    placeholder="Full name"
                    required
                    autoComplete="name"
                  />
                </div>
              ) : null}

              <div className="space-y-1">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-lg border border-primary/20 bg-background px-3 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(0,255,136,0.08)] focus:outline-none"
                  placeholder="Email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-lg border border-primary/20 bg-background px-3 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(0,255,136,0.08)] focus:outline-none"
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>

              <motion.button
                type="button"
                onClick={() => setShowPassword((c) => !c)}
                className="inline-flex w-fit items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                whileTap={{ scale: 0.97 }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPassword ? "Hide password" : "Show password"}
              </motion.button>

              {mode === "login" ? (
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground/80 transition-colors">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border border-primary/30 bg-background accent-primary"
                  />
                  Keep me signed in
                </label>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative h-2 overflow-hidden rounded-full bg-cyan-500/10">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${signupStrengthMeta.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${signupStrength}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">Use 10+ characters with uppercase, lowercase, number, and symbol.</p>
                    {signupStrength > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground/70">{signupStrengthMeta.label}</span>
                    )}
                  </div>
                </div>
              )}

              <motion.button
                type="submit"
                className="h-11 rounded-lg border border-primary/40 text-sm font-mono transition-all hover:bg-primary/10 hover:border-primary/60 disabled:opacity-50"
                disabled={submitting}
                whileTap={submitting ? {} : { scale: 0.98 }}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === "signup" ? "Creating account..." : "Signing in..."}
                  </span>
                ) : mode === "signup" ? (
                  "Create account"
                ) : (
                  "Login"
                )}
              </motion.button>
            </motion.form>
          </AnimatePresence>

          {/* Google Sign-In */}
          <div className="mt-5 space-y-3 border-t border-primary/10 pt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60">Or continue with</p>
            <div className="min-h-[44px]">
              <AnimatePresence mode="wait">
                {canUseGoogleOauth ? (
                  <motion.button
                    key="google-btn"
                    type="button"
                    onClick={startGoogleOauth}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-background px-3 text-sm transition-all hover:bg-muted hover:border-primary/40"
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </motion.button>
                ) : googleStatus ? (
                  <motion.div
                    key="google-status"
                    className="rounded-xl border border-amber-300/20 bg-amber-500/8 px-4 py-3 text-sm leading-6 text-amber-100/90"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {googleStatus}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            {backendHint ? <p className="text-xs text-muted-foreground/60">{backendHint}</p> : null}
          </div>
        </motion.section>

        {/* Password Reset Panel */}
        <motion.section
          className="glass-card rounded-xl p-5 md:p-6"
          {...fadeSlideUp}
          transition={{ ...fadeSlideUp.transition, delay: 0.1 }}
          key="reset-panel"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
              <KeyRound className="h-4 w-4 text-cyan-300" />
            </div>
            <h2 className="font-mono text-lg">Reset Password</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground/80">Enter your email, request a 6-digit OTP, then choose a new password.</p>

          {/* Send OTP Form */}
          <form className="mt-4 grid gap-3" onSubmit={submitSendOtp}>
            <div className="space-y-1">
              <input
                value={resetEmail}
                onChange={(e) => handleResetEmailChange(e.target.value)}
                className="h-11 w-full rounded-lg border border-primary/20 bg-background px-3 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(0,255,136,0.08)] focus:outline-none"
                placeholder="Account email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <motion.button
              type="submit"
              className="h-10 rounded-lg border border-cyan-300/30 text-sm transition-all hover:bg-cyan-500/10 hover:border-cyan-300/50 disabled:opacity-50"
              disabled={sendingOtp || !resetEmail.trim()}
              whileTap={sendingOtp ? {} : { scale: 0.98 }}
            >
              {sendingOtp ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </span>
              ) : otpSent ? (
                "Resend OTP"
              ) : (
                "Send reset OTP"
              )}
            </motion.button>
          </form>

          {/* OTP Status & Preview */}
          <AnimatePresence>
            {otpSent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="mt-3 space-y-2 overflow-hidden"
              >
                {/* Delivery indicator */}
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  otpDelivery === "preview"
                    ? "bg-amber-500/10 border border-amber-300/20 text-amber-200/90"
                    : "bg-emerald-500/10 border border-emerald-300/20 text-emerald-200/90"
                }`}>
                  <MailCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {otpDelivery === "preview"
                      ? `OTP generated for ${otpDestination}${otpExpiry ? `. Expires in ${otpExpiry} min` : ""}`
                      : `OTP sent to ${otpDestination}${otpExpiry ? `. Expires in ${otpExpiry} min` : ""}`
                    }
                  </span>
                </div>

                {/* OTP Preview Card - shown when in preview mode */}
                {otpDelivery === "preview" && otpPreviewCode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-4 text-center"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-cyan-300/60 mb-2">🔐 Preview OTP Code</p>
                    <div className="flex items-center justify-center gap-2">
                      {otpPreviewCode.split("").map((digit, i) => (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="inline-flex h-10 w-9 items-center justify-center rounded-lg border border-cyan-300/30 bg-background font-mono text-lg font-bold text-cyan-200 shadow-sm"
                        >
                          {digit}
                        </motion.span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground/60">
                      This code is shown for development. In production, it will be emailed.
                    </p>
                  </motion.div>
                )}

                <p className="text-[11px] text-cyan-200/60">
                  Use the same email address for the next step. If you request a new code, only the latest OTP will work.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset Password Form */}
          <form ref={resetFormRef} className="mt-5 grid gap-3 border-t border-cyan-300/10 pt-4" onSubmit={submitResetPassword}>
            {/* OTP Input - using InputOTP component */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground/60">6-digit OTP</label>

                {/* Countdown Timer */}
                {otpSent && !otpExpired && (
                  <motion.div
                    className={`inline-flex items-center gap-1.5 font-mono text-xs ${countdownUrgency}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    key="countdown"
                  >
                    <Clock className="h-3 w-3" />
                    <span className="tabular-nums font-semibold">{formatCountdown(otpCountdown)}</span>
                  </motion.div>
                )}

                {otpExpired && (
                  <motion.div
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-red-400"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span>Expired</span>
                  </motion.div>
                )}
              </div>

              {/* Countdown progress bar */}
              {otpSent && !otpExpired && (
                <div className="relative h-1 overflow-hidden rounded-full bg-cyan-500/10">
                  <motion.div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      countdownPercent < 15
                        ? "bg-red-500"
                        : countdownPercent < 40
                        ? "bg-amber-400"
                        : "bg-cyan-400"
                    }`}
                    initial={{ width: "100%" }}
                    animate={{ width: `${countdownPercent}%` }}
                    transition={{ duration: 0.2, ease: "linear" }}
                  />
                </div>
              )}

              <InputOTP
                maxLength={6}
                value={resetOtp}
                onChange={handleOtpChange}
                onComplete={handleOtpComplete}
                ref={resetOtpInputRef}
                autoComplete="one-time-code"
                disabled={otpExpired}
              >
                <InputOTPGroup className="w-full justify-center">
                  <InputOTPSlot index={0} className="h-11 w-11 text-base border-cyan-300/20 data-[active=true]:border-cyan-300/50" />
                  <InputOTPSlot index={1} className="h-11 w-11 text-base border-cyan-300/20 data-[active=true]:border-cyan-300/50" />
                  <InputOTPSlot index={2} className="h-11 w-11 text-base border-cyan-300/20 data-[active=true]:border-cyan-300/50" />
                  <InputOTPSeparator />
                  <InputOTPSlot index={3} className="h-11 w-11 text-base border-cyan-300/20 data-[active=true]:border-cyan-300/50" />
                  <InputOTPSlot index={4} className="h-11 w-11 text-base border-cyan-300/20 data-[active=true]:border-cyan-300/50" />
                  <InputOTPSlot index={5} className="h-11 w-11 text-base border-cyan-300/20 data-[active=true]:border-cyan-300/50" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-1">
              <input
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="h-11 w-full rounded-lg border border-primary/20 bg-background px-3 text-sm transition-all focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(0,255,136,0.08)] focus:outline-none"
                placeholder="New password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="relative h-2 overflow-hidden rounded-full bg-cyan-500/10">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${resetStrengthMeta.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${resetStrength}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Your new password follows the same strength requirements.</p>
                {resetStrength > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground/70">{resetStrengthMeta.label}</span>
                )}
              </div>
            </div>

            <motion.button
              type="submit"
              className="h-10 rounded-lg border border-cyan-300/30 text-sm transition-all hover:bg-cyan-500/10 hover:border-cyan-300/50 disabled:opacity-50"
              disabled={resettingPassword || !resetEmail.trim() || resetOtp.trim().length !== 6 || !resetPassword}
              whileTap={resettingPassword ? {} : { scale: 0.98 }}
            >
              {resettingPassword ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                "Reset password"
              )}
            </motion.button>
          </form>

          <motion.p
            className="mt-5 inline-flex items-center gap-2 text-xs text-cyan-200/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Email/password authentication is handled by the ZeroDay Guardian backend session service.
          </motion.p>
        </motion.section>
      </div>
    </div>
  );
};

export default AuthPage;
