/**
 * DemoNmapLab Tests — Covers rendering, IP validation, scan simulation,
 * quick-IP buttons, and UI state transitions.
 *
 * Cyber Rationale: Scan tests use vi.useFakeTimers() + vi.advanceTimersByTime()
 * to manually control the async delays. fireEvent.change() is used instead of
 * userEvent.type() to avoid timer conflicts. After advancing all timers, we
 * verify the final DOM state without relying on waitFor (which uses setInterval
 * internally and doesn't work with fake timers).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ──

// Mock framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { initial, animate, exit, transition, whileHover, whileTap, onHoverStart, onHoverEnd, ...rest } = props;
        return <div {...rest}>{children}</div>;
      },
      p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { initial, animate, transition, ...rest } = props;
        return <p {...rest}>{children}</p>;
      },
      span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { animate, transition, ...rest } = props;
        return <span {...rest}>{children}</span>;
      },
      button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { whileHover, whileTap, ...rest } = props;
        return <button {...rest}>{children}</button>;
      },
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import DemoNmapLab from "@/pages/Labs/DemoNmapLab";

// Mock useNavigate to prevent "outside Router" error
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderComponent = () => render(<DemoNmapLab />);

// ── Helpers ──

/**
 * Render a valid scan that completes synchronously with fake timers.
 * Uses fireEvent.change/click to avoid timer conflicts with userEvent.
 * Phase delays total 3300ms + mockScan delay up to 3000ms = ~6300ms max.
 * 10000ms is more than sufficient to fire all pending timers.
 */
const runScanWithFakeTimers = () => {
  vi.useFakeTimers();
  renderComponent();

  const input = screen.getByLabelText("Target IP address");
  fireEvent.change(input, { target: { value: "192.168.1.1" } });
  fireEvent.click(screen.getByRole("button", { name: /run scan/i }));

  return { input };
};

/**
 * Advance through all scan phases and mockScan delay by advancing timers
 * in small increments. A single vi.advanceTimersByTime(10000) won't fire
 * timers created in microtask continuations — we need a loop to advance
 * sequentially through each phase's setTimeout.
 *
 * Phase delays: 300+400+500+600+800+700 = 3300ms
 * mockScan delay: up to ~3000ms
 * Total: ~6300ms
 */
const advanceScan = async () => {
  for (let i = 0; i < 15; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
  }
};

// ── Tests ──

describe("DemoNmapLab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Rendering ──

  it("renders the Free Demo Lab badge", () => {
    renderComponent();
    expect(screen.getByText("Free Demo Lab")).toBeTruthy();
  });

  it("renders the main heading", () => {
    renderComponent();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Nmap Port Scanner");
  });

  it("renders the description paragraph", () => {
    renderComponent();
    expect(screen.getByText(/no account required/i)).toBeTruthy();
  });

  it("renders the IP input field with correct label", () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toBe("e.g., 192.168.1.1");
  });

  it("renders the Scan button", () => {
    renderComponent();
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.textContent).toContain("Scan");
  });

  it("renders quick IP suggestion buttons", () => {
    renderComponent();
    expect(screen.getByText("192.168.1.1")).toBeTruthy();
    expect(screen.getByText("10.0.0.1")).toBeTruthy();
    expect(screen.getByText("8.8.8.8")).toBeTruthy();
  });

  it("renders the terminal window", () => {
    renderComponent();
    expect(screen.getByText(/terminal — nmap scan/i)).toBeTruthy();
  });

  it("shows 'Awaiting target input' in the terminal initially", () => {
    renderComponent();
    expect(screen.getByText("Awaiting target input...")).toBeTruthy();
  });

  it("shows the empty state message when no results", () => {
    renderComponent();
    expect(screen.getByText(/Enter an IP address and click Scan/i)).toBeTruthy();
  });

  it("renders the CTA button to create an account", async () => {
    renderComponent();
    const ctaBtn = screen.getByText("Create Free Account");
    expect(ctaBtn).toBeTruthy();
    await userEvent.click(ctaBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/auth");
  });

  // ── Input State ──

  it("disables Scan button when input is empty", () => {
    renderComponent();
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.hasAttribute("disabled")).toBe(true);
  });

  it("enables Scan button when input has text", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.hasAttribute("disabled")).toBe(false);
  });

  // ── Quick IP Buttons ──

  it("fills the input when a quick IP button is clicked", async () => {
    renderComponent();
    await userEvent.click(screen.getByText("192.168.1.1"));
    const input = screen.getByLabelText("Target IP address") as HTMLInputElement;
    expect(input.value).toBe("192.168.1.1");
  });

  it("enables Scan button after clicking quick IP button", async () => {
    renderComponent();
    await userEvent.click(screen.getByText("10.0.0.1"));
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.hasAttribute("disabled")).toBe(false);
  });

  // ── Validation (uses userEvent, real timers) ──

  it("shows validation error for non-IP input", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "not-an-ip");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    expect(screen.getByText(/Invalid IP format/i)).toBeTruthy();
  });

  it("shows validation error when IP octets exceed 255", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "999.999.999.999");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    expect(screen.getByText(/Each octet must be 0-255/i)).toBeTruthy();
  });

  it("clears validation error when user types valid IP after error", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "bad");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    expect(screen.getByText(/Invalid IP format/i)).toBeTruthy();
    // Clear and type valid IP — error should disappear via onChange handler
    await userEvent.clear(input);
    await userEvent.type(input, "192.168.1.1");
    expect(screen.queryByText(/Invalid IP format/i)).toBeNull();
  });

  // ── Scan flow (fake timers, manual advance) ──

  it("completes scan and shows results with fake timers", async () => {
    runScanWithFakeTimers();
    await advanceScan();

    // Scanning... should NOT be visible (state was true->false in one batch)
    expect(screen.queryByText("Scanning...")).toBeNull();
    // Scan button should be enabled again (scanning=false)
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.hasAttribute("disabled")).toBe(false);

    vi.useRealTimers();
  });

  it("shows result cards, OS fingerprint, and ports after scan", async () => {
    runScanWithFakeTimers();
    await advanceScan();

    // Result cards
    expect(screen.getByText("Open Ports")).toBeTruthy();
    expect(screen.getByText("Latency")).toBeTruthy();
    // OS fingerprint
    expect(screen.getByText("OS Fingerprint")).toBeTruthy();
    // Ports table
    expect(screen.getByText("Discovered Ports")).toBeTruthy();

    vi.useRealTimers();
  });

  it("shows result buttons (Explain This, New Scan) after scan", async () => {
    runScanWithFakeTimers();
    await advanceScan();

    expect(screen.getByText("Explain This")).toBeTruthy();
    expect(screen.getByText("New Scan")).toBeTruthy();

    vi.useRealTimers();
  });

  it("toggles explanation panel on click", async () => {
    runScanWithFakeTimers();
    await advanceScan();

    expect(screen.getByText("Explain This")).toBeTruthy();

    // Click Explain This (fireEvent — userEvent hangs with fake timers)
    fireEvent.click(screen.getByText("Explain This"));
    expect(screen.getByText("What does this mean?")).toBeTruthy();

    // Click Hide Explanation
    fireEvent.click(screen.getByText("Hide Explanation"));
    expect(screen.queryByText("What does this mean?")).toBeNull();

    vi.useRealTimers();
  });

  it("resets to initial state when New Scan is clicked", async () => {
    runScanWithFakeTimers();
    await advanceScan();

    expect(screen.getByText("Open Ports")).toBeTruthy();

    // Click New Scan (fireEvent — userEvent hangs with fake timers)
    fireEvent.click(screen.getByText("New Scan"));

    // Should return to empty state
    expect(screen.getByText(/Awaiting target input/)).toBeTruthy();
    expect((screen.getByLabelText("Target IP address") as HTMLInputElement).value).toBe("");

    vi.useRealTimers();
  });

  it("handles Enter key to trigger scan", async () => {
    vi.useFakeTimers();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    fireEvent.change(input, { target: { value: "192.168.1.1" } });

    // Press Enter
    fireEvent.keyDown(input, { key: "Enter" });

    await advanceScan();

    // Results should appear
    expect(screen.getByText("Open Ports")).toBeTruthy();

    vi.useRealTimers();
  });
});
