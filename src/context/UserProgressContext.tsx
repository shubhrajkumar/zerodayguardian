import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGetJson } from "@/lib/apiClient";

type DashboardPayload = {
  intelligence: {
    xp: number;
    rank: string;
    streak: number;
    completedLabs: number;
    totalLabsTouched: number;
  };
};

type ProgressionPayload = {
  profile: {
    points: number;
    rank: string;
    level: number;
    completedLabs: number;
  };
};

type UserProgress = {
  xp: number;
  rank: string;
  streak: number;
  completedLabs: number;
  totalLabsTouched: number;
  points: number;
  level: number;
};

type UserProgressContextValue = {
  progress: UserProgress;
  loading: boolean;
  refreshProgress: () => Promise<void>;
  applyOptimisticProgress: (patch: Partial<UserProgress>) => void;
  applyServerProgression: (profile?: Partial<ProgressionPayload["profile"]> | null) => void;
};

const defaultProgress: UserProgress = {
  xp: 0,
  rank: "Recruit",
  streak: 1,
  completedLabs: 0,
  totalLabsTouched: 0,
  points: 0,
  level: 1,
};

const UserProgressContext = createContext<UserProgressContextValue | null>(null);

export const UserProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState<UserProgress>(defaultProgress);
  const [loading, setLoading] = useState(false);

  const refreshProgress = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, prog] = await Promise.all([
        apiGetJson<DashboardPayload>("/api/intelligence/dashboard"),
        apiGetJson<ProgressionPayload>("/api/intelligence/progression/me"),
      ]);
      setProgress((prev) => ({
        ...prev,
        xp: Number(dash?.intelligence?.xp || 0),
        rank: String(prog?.profile?.rank || dash?.intelligence?.rank || prev.rank),
        streak: Number(dash?.intelligence?.streak || prev.streak),
        completedLabs: Number(dash?.intelligence?.completedLabs || prog?.profile?.completedLabs || 0),
        totalLabsTouched: Number(dash?.intelligence?.totalLabsTouched || prev.totalLabsTouched),
        points: Number(prog?.profile?.points || prev.points),
        level: Math.max(1, Number(prog?.profile?.level || prev.level)),
      }));
    } catch {
      // no-op: keep current state to avoid UI flicker
    } finally {
      setLoading(false);
    }
  }, []);

  const applyOptimisticProgress = useCallback((patch: Partial<UserProgress>) => {
    setProgress((prev) => {
      const next: UserProgress = {
        ...prev,
        ...patch,
      };
      next.xp = Math.max(0, Number(next.xp || 0));
      next.points = Math.max(0, Number(next.points || 0));
      next.level = Math.max(1, Number(next.level || 1));
      next.completedLabs = Math.max(0, Number(next.completedLabs || 0));
      next.totalLabsTouched = Math.max(next.completedLabs, Number(next.totalLabsTouched || 0));
      return next;
    });
  }, []);

  const applyServerProgression = useCallback((profile?: Partial<ProgressionPayload["profile"]> | null) => {
    if (!profile) return;
    setProgress((prev) => ({
      ...prev,
      rank: String(profile.rank || prev.rank),
      points: Number(profile.points || prev.points),
      level: Math.max(1, Number(profile.level || prev.level)),
      completedLabs: Math.max(prev.completedLabs, Number(profile.completedLabs || 0)),
      totalLabsTouched: Math.max(prev.totalLabsTouched, Number(profile.completedLabs || 0)),
    }));
  }, []);

  useEffect(() => {
    refreshProgress().catch(() => undefined);
  }, [refreshProgress]);

  const value = useMemo<UserProgressContextValue>(
    () => ({ progress, loading, refreshProgress, applyOptimisticProgress, applyServerProgression }),
    [progress, loading, refreshProgress, applyOptimisticProgress, applyServerProgression]
  );

  return <UserProgressContext.Provider value={value}>{children}</UserProgressContext.Provider>;
};

export const useUserProgress = () => {
  const context = useContext(UserProgressContext);
  if (!context) {
    throw new Error("useUserProgress must be used within UserProgressProvider");
  }
  return context;
};
