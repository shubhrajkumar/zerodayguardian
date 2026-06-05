import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import LiveClock, { formatRelativeTime } from "@/components/ui/LiveClock";

describe("LiveClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 4, 14, 32, 0)); // Wed, 04 Jun 2025 14:32
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the current date/time in expected format", () => {
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");
    expect(timeEl.textContent).toBe("Wed, 04 Jun 2025 • 14:32");
  });

  it("sets dateTime attribute to ISO string", () => {
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");
    // jsdom converts local time to UTC for toISOString; just verify it parses as valid ISO
    const dt = timeEl.getAttribute("dateTime") || "";
    expect(new Date(dt).toISOString()).toBe(dt);
    expect(dt).toContain("2025-06-04");
  });

  it("applies monospace font class", () => {
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");
    expect(timeEl.className).toContain("font-mono");
    expect(timeEl.className).toContain("tabular-nums");
  });

  it("applies custom className", () => {
    render(<LiveClock className="extra" />);
    const timeEl = screen.getByRole("time");
    expect(timeEl.className).toContain("extra");
  });

  it("updates every 60 seconds", () => {
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");
    expect(timeEl.textContent).toBe("Wed, 04 Jun 2025 • 14:32");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(timeEl.textContent).toBe("Wed, 04 Jun 2025 • 14:33");
  });

  it("does not update before 60 seconds", () => {
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(timeEl.textContent).toBe("Wed, 04 Jun 2025 • 14:32");
  });

  it("handles midnight rollover", () => {
    vi.setSystemTime(new Date(2025, 5, 4, 23, 59, 0));
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");
    expect(timeEl.textContent).toContain("23:59");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(timeEl.textContent).toContain("00:00");
  });

  it("handles month boundary", () => {
    vi.setSystemTime(new Date(2025, 0, 31, 23, 59, 0));
    render(<LiveClock />);
    const timeEl = screen.getByRole("time");
    expect(timeEl.textContent).toContain("31 Jan 2025");

    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(timeEl.textContent).toContain("01 Feb 2025");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 4, 14, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for times less than 60 seconds ago", () => {
    expect(formatRelativeTime(new Date(Date.now() - 30_000))).toBe("just now");
    expect(formatRelativeTime(new Date(Date.now() - 1_000))).toBe("just now");
  });

  it("returns minutes for times less than 60 minutes ago", () => {
    expect(formatRelativeTime(new Date(Date.now() - 120_000))).toBe("2 minutes ago");
    expect(formatRelativeTime(new Date(Date.now() - 1_800_000))).toBe("30 minutes ago");
  });

  it("returns singular 'minute' for exactly 1 minute", () => {
    expect(formatRelativeTime(new Date(Date.now() - 60_000))).toBe("1 minute ago");
  });

  it("returns hours for times less than 24 hours ago", () => {
    expect(formatRelativeTime(new Date(Date.now() - 3_600_000))).toBe("1 hour ago");
    expect(formatRelativeTime(new Date(Date.now() - 7_200_000))).toBe("2 hours ago");
  });

  it("returns days for times less than 30 days ago", () => {
    expect(formatRelativeTime(new Date(Date.now() - 86_400_000))).toBe("1 day ago");
    expect(formatRelativeTime(new Date(Date.now() - 259_200_000))).toBe("3 days ago");
  });

  it("returns months for older times", () => {
    expect(formatRelativeTime(new Date(Date.now() - 2_592_000_000))).toBe("1 month ago");
  });
});
