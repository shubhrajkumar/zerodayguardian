import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useGamification from "@/hooks/useGamification";
import type { GamificationSnapshot } from "@/lib/gamificationSystem";

// ── Mock ──

const mockRefresh = vi.fn();
const mockClearLatestReward = vi.fn();
const mockCompleteMission = vi.fn();
const mockSubmitQuizAnswer = vi.fn();

const mockSnapshot: GamificationSnapshot = {
  userId: "test-user",
  handle: "tester",
  dailyKey: "2025-01-01",
  weeklyKey: "2025-W01",
  level: 3,
  totalXp: 1500,
  xpIntoLevel: 600,
  xpToNextLevel: 1200,
  streakDays: 5,
  completedDays: 12,
  dailyMissions: [],
  weeklyMissions: [],
  quizQuestions: [],
  quizAnswers: {},
  badges: [],
  recentRewards: [],
  serviceStatus: "ready",
  serviceMessage: "Ready",
};

vi.mock("@/lib/gamificationSystem", () => ({
  useGamificationSystem: vi.fn(),
}));

import { useGamificationSystem } from "@/lib/gamificationSystem";
const mockUseGamificationSystem = vi.mocked(useGamificationSystem);

const setupMock = (overrides: Partial<GamificationSnapshot> = {}) => {
  const snapshot = { ...mockSnapshot, ...overrides };
  mockUseGamificationSystem.mockReturnValue({
    snapshot,
    loading: false,
    error: "",
    latestReward: null,
    refresh: mockRefresh,
    clearLatestReward: mockClearLatestReward,
    completeMission: mockCompleteMission,
    submitQuizAnswer: mockSubmitQuizAnswer,
  });
  return snapshot;
};

// ── Tests ──

describe("useGamification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── levelProgress ──

  describe("levelProgress", () => {
    it("returns 0 when both xpIntoLevel and xpToNextLevel are 0", () => {
      setupMock({ xpIntoLevel: 0, xpToNextLevel: 0 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.levelProgress).toBe(0);
    });

    it("returns 50 when halfway to next level", () => {
      setupMock({ xpIntoLevel: 500, xpToNextLevel: 500 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.levelProgress).toBe(50);
    });

    it("returns 100 when at max progress", () => {
      setupMock({ xpIntoLevel: 1200, xpToNextLevel: 0 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.levelProgress).toBe(100);
    });

    it("caps at 100 when xpToNextLevel is 0", () => {
      setupMock({ xpIntoLevel: 500, xpToNextLevel: 0 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.levelProgress).toBe(100);
    });

    it("shows high but not 100 when xpIntoLevel exceeds xpToNextLevel", () => {
      setupMock({ xpIntoLevel: 2000, xpToNextLevel: 100 });
      const { result } = renderHook(() => useGamification("user-1"));
      // 2000 / 2100 ≈ 95.24 → rounds to 95
      expect(result.current.levelProgress).toBe(95);
    });

    it("rounds to nearest integer", () => {
      setupMock({ xpIntoLevel: 3, xpToNextLevel: 10 });
      const { result } = renderHook(() => useGamification("user-1"));
      // 3 / 13 ≈ 23.07 → rounds to 23
      expect(result.current.levelProgress).toBe(23);
    });

    it("returns 0 for low progress (1%)", () => {
      setupMock({ xpIntoLevel: 10, xpToNextLevel: 990 });
      const { result } = renderHook(() => useGamification("user-1"));
      // 10 / 1000 = 1%
      expect(result.current.levelProgress).toBe(1);
    });
  });

  // ── hasActiveStreak ──

  describe("hasActiveStreak", () => {
    it("returns false when streakDays is 0", () => {
      setupMock({ streakDays: 0 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.hasActiveStreak).toBe(false);
    });

    it("returns true when streakDays is 1", () => {
      setupMock({ streakDays: 1 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.hasActiveStreak).toBe(true);
    });

    it("returns true for a long streak", () => {
      setupMock({ streakDays: 30 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.hasActiveStreak).toBe(true);
    });
  });

  // ── isOnFire ──

  describe("isOnFire", () => {
    it("returns false when streakDays is 6", () => {
      setupMock({ streakDays: 6 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.isOnFire).toBe(false);
    });

    it("returns true when streakDays is 7", () => {
      setupMock({ streakDays: 7 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.isOnFire).toBe(true);
    });

    it("returns true for streaks above 7", () => {
      setupMock({ streakDays: 14 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.isOnFire).toBe(true);
    });

    it("returns false when streakDays is 0", () => {
      setupMock({ streakDays: 0 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.isOnFire).toBe(false);
    });
  });

  // ── earnedBadgeCount ──

  describe("earnedBadgeCount", () => {
    it("returns 0 when no badges earned", () => {
      setupMock({ badges: [] });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.earnedBadgeCount).toBe(0);
    });

    it("returns the correct count of earned badges", () => {
      setupMock({
        badges: [
          { id: "a", title: "A", detail: "", icon: "🏅", earnedAt: "2025-01-01" },
          { id: "b", title: "B", detail: "", icon: "🏅", earnedAt: "2025-01-02" },
          { id: "c", title: "C", detail: "", icon: "🏅", earnedAt: "2025-01-03" },
        ],
      });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.earnedBadgeCount).toBe(3);
    });
  });

  // ── isServiceReady ──

  describe("isServiceReady", () => {
    it("returns true when serviceStatus is ready", () => {
      setupMock({ serviceStatus: "ready" });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.isServiceReady).toBe(true);
    });

    it("returns false when serviceStatus is degraded", () => {
      setupMock({ serviceStatus: "degraded" });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.isServiceReady).toBe(false);
    });
  });

  // ── passthrough values ──

  describe("passthrough values", () => {
    it("returns snapshot from useGamificationSystem", () => {
      const snapshot = setupMock({ totalXp: 9999 });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.snapshot).toBe(snapshot);
      expect(result.current.snapshot.totalXp).toBe(9999);
    });

    it("passes loading state through", () => {
      mockUseGamificationSystem.mockReturnValue({
        snapshot: mockSnapshot,
        loading: true,
        error: "",
        latestReward: null,
        refresh: mockRefresh,
        clearLatestReward: mockClearLatestReward,
        completeMission: mockCompleteMission,
        submitQuizAnswer: mockSubmitQuizAnswer,
      });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.loading).toBe(true);
    });

    it("passes error state through", () => {
      mockUseGamificationSystem.mockReturnValue({
        snapshot: mockSnapshot,
        loading: false,
        error: "Connection failed",
        latestReward: null,
        refresh: mockRefresh,
        clearLatestReward: mockClearLatestReward,
        completeMission: mockCompleteMission,
        submitQuizAnswer: mockSubmitQuizAnswer,
      });
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.error).toBe("Connection failed");
    });

    it("passes function references through", () => {
      setupMock();
      const { result } = renderHook(() => useGamification("user-1"));
      expect(result.current.refresh).toBe(mockRefresh);
      expect(result.current.clearLatestReward).toBe(mockClearLatestReward);
      expect(result.current.completeMission).toBe(mockCompleteMission);
      expect(result.current.submitQuizAnswer).toBe(mockSubmitQuizAnswer);
    });
  });

  // ── argument forwarding ──

  describe("argument forwarding", () => {
    it("passes userId and handle to useGamificationSystem", () => {
      setupMock();
      renderHook(() => useGamification("user-42", "Alice"));
      expect(mockUseGamificationSystem).toHaveBeenCalledWith("user-42", "Alice");
    });

    it("passes null userId to useGamificationSystem", () => {
      setupMock();
      renderHook(() => useGamification(null, null));
      expect(mockUseGamificationSystem).toHaveBeenCalledWith(null, null);
    });

    it("passes undefined when no args given", () => {
      setupMock();
      renderHook(() => useGamification());
      expect(mockUseGamificationSystem).toHaveBeenCalledWith(undefined, undefined);
    });
  });
});
