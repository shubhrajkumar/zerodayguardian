import { useMemo } from "react";
import { useGamificationSystem, type GamificationSnapshot, type MissionScope } from "@/lib/gamificationSystem";

/**
 * Lightweight hook that wraps `useGamificationSystem` with ergonomic helpers.
 *
 * Usage:
 * ```tsx
 * const { snapshot, loading, completeMission } = useGamification(userId, handle);
 * ```
 */
export default function useGamification(userId?: string | null, handle?: string | null) {
  const {
    snapshot,
    loading,
    error,
    latestReward,
    refresh,
    clearLatestReward,
    completeMission,
    submitQuizAnswer,
  } = useGamificationSystem(userId, handle);

  /** Whether the user has an active daily streak (≥ 1 day) */
  const hasActiveStreak = snapshot.streakDays > 0;

  /** Whether the streak is on fire (≥ 7 days) */
  const isOnFire = snapshot.streakDays >= 7;

  /** Progress percentage toward the next level (0-100) */
  const levelProgress = useMemo(() => {
    const total = snapshot.xpIntoLevel + snapshot.xpToNextLevel;
    return total > 0 ? Math.min(100, Math.round((snapshot.xpIntoLevel / total) * 100)) : 0;
  }, [snapshot.xpIntoLevel, snapshot.xpToNextLevel]);

  /** Total earned badges count */
  const earnedBadgeCount = snapshot.badges.length;

  /** Whether the backend service is live */
  const isServiceReady = snapshot.serviceStatus === "ready";

  return {
    snapshot,
    loading,
    error,
    latestReward,
    hasActiveStreak,
    isOnFire,
    levelProgress,
    earnedBadgeCount,
    isServiceReady,
    refresh,
    clearLatestReward,
    completeMission,
    submitQuizAnswer,
  };
}

export type { GamificationSnapshot, MissionScope };
