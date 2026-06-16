import type { Meta, StoryObj } from "@storybook/react";
import LeaderboardCard from "./LeaderboardCard";
import type { LeaderboardEntry } from "./LeaderboardCard";

const meta: Meta<typeof LeaderboardCard> = {
  title: "Gamification/LeaderboardCard",
  component: LeaderboardCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LeaderboardCard>;

const sampleLeaderboard: LeaderboardEntry[] = [
  { rank: 1, username: "CyberPhoenix", xp: 12500, level: 42, avatar: "CP", userId: "user-cyberphoenix" },
  { rank: 2, username: "N3tWh1sp3r", xp: 9800, level: 36, avatar: "NW", userId: "user-n3twh1sp3r" },
  { rank: 3, username: "HexViper", xp: 7200, level: 28, avatar: "HV", userId: "user-hexviper" },
  { rank: 4, username: "PacketNinja", xp: 6100, level: 24, avatar: "PN" },
  { rank: 5, username: "ShellShock", xp: 5400, level: 21, avatar: "SS" },
  { rank: 6, username: "BinaryBard", xp: 4900, level: 19, avatar: "BB" },
  { rank: 7, username: "CipherZero", xp: 3800, level: 16, avatar: "CZ" },
  { rank: 8, username: "LogicBreach", xp: 2900, level: 13, avatar: "LB" },
  { rank: 9, username: "FirewallFox", xp: 2100, level: 10, avatar: "FF" },
  { rank: 10, username: "RootAccess", xp: 1500, level: 8, avatar: "RA" },
];

/**
 * Leaderboard populated with 10 sample cybersecurity-themed operators.
 * No `currentUserId` is set, so no row is highlighted.
 */
export const WithData: Story = {
  args: {
    leaderboard: sampleLeaderboard,
  },
};

/**
 * The current user ("N3tWh1sp3r", rank 2) is highlighted with a green border
 * because `currentUserId` matches the `userId` field on that entry.
 */
export const WithCurrentUser: Story = {
  args: {
    leaderboard: sampleLeaderboard,
    currentUserId: "user-n3twh1sp3r",
  },
};

/**
 * Empty state — no leaderboard data available and no API call triggered
 * because the `leaderboard` prop is omitted.
 */
export const Empty: Story = {
  args: {
    leaderboard: [],
  },
};

/**
 * Minimal leaderboard with only 3 entries — all get medals.
 */
export const TopThreeOnly: Story = {
  args: {
    leaderboard: sampleLeaderboard.slice(0, 3),
  },
};

/**
 * Single row — a sole operator at the top.
 */
export const Solo: Story = {
  args: {
    leaderboard: [
      { rank: 1, username: "LoneWolf", xp: 3000, level: 14, avatar: "🐺" },
    ],
  },
};
