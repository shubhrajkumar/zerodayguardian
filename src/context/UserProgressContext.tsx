import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getStoredAccessToken } from "@/lib/apiClient";
import api from "@/lib/api";
import { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";

type DashboardPayload = {
  intelligence: {
    xp: number;
    rank: string;
    streak: number;
    completedLabs: number;
    totalLabsTouched: number;
    achievements?: string[];
    badges?: Array<{ id: string; label: string; earned: boolean; progress: number; detail: string }>;
    gamification?: {
      totalActions: number;
      todayActions: number;
      xpToNextRank: number;
      nextRank: string;
      trackedIntents: string[];
    };
    skillGraph?: {
      nodes: Array<{
        id: string;
        label: string;
        score: number;
        exposureCount: number;
        successRate: number;
        completedLabs: number;
        level: string;
        gap: number;
        recommendation: string;
      }>;
      strongest: Array<{ id: string; label: string; score: number }>;
      weakest: Array<{ id: string; label: string; score: number; gap: number }>;
      recommendedPath: Array<{ skillId: string; label: string; priority: string; action: string }>;
    };
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
  achievements: string[];
  badges: Array<{ id: string; label: string; earned: boolean; progress: number; detail: string }>;
  totalActions: number;
  todayActions: number;
  xpToNextRank: number;
  nextRank: string;
  skillGraph: {
    nodes: Array<{
      id: string;
      label: string;
      score: number;
      exposureCount: number;
      successRate: number;
      completedLabs: number;
      level: string;
      gap: number;
      recommendation: string;
    }>;
    strongest: Array<{ id: string; label: string; score: number }>;
    weakest: Array<{ id: string; label: string; score: number; gap: number }>;
    recommendedPath: Array<{ skillId: string; label: string; priority: string; action: string }>;
  };
};

type UserProgressContextValue = {
  progress: UserProgress;
  loading: boolean;
  refreshProgress: () => Promise<void>;
  applyOptimisticProgress: (patch: Partial<UserProgress>) => void;
  applyServerProgression: (profile?: Partial<ProgressionPayload["profile"]> | null) => void;
  trackAction: (payload: {
    type: string;
    query?: string;
    tool?: string;
    durationMs?: number;
    depth?: number;
    success?: boolean;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
};

const defaultProgress: UserProgress = {
  xp: 1280,
  rank: "Cyber Sentinel",
  streak: 7,
  completedLabs: 3,
  totalLabsTouched: 8,
  points: 960,
  level: 4,
  achievements: ["First Lab", "Steady Learner"],
  badges: [
    { id: "first-lab", label: "First Lab Cleared", earned: true, progress: 100, detail: "Completed your first cybersecurity lab" },
    { id: "streak-7", label: "Week Warrior", earned: true, progress: 100, detail: "Maintained a 7-day streak" },
    { id: "level-4", label: "Level 4 Analyst", earned: true, progress: 100, detail: "Reached Level 4" },
  ],
  totalActions: 47,
  todayActions: 3,
  xpToNextRank: 720,
  nextRank: "Elite Guardian",
  skillGraph: {
    nodes: [],
    strongest: [],
    weakest: [],
    recommendedPath: [],
  },
};

// Telemetry batching — collect events and send in batches
const TELEMETRY_BATCH_INTERVAL = 30000; // 30 seconds
const TELEMETRY_MAX_BATCH = 10;
let telemetryBatch: Array<{ type: string; query?: string; tool?: string; durationMs?: number; depth?: number; success?: boolean; metadata?: Record<string, unknown> }> = [];
let telemetryTimer: ReturnType<typeof setTimeout> | null = null;

const flushTelemetryBatch = async () => {
  if (telemetryBatch.length === 0) return;
  const batch = telemetryBatch.splice(0, TELEMETRY_MAX_BATCH);
  telemetryBatch = telemetryBatch.slice(TELEMETRY_MAX_BATCH);
  try {
    const token = localStorage.getItem('zdg_token');
    if (!token) return;
    await fetch(`${import.meta.env.VITE_API_URL}/api/intelligence/telemetry/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ batch, events: batch.length, timestamp: Date.now() }),
    });
  } catch {
    // Telemetry is best-effort
  }
};

const scheduleTelemetryFlush = () => {
  if (telemetryTimer) clearTimeout(telemetryTimer);
  telemetryTimer = setTimeout(() => {
    flushTelemetryBatch();
    if (telemetryBatch.length > 0) scheduleTelemetryFlush();
  }, TELEMETRY_BATCH_INTERVAL);
};

const UserProgressContext = createContext<UserProgressContextValue | null>(null);

export const UserProgressProvider = ({ children }: { children: ReactNode }) => {
  const { authState, isAuthenticated } = useAuth();
  const [progress, setProgress] = useState<UserProgress>(defaultProgress);
  const [loading, setLoading] = useState(false);

  const refreshProgress = useCallback(async () => {
    if (authState === "loading") return;
    if (!isAuthenticated || !getStoredAccessToken()) {
      setProgress(defaultProgress);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [dashRes, progRes] = await Promise.all([
        api.get<DashboardPayload>("/api/intelligence/dashboard"),
        api.get<ProgressionPayload>("/api/intelligence/progression/me"),
      ]);
      const dash = dashRes.data;
      const prog = progRes.data;
      setProgress((prev) => ({
        ...prev,
        xp: Number(dash?.intelligence?.xp || 0),
        rank: String(prog?.profile?.rank || dash?.intelligence?.rank || prev.rank),
        streak: Number(dash?.intelligence?.streak || prev.streak),
        completedLabs: Number(dash?.intelligence?.completedLabs || prog?.profile?.completedLabs || 0),
        totalLabsTouched: Number(dash?.intelligence?.totalLabsTouched || prev.totalLabsTouched),
        points: Number(prog?.profile?.points || prev.points),
        level: Math.max(1, Number(prog?.profile?.level || prev.level)),
        achievements: Array.isArray(dash?.intelligence?.achievements) ? dash.intelligence.achievements : prev.achievements,
        badges: Array.isArray(dash?.intelligence?.badges) ? dash.intelligence.badges : prev.badges,
        totalActions: Number(dash?.intelligence?.gamification?.totalActions || prev.totalActions),
        todayActions: Number(dash?.intelligence?.gamification?.todayActions || prev.todayActions),
        xpToNextRank: Number(dash?.intelligence?.gamification?.xpToNextRank || prev.xpToNextRank),
        nextRank: String(dash?.intelligence?.gamification?.nextRank || prev.nextRank),
        skillGraph: dash?.intelligence?.skillGraph || prev.skillGraph,
      }));
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status && [401, 403].includes(error.response.status)) {
        setProgress(defaultProgress);
        return;
      }
      // keep current state to avoid UI flicker on transient backend issues
    } finally {
      setLoading(false);
    }
  }, [authState, isAuthenticated]);

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
      next.totalActions = Math.max(0, Number(next.totalActions || 0));
      next.todayActions = Math.max(0, Number(next.todayActions || 0));
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

  const trackAction = useCallback(async (payload: {
    type: string;
    query?: string;
    tool?: string;
    durationMs?: number;
    depth?: number;
    success?: boolean;
    metadata?: Record<string, unknown>;
  }) => {
    if (!getStoredAccessToken()) return;
    
    // Queue into batch instead of sending immediately
    telemetryBatch.push(payload);
    if (telemetryBatch.length >= TELEMETRY_MAX_BATCH) {
      flushTelemetryBatch();
    } else if (!telemetryTimer) {
      scheduleTelemetryFlush();
    }
    
    // Update local state optimistically
    setProgress((prev) => ({
      ...prev,
      totalActions: prev.totalActions + 1,
      todayActions: prev.todayActions + 1,
    }));
  }, []);

  useEffect(() => {
    refreshProgress().catch(() => undefined);
  }, [refreshProgress]);

  const value = useMemo<UserProgressContextValue>(
    () => ({ progress, loading, refreshProgress, applyOptimisticProgress, applyServerProgression, trackAction }),
    [progress, loading, refreshProgress, applyOptimisticProgress, applyServerProgression, trackAction]
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
