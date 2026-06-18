import { useMemo } from "react";
import { getLevelLabel, getRankIcon, type GamificationSnapshot } from "@/lib/gamificationSystem";

export interface XPBarProps {
  /** Full gamification snapshot used by the existing dashboard/profile flows. */
  snapshot?: GamificationSnapshot;
  /** Current XP earned inside the active level. */
  currentXP?: number;
  /** Current student level. */
  level?: number;
  /** Remaining XP required for the next level. */
  xpToNextLevel?: number;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/**
 * Displays level, XP totals, and an animated cyberpunk progress meter.
 *
 * The component accepts either a `GamificationSnapshot` or the direct props
 * requested by the public component API.
 */
export default function XPBar({ snapshot, currentXP, level, xpToNextLevel }: XPBarProps) {
  const resolvedLevel = Math.max(1, Number(level ?? snapshot?.level ?? 1));
  const xpIntoLevel = Math.max(0, Number(currentXP ?? snapshot?.xpIntoLevel ?? snapshot?.totalXp ?? 0));
  const remaining = Math.max(0, Number(xpToNextLevel ?? snapshot?.xpToNextLevel ?? 0));
  const totalXp = Math.max(0, Number(snapshot?.totalXp ?? xpIntoLevel));
  const levelTarget = xpIntoLevel + remaining;
  const leveledUp = levelTarget > 0 && xpIntoLevel >= levelTarget;

  const progress = useMemo(() => {
    if (leveledUp) return 100;
    if (levelTarget <= 0) return 0;
    return clampPercent((xpIntoLevel / levelTarget) * 100);
  }, [levelTarget, leveledUp, xpIntoLevel]);

  const rankIcon = getRankIcon(resolvedLevel);
  const label = getLevelLabel(resolvedLevel);
  const progressLabel = `${progress}% progress to level ${resolvedLevel + 1}`;

  return (
    <section
      className="rounded-xl border border-slate-800/50 bg-slate-900/40 p-4 hologram-card"
      aria-labelledby="xpbar-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-lg ${
              leveledUp ? "animate-bounce-glow border-emerald-400/60 bg-emerald-500/20" : "border-emerald-500/30 bg-emerald-500/10"
            }`}
            aria-label={`Level ${resolvedLevel} — ${label}`}
          >
            <span className={leveledUp ? "animate-scale-in" : ""}>{rankIcon}</span>
          </div>
          <div className="min-w-0">
            <p id="xpbar-title" className="text-sm font-semibold text-slate-100">
              {label}
            </p>
            <p className="text-xs text-slate-500 font-mono">{totalXp.toLocaleString()} total XP</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-slate-100 font-mono">
            {xpIntoLevel.toLocaleString()} <span className="text-slate-500">/</span> {Math.max(levelTarget, xpIntoLevel).toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 font-mono">
            {leveledUp ? "⏫ Promotion ready" : `${remaining.toLocaleString()} XP to next level`}
          </p>
        </div>
      </div>

      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800/50"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-300 transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{
            width: `${progress}%`,
            boxShadow: progress > 0 ? "0 0 14px rgba(52, 211, 153, 0.3)" : "none",
          }}
        />
      </div>

      {progress > 10 ? (
        <div
          className="pointer-events-none mt-[-0.65rem] h-2.5 rounded-full opacity-25"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            animation: "shimmer 2s infinite",
            backgroundSize: "200% 100%",
          }}
          aria-hidden="true"
        />
      ) : null}

      <p className="sr-only" aria-live="polite">
        {leveledUp ? `Level ${resolvedLevel + 1} is ready to unlock.` : progressLabel}
      </p>
    </section>
  );
}
