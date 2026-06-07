import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No data found" />);
    expect(screen.getByText("No data found")).toBeTruthy();
  });

  it("renders the subtitle when provided", () => {
    render(
      <EmptyState
        title="No labs yet"
        subtitle="Start a lab to see it here"
      />,
    );
    expect(screen.getByText("Start a lab to see it here")).toBeTruthy();
  });

  it("does not render subtitle when omitted", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText("Start a lab")).toBeFalsy();
  });

  it("renders an emoji icon when a string is passed", () => {
    render(<EmptyState icon="🔬" title="No labs" />);
    expect(screen.getByText("🔬")).toBeTruthy();
  });

  it("renders a ReactNode icon when passed", () => {
    render(
      <EmptyState
        icon={<span data-testid="custom-icon">⚡</span>}
        title="No results"
      />,
    );
    expect(screen.getByTestId("custom-icon")).toBeTruthy();
  });

  it("does not render icon container when icon is omitted", () => {
    const { container } = render(<EmptyState title="No icon" />);
    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).toBeFalsy();
  });

  it("renders action button when provided", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No missions"
        action={{ label: "View missions", onClick }}
      />,
    );
    const btn = screen.getByRole("button", { name: /view missions/i });
    expect(btn).toBeTruthy();

    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when omitted", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole("button")).toBeFalsy();
  });

  it("sets role=status and aria-label on the container", () => {
    render(<EmptyState title="Empty state" />);
    const el = screen.getByRole("status");
    expect(el).toBeTruthy();
    expect(el.getAttribute("aria-label")).toBe("Empty state");
  });

  it("applies custom className", () => {
    render(<EmptyState title="Test" className="extra-class" />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("extra-class");
  });

  it("applies the animate-fade-in animation class", () => {
    render(<EmptyState title="Animated" />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("animate-fade-in");
  });
});
