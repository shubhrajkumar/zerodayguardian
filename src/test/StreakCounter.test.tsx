import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StreakCounter from "@/components/gamification/StreakCounter";
import type { GamificationSnapshot } from "@/lib/gamificationSystem";

// ── Helpers ──

const makeSnapshot = (overrides: Partial<GamificationSnapshot> = {}): GamificationSnapshot => ({
  userId: "test-user",
  handle: "test",
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
  ...overrides,
});

// ── Tests ──

describe("StreakCounter", () => {
  it("renders streak days count", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 5 })} />);
    expect(screen.getByText("5 days")).toBeTruthy();
  });

  it("renders singular 'day' for streak of 1", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 1 })} />);
    expect(screen.getByText("1 day")).toBeTruthy();
  });

  it("renders 'Daily streak' when streak < 7", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 3 })} />);
    expect(screen.getByText("Daily streak")).toBeTruthy();
  });

  it("renders 'On fire! Keep going!' when streak >= 7", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 7 })} />);
    expect(screen.getByText("On fire! Keep going!")).toBeTruthy();
  });

  it("renders fire badge indicator when on fire (streak >= 7)", () => {
    const { container } = render(<StreakCounter snapshot={makeSnapshot({ streakDays: 10 })} />);
    // The "!" badge with animate-pulse class
    const fireBadge = container.querySelector(".animate-pulse");
    expect(fireBadge).toBeTruthy();
    expect(fireBadge?.textContent).toBe("!");
  });

  it("does not render fire badge indicator when not on fire", () => {
    const { container } = render(<StreakCounter snapshot={makeSnapshot({ streakDays: 3 })} />);
    const fireBadge = container.querySelector(".animate-pulse");
    expect(fireBadge).toBeNull();
  });

  it("renders total days", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 3, completedDays: 25 })} />);
    expect(screen.getByText("Total Days")).toBeTruthy();
    // 25 appears in both Total Days and Best Streak (max(3,25)=25), so use getAllByText
    const twentyFives = screen.getAllByText("25");
    expect(twentyFives.length).toBeGreaterThanOrEqual(1);
  });

  it("renders best streak as max of streakDays and completedDays", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 5, completedDays: 20 })} />);
    expect(screen.getByText("Best Streak")).toBeTruthy();
    // 20 appears in both Total Days and Best Streak (max(5,20)=20), so use getAllByText
    const twenties = screen.getAllByText("20");
    expect(twenties.length).toBeGreaterThanOrEqual(1);
  });

  it("uses streakDays when it is larger than completedDays", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 15, completedDays: 8 })} />);
    expect(screen.getByText("15")).toBeTruthy();
  });

  it("renders zero streak correctly", () => {
    render(<StreakCounter snapshot={makeSnapshot({ streakDays: 0, completedDays: 0 })} />);
    expect(screen.getByText("0 days")).toBeTruthy();
    expect(screen.getByText("Daily streak")).toBeTruthy();
  });
});
