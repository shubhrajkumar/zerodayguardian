import type { GamificationSnapshot } from "@/lib/gamificationSystem";

interface StreakCounterProps {
  snapshot: GamificationSnapshot;
}

export default function StreakCounter({ snapshot }: StreakCounterProps) {
  const { streakDays, completedDays } = snapshot;
  const isOnFire = streakDays >= 7;

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <span
            className="text-3xl"
            style={{
              animation: isOnFire ? "float 2s ease-in-out infinite" : undefined,
              filter: isOnFire ? "drop-shadow(0 0 8px rgba(255,107,53,0.5))" : undefined,
            }}
          >
            🔥
          </span>
          {isOnFire && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--theme-accent-orange)] text-[8px] font-bold text-white animate-pulse">
              !
            </span>
          )}
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold" style={{ color: "var(--theme-text)" }}>
            {streakDays} {streakDays === 1 ? "day" : "days"}
          </p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            {isOnFire ? "On fire! Keep going!" : "Daily streak"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--theme-overlay)" }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--theme-text-dim)" }}>Total Days</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--theme-text)" }}>{completedDays}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--theme-overlay)" }}>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--theme-text-dim)" }}>Best Streak</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--theme-text)" }}>{Math.max(streakDays, completedDays)}</p>
        </div>
      </div>
    </div>
  );
}
