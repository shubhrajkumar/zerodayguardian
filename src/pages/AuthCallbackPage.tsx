import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGetJson, apiPostJson, setStoredAccessToken } from "@/lib/apiClient";

type MePayload = { user: { id: string; email: string; name: string; role: string } };

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Provider login is not configured. Please contact the platform admin.",
  insecure_redirect_config: "Secure redirect setup is invalid. Verify HTTPS environment configuration.",
  invalid_state: "Your sign-in session expired. Please retry login.",
  token_exchange_failed: "Could not verify provider sign-in. Please retry.",
  token_missing: "Provider token was missing. Please retry.",
  profile_fetch_failed: "Could not fetch provider profile. Please retry.",
  email_missing: "Provider account email is required to continue.",
  oauth_failed: "Authentication failed. Please try again.",
};

const AuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(12);
  const [errorMessage, setErrorMessage] = useState("");

  const status = String(searchParams.get("status") || "").toLowerCase();
  const provider = String(searchParams.get("oauth") || "").toLowerCase();
  const code = String(searchParams.get("code") || "oauth_failed").toLowerCase();

  const title = useMemo(() => {
    if (errorMessage || status === "error") return "Sign-in could not be completed";
    return "Signing you in...";
  }, [errorMessage, status]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((prev) => (prev >= 92 ? prev : prev + 8));
    }, 260);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (status === "error") {
        if (!alive) return;
        setErrorMessage(ERROR_MESSAGES[code] || ERROR_MESSAGES.oauth_failed);
        setProgress(100);
        return;
      }

      try {
        const refresh = await apiPostJson<{ accessToken?: string }>("/api/auth/refresh", {});
        if (refresh?.accessToken) setStoredAccessToken(refresh.accessToken);
        await apiGetJson<MePayload>("/api/auth/me");
        if (!alive) return;
        setProgress(100);
        window.setTimeout(() => navigate("/dashboard", { replace: true }), 500);
      } catch {
        if (!alive) return;
        setErrorMessage("Secure session verification failed. Please try signing in again.");
        setProgress(100);
      }
    };

    run().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [status, code, navigate]);

  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-xl mx-auto rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.16),transparent_40%),rgba(9,13,25,0.88)] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-center mb-5">
          <div className="relative">
            <Shield className="h-14 w-14 text-cyan-300 animate-pulse" />
            <span className="absolute inset-0 rounded-full blur-xl bg-cyan-400/25" />
          </div>
        </div>

        <h1 className="text-center text-2xl font-black brand-gradient-text">
          {title}
        </h1>

        <p className="mt-3 text-center text-sm text-muted-foreground inline-flex items-center justify-center w-full gap-2">
          {errorMessage ? <ShieldAlert className="h-4 w-4 text-amber-300" /> : <ShieldCheck className="h-4 w-4 text-cyan-300" />}
          {errorMessage
            ? errorMessage
            : `Secure session verification in progress via ${provider === "google" ? "Google" : provider === "github" ? "GitHub" : "OAuth"}.`}
        </p>

        <div className="mt-6">
          <div className="h-2 rounded-full bg-cyan-500/15 overflow-hidden">
            <div className="h-full brand-gradient-bg transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">{progress}%</p>
        </div>

        {errorMessage ? (
          <div className="mt-6 flex items-center justify-center">
            <button className="text-xs border border-cyan-300/30 rounded px-3 py-1 hover:bg-cyan-500/10" onClick={() => navigate("/auth", { replace: true })}>
              Back to Sign In
            </button>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-center text-xs text-cyan-200/85 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finalizing secure login
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;

