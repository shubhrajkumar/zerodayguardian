import { useEffect, useState } from "react";
import type { AuthUser } from "@/context/AuthContext";

// ── Types ──

export type GreetingPeriod = "Morning" | "Afternoon" | "Evening";

export interface DashboardHeaderProps {
  /** Authenticated user; null/undefined renders guest state */
  user: AuthUser | null;
  /** Current rank label (e.g. "Recruit", "Operator") */
  rankLabel: string;
  /** Current rank icon (emoji string like "🪖") */
  rankIcon: string;
  /** Current daily streak count */
  streak: number;
}

// ── Helpers ──

/**
 * Returns the time-of-day greeting period based on the client's current hour.
 * Safe to call anywhere — returns a deterministic value per invocation.
 */
export const getGreetingPeriod = (): GreetingPeriod => {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
};

/**
 * Formats the greeting for an authenticated user.
 * Example: "Good Morning, Agent Phoenix"
 */
export const formatGreeting = (period: GreetingPeriod, name: string): string =>
  `Good ${period}, ${name}`;

/**
 * Formats the rank sub-text.
 */
export const formatRankLine = (rankIcon: string, rankLabel: string): string =>
  `${rankIcon} ${rankLabel}`;

/**
 * Formats the streak sub-text.
 * - 0: amber-toned "Inactive" with deploy prompt
 * - > 0: neutral "X Days Active"
 */
export const formatStreakLine = (streak: number): string =>
  streak > 0
    ? `${streak} Day${streak === 1 ? "" : "s"} Active`
    : "Inactive — Deploy a lab to start";

// ── Component ──

/**
 * DashboardHeader renders a greeting block for the command center header.
 *
 * **Guest state** — shows "System Access: Guest Operator"
 * **Authenticated state** — shows time-of-day greeting + username
 * **Sub-text** — always shows rank and streak
 *
 * @example
 * ```tsx
 * <DashboardHeader
 *   user={user}
 *   rankLabel="Operator"
 *   rankIcon="🔐"
 *   streak={7}
 * />
 * ```
 */
export default function DashboardHeader({
  user,
  rankLabel,
  rankIcon,
  streak,
}: DashboardHeaderProps) {
  // Hydration-safe: only compute time-of-day on the client via useEffect.
  // Initialize to null so SSR/server render produces no greeting text;
  // the real greeting swaps in after mount without a mismatch.
  const [period, setPeriod] = useState<GreetingPeriod | null>(null);

  useEffect(() => {
    setPeriod(getGreetingPeriod());
  }, []);

  const isGuest = !user;

  // ── Derived values ──
  const displayName = isGuest
    ? "Guest Operator"
    : user.name || user.email?.split("@")[0] || "Guardian";

  const greetingText =
    isGuest
      ? `System Access: ${displayName}`
      : period
        ? `Good ${period}, ${displayName}`
        : `Good Morning, ${displayName}`; // fallback before client hydration

  return (
    <div className="space-y-2">
      {/* ── Greeting line ── */}
      <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
        {greetingText}
      </h1>

      {/* ── Rank + Streak sub-text ── */}
      <p className="text-sm text-slate-400 flex items-center gap-2 flex-wrap">
        <span className="text-base">{rankIcon}</span>
        <span>Rank: {rankLabel}</span>
        <span className="text-slate-600">•</span>

        {/* ── Streak sub-text ── */}
        {streak > 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            </span>
            <span className="text-emerald-300">
              Streak: {streak} Day{streak === 1 ? "" : "s"} Active
            </span>
          </span>
        ) : (
          <span className="text-amber-400/90">
            Streak: Inactive (Deploy a lab to start)
          </span>
        )}
      </p>
    </div>
  );
}
