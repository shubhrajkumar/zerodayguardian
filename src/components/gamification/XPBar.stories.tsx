import type { Meta, StoryObj } from "@storybook/react";
import XPBar from "./XPBar";
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

const meta: Meta<typeof XPBar> = {
  title: "Gamification/XPBar",
  component: XPBar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof XPBar>;

/** Level 1 Rookie with no XP progress */
export const Rookie: Story = {
  args: {
    snapshot: makeSnapshot({ level: 1, totalXp: 0, xpIntoLevel: 0, xpToNextLevel: 600 }),
  },
};

/** Level 5 Operative with 50% progress */
export const Halfway: Story = {
  args: {
    snapshot: makeSnapshot({ level: 5, totalXp: 4500, xpIntoLevel: 500, xpToNextLevel: 500 }),
  },
};

/** Level 10 Legend with full progress */
export const MaxLevel: Story = {
  args: {
    snapshot: makeSnapshot({ level: 10, totalXp: 25000, xpIntoLevel: 5000, xpToNextLevel: 0 }),
  },
};

/** Level 8 Expert near level-up */
export const NearLevelUp: Story = {
  args: {
    snapshot: makeSnapshot({ level: 8, totalXp: 12000, xpIntoLevel: 880, xpToNextLevel: 120 }),
  },
};
