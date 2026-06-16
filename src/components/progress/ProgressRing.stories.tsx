import type { Meta, StoryObj } from "@storybook/react";
import ProgressRing from "./ProgressRing";

const meta: Meta<typeof ProgressRing> = {
  title: "Progress/ProgressRing",
  component: ProgressRing,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="dark" style={{ background: "#0a0a0f", padding: "3rem", display: "flex", justifyContent: "center" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProgressRing>;

/**
 * Day 1 of 60 — locked state with grey ring and motivational quote.
 */
export const Locked: Story = {
  args: {
    current: 0,
    total: 60,
  },
};

/**
 * Day 5 of 60 — active neon blue ring with label and percentage.
 */
export const EarlyProgress: Story = {
  args: {
    current: 5,
    total: 60,
    label: "Day 5 of 60",
  },
};

/**
 * Day 30 of 60 — halfway there, still in active neon blue state.
 */
export const Halfway: Story = {
  args: {
    current: 30,
    total: 60,
    label: "Day 30 of 60 — Keep Going!",
  },
};

/**
 * Day 60 of 60 — completed state with gold ring and "Mission Complete" label.
 */
export const Completed: Story = {
  args: {
    current: 60,
    total: 60,
  },
};

/**
 * A shorter program (e.g. 7-day challenge) at day 3.
 */
export const ShortProgram: Story = {
  args: {
    current: 3,
    total: 7,
    label: "Day 3 of 7",
    quotes: [
      "Short programs build fast habits.",
      "Consistency is key.",
      "Almost there!",
    ],
  },
};

/**
 * Custom quotes passed in for a specific theme.
 */
export const CustomQuotes: Story = {
  args: {
    current: 15,
    total: 60,
    quotes: [
      "You're making great progress!",
      "Stay focused on the mission.",
      "Every byte of knowledge counts.",
      "Cyber minds think in layers.",
    ],
  },
};
