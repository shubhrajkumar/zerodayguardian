import { useEffect, useState } from "react";
import { Cookie, Shield, X } from "lucide-react";

const COOKIE_CONSENT_KEY = "zdg_cookie_consent";

type ConsentChoice = "accepted" | "declined" | null;

const getStoredConsent = (): ConsentChoice => {
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored === "accepted" || stored === "declined") return stored;
  } catch {
    // localStorage unavailable
  }
  return null;
};

const setStoredConsent = (choice: ConsentChoice) => {
  try {
    if (choice) {
      localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    }
  } catch {
    // localStorage unavailable
  }
};

const CookieConsent = () => {
  const [consent, setConsent] = useState<ConsentChoice>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check after a short delay to avoid CLS impact
    const timer = window.setTimeout(() => {
      const stored = getStoredConsent();
      setConsent(stored);
      if (!stored) {
        setVisible(true);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    setStoredConsent("accepted");
    setConsent("accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    setStoredConsent("declined");
    setConsent("declined");
    setVisible(false);
  };

  if (!visible || consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t backdrop-blur-2xl p-4 md:p-5 animate-fade-in-up"
      style={{
        backgroundColor: "color-mix(in srgb, var(--theme-bg) 96%, transparent)",
        borderColor: "var(--theme-border)",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.3)",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex items-start gap-3 md:items-center">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--theme-accent-blue) 12%, transparent)" }}
          >
            <Cookie className="h-5 w-5" style={{ color: "var(--theme-accent-blue)" }} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold" style={{ color: "var(--theme-text)" }}>
              Cookie Consent
            </p>
            <p
              id="cookie-consent-description"
              className="text-xs leading-relaxed"
              style={{ color: "var(--theme-text-muted)" }}
            >
              We use essential cookies to operate the platform and optional analytics cookies to improve your
              experience. See our{" "}
              <a
                href="/privacy"
                className="underline underline-offset-2 transition-opacity hover:opacity-80"
                style={{ color: "var(--theme-accent-blue)" }}
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="/terms"
                className="underline underline-offset-2 transition-opacity hover:opacity-80"
                style={{ color: "var(--theme-accent-blue)" }}
              >
                Terms of Service
              </a>
              .
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 md:ml-auto">
          <button
            type="button"
            onClick={handleDecline}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-all duration-200 hover:opacity-80"
            style={{
              color: "var(--theme-text-muted)",
              backgroundColor: "var(--theme-overlay)",
              border: "1px solid var(--theme-border)",
            }}
          >
            <Shield className="h-3.5 w-3.5" />
            Essential Only
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-all duration-200 hover:opacity-90 btn-cyber"
          >
            <Cookie className="h-3.5 w-3.5" />
            Accept All
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:opacity-80"
            style={{ color: "var(--theme-text-dim)" }}
            aria-label="Dismiss cookie consent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
