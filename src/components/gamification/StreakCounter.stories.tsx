import type { Meta, StoryObj } from "@storybook/react";
import StreakCounter from "./StreakCounter";
import type { GamificationSnapshot } from "@/lib/gamificationSystem";

const makeSnapshot = (overrides: Partial<GamificationSnapshot> = {}): GamificationSnapshot => ({
  userId: "demo-user",
  handle: "demo",
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

const meta: Meta<typeof StreakCounter> = {
  title: "Gamification/StreakCounter",
  component: StreakCounter,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StreakCounter>;

/** No active streak */
export const NoStreak: Story = {
  args: {
    snapshot: makeSnapshot({ streakDays: 0, completedDays: 0 }),
  },
};

/** Single day streak */
export const SingleDay: Story = {
  args: {
    snapshot: makeSnapshot({ streakDays: 1, completedDays: 1 }),
  },
};

/** 5-day active streak */
export const ActiveStreak: Story = {
  args: {
    snapshot: makeSnapshot({ streakDays: 5, completedDays: 15 }),
  },
};

/** 7+ day streak — fire animation active */
export const OnFire: Story = {
  args: {
    snapshot: makeSnapshot({ streakDays: 14, completedDays: 30 }),
  },
};

/** Long streak with many completed days */
export const Veteran: Story = {
  args: {
    snapshot: makeSnapshot({ streakDays: 30, completedDays: 60 }),
  },
};
