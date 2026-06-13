import { useEffect, useMemo, useState } from "react";
import type { GamificationSnapshot } from "@/lib/gamificationSystem";

const STORAGE_KEY = "zdg_gamification_streak";

interface StoredStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
}

export interface StreakCounterProps {
  /** Full gamification snapshot used by current app pages. */
  snapshot?: GamificationSnapshot;
  /** Consecutive active learning days. */
  currentStreak?: number;
  /** Longest streak ever achieved by the learner. */
  longestStreak?: number;
}

const todayKey = () => new Date().toISOString().slice(0, 10);

const previousDayKey = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

const readStoredStreak = (): StoredStreak | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredStreak) : null;
  } catch {
    return null;
  }
};

const writeStoredStreak = (value: StoredStreak) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Streaks are motivational only; storage failures should never block UI.
  }
};

const normalizeStoredStreak = (fallbackCurrent: number, fallbackLongest: number): StoredStreak => {
  const stored = readStoredStreak();
  const today = todayKey();
  if (!stored) {
    return { currentStreak: fallbackCurrent, longestStreak: fallbackLongest, lastActivityDate: today };
  }
  if (stored.lastActivityDate === today || stored.lastActivityDate === previousDayKey()) {
    return {
      currentStreak: Math.max(0, Number(stored.currentStreak || 0)),
      longestStreak: Math.max(fallbackLongest, Number(stored.longestStreak || 0)),
      lastActivityDate: stored.lastActivityDate,
    };
  }
  return {
    currentStreak: 0,
    longestStreak: Math.max(fallbackLongest, Number(stored.longestStreak || 0)),
    lastActivityDate: stored.lastActivityDate,
  };
};

/**
 * Shows the learner's current and best daily learning streak.
 *
 * Direct props are supported for standalone use; `snapshot` keeps existing
 * dashboard/profile integrations working.
 */
export default function StreakCounter({ snapshot, currentStreak, longestStreak }: StreakCounterProps) {
  const explicitCurrent = Math.max(0, Number(currentStreak ?? snapshot?.streakDays ?? 0));
  const explicitLongest = Math.max(explicitCurrent, Number(longestStreak ?? snapshot?.completedDays ?? explicitCurrent));
  const [stored, setStored] = useState<StoredStreak>(() => normalizeStoredStreak(explicitCurrent, explicitLongest));

  useEffect(() => {
    const next = {
      currentStreak: explicitCurrent,
      longestStreak: Math.max(explicitLongest, explicitCurrent, stored.longestStreak),
      lastActivityDate: todayKey(),
    };
    setStored(next);
    writeStoredStreak(next);
    // We intentionally do not depend on `stored` to avoid writing every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitCurrent, explicitLongest]);

  const current = currentStreak !== undefined || snapshot ? explicitCurrent : stored.currentStreak;
  const best = longestStreak !== undefined || snapshot ? explicitLongest : stored.longestStreak;
  const active = current > 0;
  const isOnFire = current >= 7;

  const status = useMemo(() => {
    if (isOnFire) return "On fire! Keep going!";
    if (active) return "Daily streak";
    return "Streak paused";
  }, [active, isOnFire]);

  return (
    <section
      className={`rounded-2xl border p-4 ${
        active
          ? "border-emerald-400/25 bg-emerald-400/5"
          : "border-[var(--theme-border)] bg-[var(--theme-surface)]"
      }`}
      aria-labelledby="streak-title"
    >
      <div className="flex items-center gap-3">
        <div className="relative" aria-hidden="true">
          <span
            className="block text-3xl"
            style={{
              animation: active ? "float 2s ease-in-out infinite" : undefined,
              filter: active ? "drop-shadow(0 0 10px rgba(34,197,94,0.35))" : "grayscale(1)",
            }}
          >
            🔥
          </span>
          {isOnFire ? (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[8px] font-bold text-black animate-pulse">
              !
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p id="streak-title" className="text-2xl font-bold text-[var(--theme-text)]">
            {current} {current === 1 ? "day" : "days"}
          </p>
          <p className={active ? "text-xs text-emerald-200" : "text-xs text-slate-400"}>{status}</p>
        </div>

        <button
          type="button"
          className="rounded-full border border-[var(--theme-border)] px-2 py-1 text-xs text-slate-300"
          title="Complete at least one learning action per calendar day to keep your streak active."
          aria-label="How streaks work"
        >
          ?
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[var(--theme-overlay)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Days</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--theme-text)]">{snapshot?.completedDays ?? current}</p>
        </div>
        <div className="rounded-xl bg-[var(--theme-overlay)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Best Streak</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--theme-text)]">{best}</p>
        </div>
      </div>
    </section>
  );
}
