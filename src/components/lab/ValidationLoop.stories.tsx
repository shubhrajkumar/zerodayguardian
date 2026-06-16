import type { Meta, StoryObj } from "@storybook/react";
import ValidationLoop from "./ValidationLoop";
import { action } from "@storybook/addon-actions";
import { useState, useCallback } from "react";

const correctAnswer = "guardian";

const cyberSteps = [
  { id: "step-1", instruction: "What is the first principle of cybersecurity? Hint: It starts with 'C'.", hint: "C__________" },
  { id: "step-2", instruction: "Which protocol secures web traffic? Hint: It has 'S' at the end.", hint: "HT___" },
  { id: "step-3", instruction: "Type the password: 'guardian' to unlock the final node.", hint: "Type: guardian" },
];

const meta: Meta<typeof ValidationLoop> = {
  title: "Lab/ValidationLoop",
  component: ValidationLoop,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="dark" style={{ background: "#0a0a0f", padding: "2rem", maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ValidationLoop>;

/**
 * Default flow with 3 cyber-themed steps.
 * The `onValidate` callback accepts any answer containing "guardian" to pass.
 * Open the Storybook Actions panel to see validate, complete, and error events.
 */
export const Default: Story = {
  args: {
    steps: cyberSteps,
    onValidate: async (stepId: string, answer: string) => {
      action("validate")({ stepId, answer });
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      const isValid = answer.toLowerCase().includes("guardian") || answer.toLowerCase().includes("confidentiality") || answer.toLowerCase().includes("https");
      if (!isValid) throw new Error("Validation failed");
      return isValid;
    },
    onComplete: action("complete"),
    onError: action("error"),
  },
};

/**
 * A single-step validation loop — shortcut for quick verifications.
 */
export const SingleStep: Story = {
  args: {
    steps: [{ id: "quick-check", instruction: "Confirm you understand the lab safety guidelines by typing: 'understood'", hint: "understood" }],
    onValidate: async (_id: string, answer: string) => {
      action("validate")({ answer });
      await new Promise((resolve) => setTimeout(resolve, 500));
      return answer.toLowerCase() === "understood";
    },
    onComplete: action("complete"),
  },
};

/**
 * Validation that always rejects — shows error state with shake animation and retry button.
 */
export const AlwaysError: Story = {
  args: {
    steps: [{ id: "impossible", instruction: "Type the password that will always be wrong.", hint: "It doesn't matter what you type" }],
    onValidate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return false;
    },
    onError: action("error"),
  },
};

/**
 * Custom success element replaces the default CheckCircle2 icon.
 */
export const CustomSuccess: Story = {
  args: {
    steps: [{ id: "custom", instruction: "Type 'hack-the-planet' to trigger a custom success message.", hint: "hack-the-planet" }],
    onValidate: async (_id: string, answer: string) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return answer.toLowerCase() === "hack-the-planet";
    },
    onComplete: action("complete"),
    successElement: (
      <div className="space-y-2 py-2">
        <span className="text-4xl">🎉</span>
        <p className="text-lg font-bold text-[var(--theme-accent-green)]">Access Granted!</p>
        <p className="text-sm text-[var(--theme-text-muted)]">You've unlocked the next level.</p>
      </div>
    ),
  },
};

/**
 * Interactive story where you can type and see the full flow in real-time.
 * Uses a stateful wrapper to reset the component on each story render.
 */
export const Interactive = {
  render: () => {
    const Component = () => {
      const [key, setKey] = useState(0);
      const handleComplete = useCallback(() => {
        action("complete")();
        setKey((k) => k + 1);
      }, []);

      return (
        <div key={key}>
          <ValidationLoop
            steps={cyberSteps}
            onValidate={async (_stepId: string, answer: string) => {
              action("validate")({ answer });
              await new Promise((resolve) => setTimeout(resolve, 700));
              return answer.toLowerCase().includes(correctAnswer) || answer.toLowerCase().includes("confidentiality") || answer.toLowerCase().includes("https");
            }}
            onComplete={handleComplete}
            onError={action("error")}
          />
        </div>
      );
    };
    return <Component />;
  },
} satisfies StoryObj<typeof ValidationLoop>;
