import type { Meta, StoryObj } from "@storybook/react";
import UnlockAnimation from "./UnlockAnimation";
import { useState, useCallback } from "react";
import { action } from "storybook/test";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof UnlockAnimation> = {
  title: "Gamification/UnlockAnimation",
  component: UnlockAnimation,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="dark" style={{ background: "#0a0a0f", padding: "3rem", minHeight: 400, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof UnlockAnimation>;

/**
 * UnlockAnimation is a trigger-based component that fires confetti when `trigger` becomes `true`.
 * It does not render any visible UI — only the confetti canvas overlay.
 *
 * Click the button below to trigger the animation. The confetti burst uses canvas-confetti
 * with 3 staggered bursts: primary (center), secondary (left), tertiary (right).
 *
 * The `onDone` callback fires ~2s after the animation starts.
 */
export const Default = {
  render: () => {
    const Component = () => {
      const [triggered, setTriggered] = useState(0);

      return (
        <div className="flex flex-col items-center gap-6">
          <UnlockAnimation
            trigger={triggered > 0}
            onDone={() => action("onDone")()}
          />
          <Button
            variant="default"
            size="lg"
            onClick={() => setTriggered((c) => c + 1)}
            className="min-w-[200px]"
          >
            🎉 Trigger Confetti
          </Button>
          <p className="text-xs text-[var(--theme-text-muted)] text-center max-w-xs">
            Each click triggers a fresh confetti burst. The animation auto-dismisses after ~2s.
          </p>
        </div>
      );
    };
    return <Component />;
  },
} satisfies StoryObj<typeof UnlockAnimation>;

/**
 * With `soundEnabled={true}`, a subtle pop tone plays via Web Audio API
 * alongside the confetti burst. The sound uses a sine-wave oscillator
 * (800→1200 Hz sweep, 300ms duration, low volume).
 *
 * Click the button multiple times — each click plays the pop sound + confetti.
 */
export const WithSound = {
  render: () => {
    const Component = () => {
      const [triggered, setTriggered] = useState(0);

      return (
        <div className="flex flex-col items-center gap-6">
          <UnlockAnimation
            trigger={triggered > 0}
            soundEnabled={true}
            onDone={() => action("onDone")()}
          />
          <Button
            variant="default"
            size="lg"
            onClick={() => setTriggered((c) => c + 1)}
            className="min-w-[200px]"
          >
            🔊 Confetti + Sound
          </Button>
          <p className="text-xs text-[var(--theme-text-muted)] text-center max-w-xs">
            Same confetti burst + an oscillator-based pop sound. Sound is muted by default.
          </p>
        </div>
      );
    };
    return <Component />;
  },
} satisfies StoryObj<typeof UnlockAnimation>;

/**
 * Auto-triggered story — fires confetti immediately on page load.
 * Useful for previewing the animation without clicking.
 */
export const AutoTrigger = {
  render: () => {
    return (
      <div className="flex flex-col items-center gap-4">
        <UnlockAnimation
          trigger={true}
          onDone={() => action("onDone")()}
        />
        <p className="text-sm text-[var(--theme-text-muted)] text-center max-w-xs">
          Confetti fires automatically on mount. This story demonstrates the auto-trigger behavior.
        </p>
      </div>
    );
  },
} satisfies StoryObj<typeof UnlockAnimation>;
