import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap } from "lucide-react";
import { getLevelLabel, type GamificationSnapshot } from "@/lib/gamificationSystem";

// Cyber Rationale: UserProgress interface with fallback values ensures
// the component always has valid data even when the backend returns empty/undefined.
export interface UserProgress {
  /** Current XP amount */
  xp: number;
  /** Current level number */
  level: number;
  /** XP needed to reach next level */
  xpToNext: number;
  /** XP accumulated in current level */
  xpIntoLevel: number;
}

// Cyber Rationale: Motivational quotes for empty state — positive framing
// increases user motivation and daily logins (behavioral psychology).
const MOTIVATIONAL_QUOTES = [
  "Every elite hacker started with a single terminal.",
  "The best time to start was yesterday. The next best time is now.",
  "Your first port scan is one command away.",
  "Zero days start with zero XP. Let's fix that.",
];

interface XPBarProps {
  snapshot: GamificationSnapshot;
}

// ── Circular Progress Ring (SVG) ──
function ProgressRing({ current, target, size = 64 }: { current: number; target: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const offset = circumference - pct * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" role="img" aria-label={`${current} of ${target} XP completed`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--theme-accent-blue)" strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold" style={{ color: "var(--theme-text)" }}>{current}</span>
        <span className="text-[8px]" style={{ color: "var(--theme-text-dim)" }}>/{target}</span>
      </div>
    </div>
  );
}

// ── Empty State (0 XP) ──
function EmptyStateCard({ progress }: { progress: UserProgress }) {
  const navigate = useNavigate();
  // Cyber Rationale: Deterministic quote selection based on date
  const quoteIndex = new Date().getDate() % MOTIVATIONAL_QUOTES.length;
  const quote = MOTIVATIONAL_QUOTES[quoteIndex];
  const targetXp = progress.xpToNext || 600;

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5">
      <div className="flex items-center gap-4">
        <ProgressRing current={progress.xp} target={targetXp} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-blue)" }} />
            <p className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>
              {progress.xp}/{targetXp} XP to White Hat
            </p>
          </div>
          <p className="text-[11px] italic leading-snug" style={{ color: "var(--theme-text-dim)" }}>
            "{quote}"
            <span className="not-italic block mt-0.5" style={{ color: "var(--theme-accent-blue)" }}>- Zorvix</span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate("/program")}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-90"
        style={{ backgroundColor: "var(--theme-accent-blue)", color: "var(--theme-bg)" }}
        aria-label="Start Day 1 Lab"
      >
        Start Day 1 Lab
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function XPBar({ snapshot }: XPBarProps) {
  const { level, xpIntoLevel, xpToNextLevel, totalXp } = snapshot;
  const progress = useMemo(() => {
    const total = xpIntoLevel + xpToNextLevel;
    return total > 0 ? Math.min(100, Math.round((xpIntoLevel / total) * 100)) : 0;
  }, [xpIntoLevel, xpToNextLevel]);

  const label = getLevelLabel(level);

  // Cyber Rationale: Detect empty state and show motivating card instead of raw "0 XP"
  const isEmpty = totalXp === 0 && level <= 1;
  if (isEmpty) {
    return <EmptyStateCard progress={{ xp: totalXp, level, xpToNext: xpToNextLevel, xpIntoLevel }} />;
  }

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
