import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";

// The default CYBERSECURITY_BADGES catalog has 10 badges
const CATALOG_COUNT = 10;

// ── Tests ──

describe("BadgeDisplay", () => {
  it("renders the achievements header", () => {
    render(<BadgeDisplay />);
    expect(screen.getByText("Achievements")).toBeTruthy();
  });

  it("shows correct earned count with no badges", () => {
    render(<BadgeDisplay />);
    expect(screen.getByText((content) => content.includes("0") && content.includes("/") && content.includes("10") && content.includes("collected"))).toBeTruthy();
  });

  it("shows correct earned count with earnedBadges", () => {
    render(<BadgeDisplay earnedBadges={["first-blood", "bug-hunter"]} />);
    expect(screen.getByText((content) => content.includes("2") && content.includes("/") && content.includes("10") && content.includes("collected"))).toBeTruthy();
  });

  it("renders all catalog badges by default", () => {
    render(<BadgeDisplay />);
    expect(screen.getByLabelText("First Blood badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Bug Hunter badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Code Warrior badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Streak Master badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("XP Legend badge - locked")).toBeTruthy();
  });

  it("marks earned badges correctly in aria-label", () => {
    render(<BadgeDisplay earnedBadges={["first-blood"]} />);
    expect(screen.getByLabelText("First Blood badge - collected")).toBeTruthy();
    expect(screen.getByLabelText("Bug Hunter badge - locked")).toBeTruthy();
  });

  it("shows tooltip on hover with badge name and requirement", async () => {
    render(<BadgeDisplay />);
    const badge = screen.getByLabelText("First Blood badge - locked");
    await userEvent.hover(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain("First Blood");
    expect(tooltip.textContent).toContain("Complete first lab");
  });

  it("tooltip shows 'Locked' for unearned badges", async () => {
    render(<BadgeDisplay />);
    const badge = screen.getByLabelText("First Blood badge - locked");
    await userEvent.hover(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Locked");
  });

  it("tooltip shows 'Collected' for earned badges", async () => {
    render(<BadgeDisplay earnedBadges={["first-blood"]} />);
    const badge = screen.getByLabelText("First Blood badge - collected");
    await userEvent.hover(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("✓ Collected");
    expect(tooltip.textContent).not.toContain("Locked");
  });

  it("hides tooltip on mouse leave", async () => {
    render(<BadgeDisplay />);
    const badge = screen.getByLabelText("First Blood badge - locked");
    await userEvent.hover(badge);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await userEvent.unhover(badge);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders without crashing with no props", () => {
    render(<BadgeDisplay />);
    expect(screen.getByText((content) => content.includes("0") && content.includes("/") && content.includes("10") && content.includes("collected"))).toBeTruthy();
  });

  it("accepts custom badge catalog via badges prop", () => {
    const customBadges = [
      { id: "custom-1", name: "Custom Badge", description: "A custom badge", icon: "🏅", requirement: "Do something" },
    ];
    render(<BadgeDisplay badges={customBadges} />);
    expect(screen.getByText((content) => content.includes("0") && content.includes("/") && content.includes("1") && content.includes("collected"))).toBeTruthy();
    expect(screen.getByLabelText("Custom Badge badge - locked")).toBeTruthy();
  });
});
