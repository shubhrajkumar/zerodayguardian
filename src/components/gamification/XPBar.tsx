import { useMemo } from "react";
import { getLevelLabel, type GamificationSnapshot } from "@/lib/gamificationSystem";

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

  const label = getLevelLabel(resolvedLevel);
  const progressLabel = `${progress}% progress to level ${resolvedLevel + 1}`;

  return (
    <section
      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 shadow-sm"
      aria-labelledby="xpbar-title"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${
              leveledUp ? "animate-pulse border-purple-300/70" : "border-blue-400/40"
            } bg-blue-500/10 text-blue-100`}
            aria-label={`Level ${resolvedLevel}`}
          >
            {resolvedLevel}
          </div>
          <div className="min-w-0">
            <p id="xpbar-title" className="text-sm font-semibold text-[var(--theme-text)]">
              {label}
            </p>
            <p className="text-xs text-slate-400">{totalXp.toLocaleString()} total XP</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold text-[var(--theme-text)]">
            {xpIntoLevel.toLocaleString()} / {Math.max(levelTarget, xpIntoLevel).toLocaleString()}
          </p>
          <p className="text-xs text-slate-400">
            {leveledUp ? "Level up ready" : `${remaining.toLocaleString()} XP to next level`}
          </p>
        </div>
      </div>

      <div
        className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--theme-overlay)]"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-500 transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{
            width: `${progress}%`,
            boxShadow: progress > 0 ? "0 0 18px rgba(96, 165, 250, 0.45)" : "none",
          }}
        />
      </div>

      {progress > 10 ? (
        <div
          className="pointer-events-none mt-[-0.75rem] h-3 rounded-full opacity-30"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
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
