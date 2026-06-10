import type { Meta, StoryObj } from "@storybook/react";
import BadgeDisplay from "./BadgeDisplay";
import type { GamificationBadge } from "@/lib/gamificationSystem";

const makeBadge = (overrides: Partial<GamificationBadge> = {}): GamificationBadge => ({
  id: "signal-hunter",
  title: "Signal Hunter",
  detail: "Completed the daily recon sweep.",
  icon: "📡",
  earnedAt: "2025-03-15T10:00:00.000Z",
  ...overrides,
});

const meta: Meta<typeof BadgeDisplay> = {
  title: "Gamification/BadgeDisplay",
  component: BadgeDisplay,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BadgeDisplay>;

/** No badges earned — all locked */
export const AllLocked: Story = {
  args: {
    badges: [],
  },
};

/** A few badges earned */
export const SomeEarned: Story = {
  args: {
    badges: [
      makeBadge({ id: "signal-hunter", title: "Signal Hunter", icon: "📡" }),
      makeBadge({ id: "intel-scribe", title: "Intel Scribe", icon: "📚" }),
      makeBadge({ id: "quiz-ace", title: "Cipher Ace", icon: "🧠" }),
    ],
  },
};

/** Many badges earned */
export const MostEarned: Story = {
  args: {
    badges: [
      makeBadge({ id: "signal-hunter", title: "Signal Hunter", icon: "📡" }),
      makeBadge({ id: "intel-scribe", title: "Intel Scribe", icon: "📚" }),
      makeBadge({ id: "ctf-raider", title: "CTF Raider", icon: "🏴‍☠️" }),
      makeBadge({ id: "daily-loop-cleared", title: "Mission Loop Cleared", icon: "🕵️" }),
      makeBadge({ id: "weekly-elite", title: "Week Cleared Elite", icon: "👑" }),
      makeBadge({ id: "quiz-ace", title: "Cipher Ace", icon: "🧠" }),
      makeBadge({ id: "chain-builder", title: "Chain Builder", icon: "⚔️" }),
      makeBadge({ id: "intel-architect", title: "Intel Architect", icon: "🛰️" }),
    ],
  },
};

/** All 11 badges earned */
export const AllEarned: Story = {
  args: {
    badges: [
      makeBadge({ id: "signal-hunter", title: "Signal Hunter", icon: "📡" }),
      makeBadge({ id: "intel-scribe", title: "Intel Scribe", icon: "📚" }),
      makeBadge({ id: "ctf-raider", title: "CTF Raider", icon: "🏴‍☠️" }),
      makeBadge({ id: "daily-loop-cleared", title: "Mission Loop Cleared", icon: "🕵️" }),
      makeBadge({ id: "weekly-elite", title: "Week Cleared Elite", icon: "👑" }),
      makeBadge({ id: "quiz-ace", title: "Cipher Ace", icon: "🧠" }),
      makeBadge({ id: "chain-builder", title: "Chain Builder", icon: "⚔️" }),
      makeBadge({ id: "intel-architect", title: "Intel Architect", icon: "🛰️" }),
      makeBadge({ id: "surface-cartographer", title: "Surface Cartographer", icon: "🗺️" }),
      makeBadge({ id: "elite-raider", title: "Elite Raider", icon: "💀" }),
      makeBadge({ id: "blue-team-forge", title: "Blue Team Forge", icon: "🛡️" }),
    ],
  },
};
