import { createContext, useContext, type ReactNode } from "react";
import useGamification from "@/hooks/useGamification";
import type { GamificationSnapshot } from "@/lib/gamificationSystem";

interface GamificationContextValue {
  snapshot: GamificationSnapshot;
  loading: boolean;
  error: string;
  hasActiveStreak: boolean;
  isOnFire: boolean;
  levelProgress: number;
  earnedBadgeCount: number;
  isServiceReady: boolean;
  refresh: () => Promise<void>;
  completeMission: (scope: "daily" | "weekly", missionId: string) => Promise<GamificationSnapshot | null>;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

interface GamificationProviderProps {
  userId?: string | null;
  handle?: string | null;
  children: ReactNode;
}

/**
 * Wraps the gamification system in a React context so any descendant
 * can consume gamification state without prop-drilling.
 *
 * ```tsx
 * <GamificationProvider userId={user.id} handle={user.name}>
 *   <App />
 * </GamificationProvider>
 * ```
 */
export function GamificationProvider({ userId, handle, children }: GamificationProviderProps) {
  const value = useGamification(userId, handle);

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

/**
 * Access gamification state from any component inside `<GamificationProvider>`.
 * Throws if used outside the provider.
 */
export function useGamificationContext(): GamificationContextValue {
  const ctx = useContext(GamificationContext);
  if (!ctx) {
    throw new Error("useGamificationContext must be used within a <GamificationProvider>");
  }
  return ctx;
}
