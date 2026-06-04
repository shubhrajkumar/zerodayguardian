import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import type { GamificationBadge } from "@/lib/gamificationSystem";

// ── Helpers ──

const makeBadge = (overrides: Partial<GamificationBadge> = {}): GamificationBadge => ({
  id: "signal-hunter",
  title: "Signal Hunter",
  detail: "Completed the daily recon sweep.",
  icon: "📡",
  earnedAt: "2025-03-15T10:00:00.000Z",
  ...overrides,
});

// ── Tests ──

describe("BadgeDisplay", () => {
  it("renders the achievements header", () => {
    render(<BadgeDisplay badges={[]} />);
    expect(screen.getByText("Achievements")).toBeTruthy();
  });

  it("shows correct earned count with no badges", () => {
    render(<BadgeDisplay badges={[]} />);
    expect(screen.getByText("0 / 11 earned")).toBeTruthy();
  });

  it("shows correct earned count with badges", () => {
    const badges = [
      makeBadge({ id: "signal-hunter" }),
      makeBadge({ id: "intel-scribe" }),
    ];
    render(<BadgeDisplay badges={badges} />);
    expect(screen.getByText("2 / 11 earned")).toBeTruthy();
  });

  it("renders all category filter buttons", () => {
    render(<BadgeDisplay badges={[]} />);
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Learning")).toBeTruthy();
    expect(screen.getByText("Labs")).toBeTruthy();
    expect(screen.getByText("OSINT")).toBeTruthy();
    expect(screen.getByText("Community")).toBeTruthy();
  });

  it("shows all 11 badges when 'All' category is selected", () => {
    render(<BadgeDisplay badges={[]} />);
    // All badges should be rendered with aria-label
    expect(screen.getByLabelText("Signal Hunter badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Intel Scribe badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("CTF Raider badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Chain Builder badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Cipher Ace badge - locked")).toBeTruthy();
  });

  it("marks earned badges correctly in aria-label", () => {
    const badges = [makeBadge({ id: "signal-hunter" })];
    render(<BadgeDisplay badges={badges} />);
    expect(screen.getByLabelText("Signal Hunter badge - earned")).toBeTruthy();
    // Other badges should still be locked
    expect(screen.getByLabelText("Intel Scribe badge - locked")).toBeTruthy();
  });

  it("filters to Learning category badges", async () => {
    render(<BadgeDisplay badges={[]} />);
    await userEvent.click(screen.getByText("Learning"));
    // Learning category has: intel-scribe, quiz-ace, intel-architect
    expect(screen.getByLabelText("Intel Scribe badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Cipher Ace badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Intel Architect badge - locked")).toBeTruthy();
    // Labs badges should NOT be visible
    expect(screen.queryByLabelText("Signal Hunter badge - locked")).toBeNull();
  });

  it("filters to Labs category badges", async () => {
    render(<BadgeDisplay badges={[]} />);
    await userEvent.click(screen.getByText("Labs"));
    expect(screen.getByLabelText("Signal Hunter badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Chain Builder badge - locked")).toBeTruthy();
    // Learning badge should NOT be visible
    expect(screen.queryByLabelText("Intel Scribe badge - locked")).toBeNull();
  });

  it("filters to OSINT category badges", async () => {
    render(<BadgeDisplay badges={[]} />);
    await userEvent.click(screen.getByText("OSINT"));
    expect(screen.getByLabelText("CTF Raider badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Elite Raider badge - locked")).toBeTruthy();
  });

  it("filters to Community category badges", async () => {
    render(<BadgeDisplay badges={[]} />);
    await userEvent.click(screen.getByText("Community"));
    expect(screen.getByLabelText("Mission Loop Cleared badge - locked")).toBeTruthy();
    expect(screen.getByLabelText("Week Cleared Elite badge - locked")).toBeTruthy();
  });

  it("shows tooltip on hover with badge title and detail", async () => {
    render(<BadgeDisplay badges={[]} />);
    const badge = screen.getByLabelText("Signal Hunter badge - locked");
    await userEvent.hover(badge);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    expect(screen.getByText("Signal Hunter")).toBeTruthy();
    expect(screen.getByText("Completed the daily recon sweep.")).toBeTruthy();
  });

  it("tooltip shows 'Locked' for unearned badges", async () => {
    render(<BadgeDisplay badges={[]} />);
    const badge = screen.getByLabelText("Signal Hunter badge - locked");
    await userEvent.hover(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Locked");
  });

  it("tooltip shows earned date for earned badges", async () => {
    const badges = [makeBadge({ id: "signal-hunter", earnedAt: "2025-06-01T12:00:00.000Z" })];
    render(<BadgeDisplay badges={badges} />);
    const badge = screen.getByLabelText("Signal Hunter badge - earned");
    await userEvent.hover(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Earned");
    expect(tooltip.textContent).not.toContain("Locked");
  });

  it("hides tooltip on mouse leave", async () => {
    render(<BadgeDisplay badges={[]} />);
    const badge = screen.getByLabelText("Signal Hunter badge - locked");
    await userEvent.hover(badge);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    await userEvent.unhover(badge);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("renders empty badges array without crashing", () => {
    render(<BadgeDisplay badges={[]} />);
    expect(screen.getByText("0 / 11 earned")).toBeTruthy();
  });
});
