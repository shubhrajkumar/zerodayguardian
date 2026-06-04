import { useMemo } from "react";
import type { GamificationSnapshot } from "@/lib/gamificationSystem";

interface XPBarProps {
  snapshot: GamificationSnapshot;
}

const levelLabels = ["", "Rookie", "Novice", "Initiate", "Apprentice", "Operative", "Specialist", "Elite", "Expert", "Master", "Legend"];

const getLevelLabel = (level: number) => levelLabels[Math.min(level, levelLabels.length - 1)] || `Level ${level}`;

export default function XPBar({ snapshot }: XPBarProps) {
  const { level, xpIntoLevel, xpToNextLevel, totalXp } = snapshot;
  const progress = useMemo(() => {
    const total = xpIntoLevel + xpToNextLevel;
    return total > 0 ? Math.min(100, Math.round((xpIntoLevel / total) * 100)) : 0;
  }, [xpIntoLevel, xpToNextLevel]);

  const label = getLevelLabel(level);

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-accent-blue)]/30 bg-[var(--theme-accent-blue)]/10 text-xs font-bold" style={{ color: "var(--theme-accent-blue)" }}>
            {level}
          </span>
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>{label}</p>
            <p className="text-[10px]" style={{ color: "var(--theme-text-dim)" }}>{totalXp.toLocaleString()} total XP</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium" style={{ color: "var(--theme-text)" }}>{xpIntoLevel.toLocaleString()} / {(xpIntoLevel + xpToNextLevel).toLocaleString()}</p>
          <p className="text-[10px]" style={{ color: "var(--theme-text-dim)" }}>{xpToNextLevel.toLocaleString()} XP to next level</p>
        </div>
      </div>

      <div className="relative h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--theme-overlay)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, var(--theme-accent-blue), var(--theme-accent-purple))",
            boxShadow: progress > 0 ? "0 0 12px var(--theme-glow)" : "none",
          }}
        />
        {progress > 10 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-40"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
              animation: "shimmer 2s infinite",
              backgroundSize: "200% 100%",
            }}
          />
        )}
      </div>
    </div>
  );
}
