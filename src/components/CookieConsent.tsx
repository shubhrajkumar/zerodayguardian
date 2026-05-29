import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "zdg_cookie_consent";
const CONSENT_VERSION = "1.0";

type ConsentPreferences = {
  version: string;
  essential: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
  timestamp: number;
};

const defaultPreferences: ConsentPreferences = {
  version: CONSENT_VERSION,
  essential: true,
  analytics: false,
  functional: false,
  marketing: false,
  timestamp: Date.now(),
};

const loadConsent = (): ConsentPreferences | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ConsentPreferences;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveConsent = (prefs: ConsentPreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, timestamp: Date.now() }));
  } catch {
    // Storage unavailable
  }
};

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({ ...defaultPreferences });

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) {
      // Delay showing to avoid layout shift on page load
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = useCallback(() => {
    const prefs: ConsentPreferences = {
      version: CONSENT_VERSION,
      essential: true,
      analytics: true,
      functional: true,
      marketing: true,
      timestamp: Date.now(),
    };
    saveConsent(prefs);
    setVisible(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("zdg:consent:updated", { detail: prefs }));
    }
  }, []);

  const handleAcceptEssential = useCallback(() => {
    saveConsent({ ...defaultPreferences, timestamp: Date.now() });
    setVisible(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("zdg:consent:updated", { detail: defaultPreferences }));
    }
  }, []);

  const handleSavePreferences = useCallback(() => {
    const prefs = { ...preferences, timestamp: Date.now() };
    saveConsent(prefs);
    setVisible(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("zdg:consent:updated", { detail: prefs }));
    }
  }, [preferences]);

  const togglePreference = useCallback((key: keyof ConsentPreferences) => {
    if (key === "essential") return; // essential cannot be disabled
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-[var(--theme-border)] bg-[var(--theme-bg)]/95 backdrop-blur-xl shadow-2xl"
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
    >
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-[var(--theme-text)]">
                🍪 Cookie Consent
              </h3>
              <button
                onClick={() => setVisible(false)}
                className="text-[var(--theme-text-dim)] hover:text-[var(--theme-text)] transition-colors md:hidden"
                aria-label="Close cookie consent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p id="cookie-consent-description" className="text-sm text-[var(--theme-text-muted)] leading-relaxed">
              ZeroDay Guardian uses essential cookies for security and functionality. 
              We also use optional cookies to improve your experience. 
              By clicking "Accept All", you consent to all cookies. 
              See our{" "}
              <a href="/privacy" className="text-[var(--theme-accent-blue)] hover:underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="text-[var(--theme-accent-blue)] hover:underline" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 text-sm font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] transition-colors rounded-lg hover:bg-[var(--theme-overlay-hover)]"
            >
              {showDetails ? "Hide Details" : "Customize"}
            </button>
            <button
              onClick={handleAcceptEssential}
              className="px-4 py-2 text-sm font-medium text-[var(--theme-text)] border border-[var(--theme-border)] rounded-lg hover:bg-[var(--theme-overlay-hover)] transition-colors"
            >
              Essential Only
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[var(--theme-accent-blue)] to-[var(--theme-accent-green)] rounded-lg hover:opacity-90 transition-all shadow-lg shadow-[var(--theme-accent-blue)]/20"
            >
              Accept All
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 border-t border-[var(--theme-border)] pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                { key: "essential" as const, label: "Essential", description: "Authentication, security, session management. Always required." },
                { key: "analytics" as const, label: "Analytics", description: "Usage statistics to improve the platform." },
                { key: "functional" as const, label: "Functional", description: "Remember your preferences and settings." },
                { key: "marketing" as const, label: "Marketing", description: "Personalized content and campaign tracking." },
              ]).map(({ key, label, description }) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    preferences[key]
                      ? "border-[var(--theme-accent-blue)]/40 bg-[var(--theme-accent-blue)]/5"
                      : "border-[var(--theme-border)] hover:border-[var(--theme-accent-blue)]/30"
                  } ${key === "essential" ? "opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={() => togglePreference(key)}
                    disabled={key === "essential"}
                    className="mt-1 h-4 w-4 rounded border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-accent-blue)] focus:ring-[var(--theme-accent-blue)] disabled:opacity-50"
                  />
                  <div>
                    <span className="text-sm font-medium text-[var(--theme-text)]">{label}</span>
                    <p className="text-xs text-[var(--theme-text-dim)] mt-0.5">{description}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSavePreferences}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[var(--theme-accent-blue)] to-[var(--theme-accent-green)] rounded-lg hover:opacity-90 transition-all shadow-lg shadow-[var(--theme-accent-blue)]/20"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieConsent;

export { loadConsent, saveConsent };
export type { ConsentPreferences };
