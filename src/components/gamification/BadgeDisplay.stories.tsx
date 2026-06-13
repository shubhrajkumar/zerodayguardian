import type { Meta, StoryObj } from "@storybook/react";
import BadgeDisplay from "./BadgeDisplay";
import { CYBERSECURITY_BADGES } from "./badges";

const meta: Meta<typeof BadgeDisplay> = {
  title: "Gamification/BadgeDisplay",
  component: BadgeDisplay,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof BadgeDisplay>;

/**
 * No badges earned — all 10 show as locked (dimmed, grayscale).
 * The component renders the default CYBERSECURITY_BADGES catalog.
 */
export const AllLocked: Story = {
  args: {},
};

/**
 * Three badges earned via `earnedBadges` prop.
 * First Blood (🩸), Bug Hunter (🎯), and Code Warrior (⚔️) show as earned;
 * the remaining 7 badges are locked.
 */
export const SomeEarned: Story = {
  args: {
    earnedBadges: ["first-blood", "bug-hunter", "code-warrior"],
  },
};

/**
 * Seven badges earned — streak, level, and defense marks unlocked.
 */
export const MostEarned: Story = {
  args: {
    earnedBadges: [
      "first-blood",
      "bug-hunter",
      "code-warrior",
      "streak-master",
      "xp-legend",
      "defense-expert",
      "community-hero",
    ],
  },
};

/**
 * All 10 badges earned — every badge glows blue with full opacity.
 */
export const AllEarned: Story = {
  args: {
    earnedBadges: CYBERSECURITY_BADGES.map((b) => b.id),
  },
};

/**
 * Custom badge catalog passed via the `badges` prop (using the `Badge` interface
 * with `name`, `description`, and `requirement` fields).
 */
export const CustomCatalog: Story = {
  args: {
    badges: [
      { id: "custom-1", name: "Night Ops", description: "Completed a lab after midnight.", icon: "🌙", requirement: "Complete a lab between midnight and 5 AM" },
      { id: "custom-2", name: "Zero Click", description: "Solved a challenge without clicking a single link.", icon: "🖱️", requirement: "Solve a challenge without clicking" },
      { id: "custom-3", name: "Packet Whisperer", description: "Interpreted 10 packet captures correctly.", icon: "📡", requirement: "Analyze 10 packet captures" },
    ],
    earnedBadges: ["custom-3"],
  },
};
