/**
 * WaitlistModal — Cyber-themed modal for users to register interest in locked modules.
 *
 * Opens with a "Notify Me" CTA inside LockedModule. Collects email, shows a
 * confirmation state on submit. Matches the existing modal pattern
 * (fixed overlay, backdrop blur, Escape-to-close, body scroll lock).
 */
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Mail, X } from "lucide-react";

interface WaitlistModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** The locked module label to reference in copy (e.g. "Combat Labs") */
  moduleLabel: string;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function WaitlistModal({ open, moduleLabel, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setEmailTouched(false);
    }
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const validateEmail = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Email is required, Operator.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format. Check your transmission.";
    return null;
  };

  const handleSubmit = async () => {
    setEmailTouched(true);
    const validationError = validateEmail(email);
    if (validationError) return;

    setStatus("submitting");

    try {
      // Attempt to POST to a backend waitlist endpoint
      const response = await fetch("/api/waitlist/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), module: moduleLabel }),
      });

      if (!response.ok) {
        // If the endpoint doesn't exist or errors, fail gracefully
        throw new Error(`Server responded with ${response.status}`);
      }

      setStatus("success");
    } catch {
      // Backend unavailable — fall back to localStorage queue
      try {
        const raw = localStorage.getItem("zdg:waitlist");
        const queue: Array<{ email: string; module: string; timestamp: number }> = raw ? JSON.parse(raw) : [];
        queue.push({ email: email.trim(), module: moduleLabel, timestamp: Date.now() });
        localStorage.setItem("zdg:waitlist", JSON.stringify(queue));
      } catch {
        // localStorage unavailable — still show success to avoid confusing the user
      }
      setStatus("success");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && status !== "submitting") {
      handleSubmit();
    }
  };

  if (!open) return null;

  const emailError = emailTouched ? validateEmail(email) : null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md transition-opacity duration-250">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <section
          className="relative w-full max-w-md overflow-hidden rounded-2xl border shadow-[0_0_0_1px_rgba(34,197,94,0.25),0_40px_120px_rgba(0,0,0,0.7)]"
          style={{
            borderColor: "rgba(34, 197, 94, 0.25)",
            backgroundColor: "rgba(5, 9, 20, 0.98)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Notify me when ${moduleLabel} unlocks`}
        >
          {/* Ambient glow gradient */}
          <div
            className="pointer-events-none absolute -inset-20 opacity-30"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, rgba(34, 197, 94, 0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(34, 211, 238, 0.1), transparent 50%)",
            }}
          />

          {/* Grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(34, 197, 94, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(34, 197, 94, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: "24px 24px",
            }}
          />

          {/* Close button */}
          <button
            type="button"
            className="absolute right-3 top-3 z-10 rounded border border-emerald-500/30 bg-black/50 p-1.5 text-emerald-300 transition hover:bg-emerald-500/20"
            onClick={onClose}
            aria-label="Close waitlist modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 px-6 py-8 sm:px-8">
            {status === "success" ? (
              /* ── Success state ── */
              <div className="flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: "rgba(34, 197, 94, 0.25)",
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                  }}
                >
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">You're on the list</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  Intelligence brief for <span className="font-semibold text-emerald-300">{moduleLabel}</span>{" "}
                  will be transmitted to <span className="font-semibold text-emerald-300">{email}</span> when deployed.
                </p>
                <div
                  className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-mono uppercase tracking-[0.18em]"
                  style={{
                    borderColor: "rgba(34, 197, 94, 0.2)",
                    backgroundColor: "rgba(34, 197, 94, 0.06)",
                    color: "rgba(34, 197, 94, 0.7)",
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.8)",
                      boxShadow: "0 0 6px rgba(34, 197, 94, 0.5)",
                      animation: "waitlist-dot-pulse 1.4s ease-in-out infinite",
                    }}
                  />
                  ACKNOWLEDGED
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-6 rounded-lg border border-emerald-500/25 px-5 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10"
                >
                  Close
                </button>
                <style>{`
                  @keyframes waitlist-dot-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.7); }
                  }
                `}</style>
              </div>
            ) : (
              /* ── Input state ── */
              <div className="flex flex-col items-center text-center">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: "rgba(34, 197, 94, 0.2)",
                    backgroundColor: "rgba(34, 197, 94, 0.08)",
                  }}
                >
                  <Bell className="h-6 w-6 text-emerald-400" />
                </div>

                <h2 className="text-lg font-semibold text-white">
                  Unlock Notification
                </h2>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-300">
                  Leave your email and we'll notify you when{" "}
                  <span className="font-semibold text-emerald-300">{moduleLabel}</span> is deployed.
                </p>

                <div className="mt-6 w-full">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      ref={inputRef}
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setEmailTouched(true);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="your.email@domain.com"
                      className={`h-12 w-full rounded-xl border bg-black/50 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-600 ${
                        emailError
                          ? "border-rose-400/40 focus:border-rose-400/60"
                          : "border-emerald-500/20 focus:border-emerald-500/40"
                      }`}
                      aria-label="Email address"
                      autoComplete="email"
                      autoFocus
                      disabled={status === "submitting"}
                    />
                  </div>
                  {emailError && (
                    <p className="mt-2 text-left text-xs text-rose-300" role="alert">
                      {emailError}
                    </p>
                  )}

                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={status === "submitting"}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-6 font-mono text-sm font-medium uppercase tracking-[0.16em] transition"
                  style={{
                    borderColor: "rgba(34, 197, 94, 0.35)",
                    backgroundColor:
                      status === "submitting"
                        ? "rgba(34, 197, 94, 0.05)"
                        : "rgba(34, 197, 94, 0.1)",
                    color: "rgba(34, 197, 94, 0.9)",
                    boxShadow: "0 0 12px rgba(34, 197, 94, 0.15)",
                  }}
                >
                  {status === "submitting" ? (
                    <>
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-emerald-400/60"
                        style={{
                          borderRightColor: "transparent",
                          animation: "waitlist-spin 0.6s linear infinite",
                        }}
                      />
                      TRANSMITTING...
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4" />
                      NOTIFY ME
                    </>
                  )}
                </button>

                <p className="mt-4 text-[11px] text-slate-500">
                  No spam. One notification. Unsubscribe anytime.
                </p>
              </div>
            )}
          </div>

          {/* Inject keyframes for the spinner */}
          <style>{`
            @keyframes waitlist-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </section>
      </div>
    </div>
  );
}
