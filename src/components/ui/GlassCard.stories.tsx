import type { Meta, StoryObj } from "@storybook/react";
import GlassCard from "./GlassCard";

const meta: Meta<typeof GlassCard> = {
  title: "UI/GlassCard",
  component: GlassCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="dark" style={{ background: "#0a0a0f", padding: "2rem", minHeight: 200 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

export const Default: Story = {
  args: {
    variant: "default",
    children: (
      <div className="p-4">
        <p className="text-sm font-semibold text-[var(--theme-text)]">Default Card</p>
        <p className="mt-2 text-xs text-[var(--theme-text-muted)]">
          Subtle border, glassmorphism backdrop. Hover for glow.
        </p>
      </div>
    ),
  },
};

export const Accent: Story = {
  args: {
    variant: "accent",
    children: (
      <div className="p-4">
        <p className="text-sm font-semibold text-[var(--theme-accent-blue)]">✨ Active Mission</p>
        <p className="mt-2 text-xs text-[var(--theme-text-muted)]">
          Neon blue border with glow. Use for recommended or active items.
        </p>
      </div>
    ),
  },
};

export const Locked: Story = {
  args: {
    variant: "locked",
    children: (
      <div className="p-4">
        <p className="text-sm font-semibold text-[var(--theme-text-dim)]">🔒 Locked</p>
        <p className="mt-2 text-xs text-[var(--theme-text-dim)]">
          Dimmed and faded. Use for inaccessible or future content.
        </p>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: "default",
    glowOnHover: true,
    onClick: () => alert("GlassCard clicked!"),
    ariaLabel: "Example interactive card",
    children: (
      <div className="p-4">
        <p className="text-sm font-semibold text-[var(--theme-text)]">🖱️ Clickable Card</p>
        <p className="mt-2 text-xs text-[var(--theme-text-muted)]">
          Hover for glow lift. Click to trigger action. Keyboard accessible with Enter/Space.
        </p>
      </div>
    ),
  },
};

export const NoGlow: Story = {
  args: {
    variant: "default",
    glowOnHover: false,
    children: (
      <div className="p-4">
        <p className="text-sm font-semibold text-[var(--theme-text)]">Static Card</p>
        <p className="mt-2 text-xs text-[var(--theme-text-muted)]">
          No hover lift or glow. Use for static content containers.
        </p>
      </div>
    ),
  },
};

export const WithCustomContent: Story = {
  args: {
    variant: "accent",
    children: (
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--theme-accent-blue)]/20 text-[var(--theme-accent-blue)] text-sm font-bold">
            Z
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">ZeroDay Guardian</p>
            <p className="text-[10px] text-[var(--theme-text-muted)]">Security Operations</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg bg-[var(--theme-overlay)] p-2">
            <p className="font-semibold text-[var(--theme-text)]">42</p>
            <p className="text-[var(--theme-text-dim)]">XP</p>
          </div>
          <div className="rounded-lg bg-[var(--theme-overlay)] p-2">
            <p className="font-semibold text-[var(--theme-text)]">5</p>
            <p className="text-[var(--theme-text-dim)]">Days</p>
          </div>
        </div>
      </div>
    ),
  },
};
