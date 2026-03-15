import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, apiFetch, apiGetJson, apiPostJson, setStoredAccessToken } from "@/lib/apiClient";

type OAuthProviders = {
  google: { configured: boolean; startPath: string; callbackUrl: string };
  github: { configured: boolean; startPath: string; callbackUrl: string };
  secureRedirectConfig: boolean;
};

const OAUTH_MESSAGES: Record<string, string> = {
  not_configured: "OAuth is not configured yet. Please contact the platform administrator.",
  insecure_redirect_config: "Secure OAuth redirect is not configured for production. Please verify HTTPS app URL settings.",
  invalid_state: "Your sign-in session expired. Please try again.",
  token_exchange_failed: "Provider sign-in could not be verified. Please retry.",
  token_missing: "Provider sign-in token was missing. Please retry.",
  profile_fetch_failed: "Could not load your provider profile. Please retry.",
  email_missing: "Your provider account does not expose an email address required for sign-in.",
  oauth_failed: "OAuth sign-in failed. Please try again.",
};

const AuthPage = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | "">("");
  const [providerStatus, setProviderStatus] = useState<OAuthProviders | null>(null);
  const [providerMessage, setProviderMessage] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [devTokenPreview, setDevTokenPreview] = useState("");
  const [searchParams] = useSearchParams();
  const passwordScore = useMemo(() => {
    const value = mode === "signup" ? password : resetPassword;
    let score = 0;
    if (value.length >= 10) score += 30;
    if (/[A-Z]/.test(value)) score += 20;
    if (/[a-z]/.test(value)) score += 20;
    if (/\d/.test(value)) score += 15;
    if (/[^A-Za-z0-9]/.test(value)) score += 15;
    return Math.max(0, Math.min(100, score));
  }, [mode, password, resetPassword]);

  useEffect(() => {
    let active = true;
    apiGetJson<OAuthProviders>("/api/auth/oauth/providers")
      .then((payload) => {
        if (!active) return;
        setProviderStatus(payload);
        setProviderMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setProviderStatus(null);
        if (error instanceof ApiError && error.status === 429) {
          setProviderMessage(error.message);
          return;
        }
        setProviderMessage("Provider configuration is temporarily unavailable. Please retry in a moment.");
      });
    return () => {
      active = false;
    };
  }, []);

  const oauthNotice = useMemo(() => {
    const statusParam = searchParams.get("status");
    const code = searchParams.get("code") || "";
    const provider = (searchParams.get("oauth") || "").toLowerCase();
    if (!statusParam || statusParam !== "error") return "";
    const base = OAUTH_MESSAGES[code] || OAUTH_MESSAGES.oauth_failed;
    return provider ? `${provider === "google" ? "Google" : "GitHub"} sign-in: ${base}` : base;
  }, [searchParams]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login" ? { email, password } : { name, email, password };
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Authentication failed");
      const data = (await response.json()) as { accessToken?: string };
      if (data?.accessToken) setStoredAccessToken(data.accessToken);
      setStatus(mode === "login" ? "Login successful. Secure session is active." : "Signup successful. Welcome to ZeroDay-Guardian.");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 350);
    } catch {
      setStatus("Authentication failed. Please verify your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = (provider: "google" | "github") => {
    if (!providerStatus?.secureRedirectConfig) {
      setStatus("Secure OAuth redirect configuration is invalid. Please use HTTPS app URL in production.");
      return;
    }
    const config = providerStatus?.[provider];
    if (!config?.configured) {
      setStatus(`${provider === "google" ? "Google" : "GitHub"} OAuth is not configured on the server.`);
      return;
    }
    setOauthLoading(provider);
    window.location.assign(config.startPath);
  };

  const submitForgot = async (event: FormEvent) => {
    event.preventDefault();
    setResetStatus("");
    try {
      const payload = await apiPostJson<{ tokenPreview?: string }>("/api/auth/forgot-password", { email: forgotEmail });
      setResetStatus("If the account exists, a reset token has been issued.");
      setDevTokenPreview(payload?.tokenPreview || "");
    } catch {
      setResetStatus("Forgot-password request failed. Retry in a moment.");
    }
  };

  const submitReset = async (event: FormEvent) => {
    event.preventDefault();
    setResetStatus("");
    try {
      const payload = await apiPostJson<{ accessToken?: string }>("/api/auth/reset-password", { token: resetToken, password: resetPassword });
      if (payload?.accessToken) setStoredAccessToken(payload.accessToken);
      setResetStatus("Password reset successful. You are now signed in.");
      setResetToken("");
      setResetPassword("");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 350);
    } catch {
      setResetStatus("Reset failed. Verify token validity and password policy.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto grid gap-6">
        <section className="glass-card rounded-lg p-6">
          <h1 className="font-mono text-3xl font-bold mb-3">Secure NeuroBot Access</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Sign in to enable account-scoped history, private controls, and personalized AI guidance across sessions.
          </p>

          {oauthNotice ? (
            <div className="mb-4 rounded-md border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm inline-flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              {oauthNotice}
            </div>
          ) : null}
          {providerMessage ? (
            <div className="mb-4 rounded-md border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm inline-flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              {providerMessage}
            </div>
          ) : null}

          <div className="flex gap-2 mb-4">
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

          <form onSubmit={submit} className="grid gap-3">
            {mode === "signup" ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm"
                placeholder="Full name"
                required
              />
            ) : null}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Email"
              type="email"
              required
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Password"
              type="password"
              required
            />
            {mode === "signup" ? (
              <div className="space-y-1">
                <div className="h-2 rounded bg-cyan-500/15 overflow-hidden">
                  <div className="h-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22d3ee)]" style={{ width: `${passwordScore}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">Password policy: 10+ chars, upper, lower, number, symbol.</p>
              </div>
            ) : null}
            <button type="submit" className="h-10 rounded-md border border-primary/40 hover:bg-primary/10 text-sm font-mono" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
                </span>
              ) : mode === "login" ? (
                "Login"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => startOAuth("google")}
              className="home-clean-mini-cta-link justify-center"
              disabled={oauthLoading !== ""}
            >
              {oauthLoading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => startOAuth("github")}
              className="home-clean-mini-cta-link justify-center"
              disabled={oauthLoading !== ""}
            >
              {oauthLoading === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue with GitHub
            </button>
          </div>
          <form className="mt-4 grid gap-2 border-t border-cyan-300/15 pt-4" onSubmit={submitForgot}>
            <p className="text-xs text-cyan-100/90">Forgot password</p>
            <input
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Account email"
              type="email"
              required
            />
            <button type="submit" className="h-9 rounded-md border border-cyan-300/30 hover:bg-cyan-500/10 text-xs font-mono">Request Reset</button>
          </form>

          <form className="mt-3 grid gap-2" onSubmit={submitReset}>
            <p className="text-xs text-cyan-100/90">Reset password</p>
            <input
              value={resetToken}
              onChange={(event) => setResetToken(event.target.value)}
              className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="Reset token"
              required
            />
            <input
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm"
              placeholder="New password"
              type="password"
              required
            />
            <div className="h-2 rounded bg-cyan-500/15 overflow-hidden">
              <div className="h-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22d3ee)]" style={{ width: `${passwordScore}%` }} />
            </div>
            <button type="submit" className="h-9 rounded-md border border-cyan-300/30 hover:bg-cyan-500/10 text-xs font-mono">Apply New Password</button>
          </form>

          {status ? <p className="text-xs text-muted-foreground mt-4">{status}</p> : null}
          {resetStatus ? <p className="text-xs text-muted-foreground mt-2">{resetStatus}</p> : null}
          {devTokenPreview ? <p className="text-[11px] text-amber-100/90 mt-1">Dev token preview: {devTokenPreview}</p> : null}
          <p className="text-xs text-cyan-200/80 mt-3 inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Encrypted cookie sessions + CSRF-protected auth flow
          </p>
        </section>

        <section className="glass-card rounded-lg p-6">
          <h2 className="font-mono text-lg inline-flex items-center gap-2 mb-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            Security and Privacy
          </h2>
          <ul className="text-sm text-muted-foreground grid gap-2">
            <li className="inline-flex gap-2">
              <Lock className="h-4 w-4 mt-0.5 text-primary" />
              Passwords are hashed, auth tokens are cookie-protected, and session access is isolated per account.
            </li>
            <li>Use Private Chat mode in NeuroBot when you need non-persistent confidential conversations.</li>
            <li>
              Read privacy commitments in the{" "}
              <Link to="/about" className="text-accent hover:underline">
                platform trust section
              </Link>
              .
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
