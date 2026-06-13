import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import XPBar from "@/components/gamification/XPBar";
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

describe("XPBar", () => {
  it("renders the level number", () => {
    render(<XPBar snapshot={makeSnapshot({ level: 5 })} />);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("renders the level label for known levels", () => {
    render(<XPBar snapshot={makeSnapshot({ level: 1 })} />);
    expect(screen.getByText("Rookie")).toBeTruthy();
  });

  it("renders 'Legend' for level 10", () => {
    render(<XPBar snapshot={makeSnapshot({ level: 10 })} />);
    expect(screen.getByText("Legend")).toBeTruthy();
  });

  it("renders 'Legend' for level 15 (capped at index 10)", () => {
    render(<XPBar snapshot={makeSnapshot({ level: 15 })} />);
    expect(screen.getByText("Legend")).toBeTruthy();
  });

  it("renders total XP formatted with locale separators", () => {
    render(<XPBar snapshot={makeSnapshot({ totalXp: 12500 })} />);
    expect(screen.getByText("12,500 total XP")).toBeTruthy();
  });

  it("renders XP progress fraction", () => {
    render(<XPBar snapshot={makeSnapshot({ xpIntoLevel: 500, xpToNextLevel: 500 })} />);
    expect(screen.getByText("500 / 1,000")).toBeTruthy();
  });

  it("renders XP to next level", () => {
    render(<XPBar snapshot={makeSnapshot({ xpToNextLevel: 800 })} />);
    expect(screen.getByText("800 XP to next level")).toBeTruthy();
  });

  it("progress bar has correct width when xpIntoLevel > 0", () => {
    const { container } = render(<XPBar snapshot={makeSnapshot({ xpIntoLevel: 600, xpToNextLevel: 600 })} />);
    const progressBar = container.querySelector("[style*='width: 50%']");
    expect(progressBar).toBeTruthy();
  });

  it("progress bar is 0% width when xpIntoLevel is 0", () => {
    const { container } = render(<XPBar snapshot={makeSnapshot({ xpIntoLevel: 0, xpToNextLevel: 1000 })} />);
    const progressBar = container.querySelector("[style*='width: 0%']");
    expect(progressBar).toBeTruthy();
  });

  it("shows shimmer overlay when progress > 10%", () => {
    const { container } = render(<XPBar snapshot={makeSnapshot({ xpIntoLevel: 500, xpToNextLevel: 500 })} />);
    const shimmer = container.querySelector("[style*='shimmer 2s infinite']");
    expect(shimmer).toBeTruthy();
  });

  it("does not show shimmer when progress <= 10%", () => {
    const { container } = render(<XPBar snapshot={makeSnapshot({ xpIntoLevel: 10, xpToNextLevel: 990 })} />);
    const shimmer = container.querySelector("[style*='shimmer 2s infinite']");
    expect(shimmer).toBeNull();
  });

  it("handles zero XP gracefully", () => {
    render(<XPBar snapshot={makeSnapshot({ totalXp: 0, xpIntoLevel: 0, xpToNextLevel: 0, level: 1 })} />);
    expect(screen.getByText("Rookie")).toBeTruthy();
    expect(screen.getByText("0 total XP")).toBeTruthy();
  });

  it("renders with direct props instead of snapshot", () => {
    render(<XPBar currentXP={450} level={5} xpToNextLevel={1000} />);
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Operative")).toBeTruthy();
    // The component displays currentXP / (currentXP + xpToNextLevel)
    expect(screen.getByText("450 / 1,450")).toBeTruthy();
    expect(screen.getByText("1,000 XP to next level")).toBeTruthy();
  });
});
