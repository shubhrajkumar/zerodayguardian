/**
 * LockedModule — Gamified "Coming Soon / Locked" state for empty course & lab sections.
 *
 * Replaces plain "0 visible" / "No results" text with a cyber-theme lockout card
 * featuring a glowing emerald border, animated padlock icon, decrypt/deploy progress
 * bar, and tactical micro-copy that keeps the operator engaged.
 *
 * Usage:
 *   <LockedModule
 *     label="Combat Labs"
 *     variant="decrypting"
 *     message="Sector Locked: Intelligence briefing under construction. Standby, Operator."
 *   />
 *
 * Variants:
 *   - "decrypting" — shows "DECRYPTING: 0%" with animated glitch bar
 *   - "deploying"  — shows "DEPLOYING CONTENT..." with pulsing bar
 */
import { useEffect, useRef, useState } from "react";
import { Bell, Lock, Shield, Terminal } from "lucide-react";
import WaitlistModal from "./WaitlistModal";

type LockVariant = "decrypting" | "deploying";

interface LockedModuleProps {
  /** The sector or module name (e.g. "Combat Labs", "Advanced Courses") */
  label?: string;
  /** Visual variant: decrypting (static %) vs deploying (animated bar) */
  variant?: LockVariant;
  /** Custom micro-copy — overrides the default per-variant message */
  message?: string;
  /** Whether to show the "Notify Me" CTA button below the micro-copy */
  showNotifyButton?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_MESSAGES: Record<LockVariant, string> = {
  decrypting: "Sector Locked: Intelligence briefing under construction. Standby, Operator.",
  deploying: "Access Restricted: Content deployment in progress. ETA unknown.",
};

export default function LockedModule({
  label = "Module",
  variant = "decrypting",
  message,
  showNotifyButton = true,
  className = "",
}: LockedModuleProps) {
  const [mounted, setMounted] = useState(false);
  const [mountGlitch, setMountGlitch] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount entrance: brief delay then glitch reveal, then stagger in
  useEffect(() => {
    const mountTimer = setTimeout(() => {
      setMountGlitch(true);
      // Brief glitch burst on mount
      setTimeout(() => setMountGlitch(false), 320);
      // After glitch settles, start stagger entrance
      setTimeout(() => setMounted(true), 380);
    }, 80);
    return () => clearTimeout(mountTimer);
  }, []);

  // Decrypting variant: tick progress from 0 → 4% in tiny increments, then micro-bursts
  useEffect(() => {
    if (variant !== "decrypting") return;

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 4.2) return prev; // cap at ~4%

        // Random step: 0.02–0.18% per tick, weighted toward lower end
        const step = 0.02 + Math.random() * 0.16;
        const next = +(prev + step).toFixed(2);
        return Math.min(next, 4.2);
      });
    }, 900 + Math.random() * 600);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [variant]);

  // Glitch effect: random flickers on the padlock icon
  useEffect(() => {
    const scheduleNext = () => {
      glitchTimerRef.current = setTimeout(() => {
        setGlitchActive(true);
        const duration = 60 + Math.random() * 180;
        setTimeout(() => {
          setGlitchActive(false);
          scheduleNext();
        }, duration);
      }, 2800 + Math.random() * 4000);
    };
    scheduleNext();

    return () => {
      if (glitchTimerRef.current) clearTimeout(glitchTimerRef.current);
    };
  }, []);

  const variantMessage = message || DEFAULT_MESSAGES[variant];

  const stagger = (index: number): React.CSSProperties =>
    mounted
      ? { animation: `entrance-fade-up 0.45s ease-out ${index * 0.09}s both` }
      : { opacity: 0 };

  return (
    <>
    <div
      className={`relative flex min-h-[280px] w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border px-6 py-10 text-center transition-all duration-[400ms] ${className}`}
      style={{
        borderColor: mountGlitch
          ? "rgba(34, 197, 94, 0.6)"
          : "rgba(34, 197, 94, 0.25)",
        backgroundColor: "rgba(5, 9, 20, 0.95)",
        boxShadow: mountGlitch
          ? "0 0 30px rgba(34, 197, 94, 0.4), 0 0 60px rgba(34, 197, 94, 0.15)"
          : "0 0 15px rgba(34, 197, 94, 0.2), inset 0 0 60px rgba(34, 197, 94, 0.03)",
        opacity: mountGlitch ? 0.7 : 1,
        transform: mountGlitch
          ? "translateX(3px) skewX(-1deg) scale(0.98)"
          : "none",
        filter: mountGlitch ? "hue-rotate(30deg) contrast(1.3)" : "none",
      }}
      role="status"
      aria-label={`${label} — locked`}
    >
      {/* Grid scan-line overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34, 197, 94, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 197, 94, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
          animation: mountGlitch
            ? "mount-glitch-bg 0.3s ease-in-out"
            : "none",
        }}
      />

      {/* Top-left corner bracket decoration */}
      <div
        className="pointer-events-none absolute left-3 top-3 h-4 w-4"
        aria-hidden="true"
      >
        <div className="absolute left-0 top-0 h-3 w-px bg-emerald-500/30" />
        <div className="absolute left-0 top-0 h-px w-3 bg-emerald-500/30" />
      </div>
      {/* Bottom-right corner bracket */}
      <div
        className="pointer-events-none absolute bottom-3 right-3 h-4 w-4"
        aria-hidden="true"
      >
        <div className="absolute bottom-0 right-0 h-3 w-px bg-emerald-500/30" />
        <div className="absolute bottom-0 right-0 h-px w-3 bg-emerald-500/30" />
      </div>

      {/* Diagonal cut-through line accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          background:
            "linear-gradient(135deg, transparent 45%, rgba(34, 197, 94, 0.5) 48%, transparent 52%)",
        }}
      />

      {/* Scanner beam (subtle top-to-bottom sweep) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.4), transparent)",
          animation: "scanner-beam 3s ease-in-out infinite",
        }}
      />

      {/* ── Icon ── */}
      <div className="relative z-10 mb-5" style={stagger(0)}>
        <div
          className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border transition-all duration-200 ${
            glitchActive
              ? "border-emerald-400/60 shadow-[0_0_20px_rgba(34,197,94,0.35)]"
              : "border-emerald-500/20"
          }`}
          style={{
            backgroundColor: glitchActive
              ? "rgba(34, 197, 94, 0.12)"
              : "rgba(34, 197, 94, 0.06)",
          }}
        >
          {/* Outer ring pulse */}
          <div
            className="pointer-events-none absolute -inset-2 rounded-3xl border border-emerald-500/10"
            style={{
              animation: "lock-ring-pulse 2.4s ease-in-out infinite",
            }}
          />

          {/* Padlock icon */}
          <Lock
            className={`relative h-9 w-9 transition-all duration-100 ${
              glitchActive
                ? "text-emerald-300 drop-shadow-[0_0_8px_rgba(34,197,94,0.7)]"
                : "text-emerald-400/80"
            }`}
            style={{
              transform: glitchActive ? "translateX(2px) skewX(-2deg)" : "none",
            }}
            aria-hidden="true"
          />

          {/* Small glitch overlay lines */}
          {glitchActive && (
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
              style={{
                background:
                  "linear-gradient(180deg, transparent 30%, rgba(34,197,94,0.15) 32%, transparent 34%)",
                animation: "glitch-slice 0.08s linear infinite",
              }}
            />
          )}
        </div>

        {/* Small decorative elements around icon */}
        <div className="absolute -right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/8">
          <Shield className="h-2.5 w-2.5 text-emerald-400/50" />
        </div>
        <div className="absolute -left-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/8">
          <Terminal className="h-2 w-2 text-emerald-400/40" />
        </div>
      </div>

      {/* ── Label (e.g. "COMBAT LABS") ── */}
      <span
        className="relative z-10 mb-2 inline-block font-mono text-[11px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: "rgba(34, 197, 94, 0.7)", ...stagger(1) }}
      >
        {label}
      </span>

      {/* ── Status badge ("LOCKED" / "COMING SOON") ── */}
      <div
        className="relative z-10 mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{
          borderColor: "rgba(34, 197, 94, 0.3)",
          backgroundColor: "rgba(34, 197, 94, 0.08)",
          color: "rgba(34, 197, 94, 0.9)",
          ...stagger(2),
        }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.8)",
            boxShadow: "0 0 6px rgba(34, 197, 94, 0.5)",
            animation: "lock-dot-pulse 1.4s ease-in-out infinite",
          }}
        />
        {variant === "decrypting" ? "SECTOR LOCKED" : "ACCESS RESTRICTED"}
      </div>

      {/* ── Progress / Status Bar ── */}
      <div className="relative z-10 mb-4 w-full max-w-xs" style={stagger(3)}>
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
          <span style={{ color: "rgba(34, 197, 94, 0.6)" }}>
            {variant === "decrypting" ? "DECRYPTING" : "DEPLOYING"}
          </span>
          <span style={{ color: "rgba(34, 197, 94, 0.6)" }}>
            {variant === "decrypting" ? `${progress.toFixed(1)}%` : "CONTENT..."}
          </span>
        </div>

        <div
          className="mt-2 h-2 overflow-hidden rounded-full"
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.12)",
          }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width:
                variant === "decrypting"
                  ? `${Math.max(2, progress)}%`
                  : "42%",
              background:
                variant === "decrypting"
                  ? `linear-gradient(90deg, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.8))`
                  : `linear-gradient(90deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.6), rgba(34, 197, 94, 0.3))`,
              boxShadow: "0 0 8px rgba(34, 197, 94, 0.2)",
              backgroundSize: variant === "deploying" ? "200% 100%" : undefined,
              animation:
                variant === "deploying"
                  ? "deploy-bar-shimmer 2s ease-in-out infinite"
                  : undefined,
            }}
          />
        </div>
      </div>

      {/* ── Micro-copy message ── */}
      <p
        className="relative z-10 max-w-xs font-mono text-xs leading-relaxed"
        style={{ color: "rgba(148, 163, 184, 0.8)", ...stagger(4) }}
      >
        {variantMessage}
      </p>

      {/* ── Notify Me CTA button ── */}
      {showNotifyButton && (
        <button
          type="button"
          onClick={() => setWaitlistOpen(true)}
          className="relative z-10 mt-5 inline-flex h-9 items-center gap-2 rounded-full border px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 hover:bg-emerald-500/15 hover:shadow-[0_0_12px_rgba(34,197,94,0.2)]"
          style={{
            borderColor: "rgba(34, 197, 94, 0.25)",
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            color: "rgba(34, 197, 94, 0.85)",
            ...stagger(5),
          }}
        >
          <Bell className="h-3 w-3" />
          Notify Me
        </button>
      )}

      {/* ── Keyhole-style CSS animations injected once ── */}
      <style>{`
        @keyframes scanner-beam {
          0%, 100% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0; }
          50% { transform: translateY(320px); }
        }
        @keyframes lock-ring-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.06); }
        }
        @keyframes lock-dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes glitch-slice {
          0% { transform: translateY(0); }
          25% { transform: translateY(-1px); }
          50% { transform: translateY(1px); }
          75% { transform: translateY(-0.5px); }
          100% { transform: translateY(0); }
        }
        @keyframes deploy-bar-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes entrance-fade-up {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes mount-glitch-bg {
          0% { opacity: 0; transform: scale(1.02); }
          20% { opacity: 0.02; transform: scale(1); }
          40% { opacity: 0.06; transform: scale(1.01); }
          60% { opacity: 0.02; transform: scale(1); }
          100% { opacity: 0.04; }
        }
      `}</style>
    </div>

      {/* Waitlist modal */}
      <WaitlistModal
        open={waitlistOpen}
        moduleLabel={label}
        onClose={() => setWaitlistOpen(false)}
      />
    </>
  );
}
