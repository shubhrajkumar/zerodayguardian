import type { Meta, StoryObj } from "@storybook/react";
import LeaderboardCard from "./LeaderboardCard";

const meta: Meta<typeof LeaderboardCard> = {
  title: "Gamification/LeaderboardCard",
  component: LeaderboardCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof LeaderboardCard>;

/**
 * Default state — fetches data from the API.
 * In Storybook, the API call will fail gracefully and show the empty state.
 */
export const Default: Story = {};

/**
 * Loading state — shown while fetching leaderboard data.
 * The API fetch will take a moment before resolving.
 */
export const Loading: Story = {};
