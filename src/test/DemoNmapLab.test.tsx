/**
 * DemoNmapLab Tests — Covers rendering, target validation, quick-buttons, scan
 * flow (with mocked fetch), and error states.
 *
 * The scan phase timers use real setTimeout (~200ms each), so we mock the
 * network layer with vi.fn() on globalThis.fetch and wait for async UI updates
 * via waitFor / findByText.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock data ──

const MOCK_SCAN_RESPONSE = {
  status: "ok",
  target: "192.168.1.1",
  scanned: 23,
  open: 3,
  filtered: 2,
  closed: 18,
  results: [
    { port: 22, service: "SSH", state: "open", latencyMs: 24 },
    { port: 80, service: "HTTP", state: "open", latencyMs: 18 },
    { port: 443, service: "HTTPS", state: "open", latencyMs: 31 },
    { port: 3306, service: "MySQL", state: "filtered", latencyMs: null },
    { port: 8080, service: "HTTP-Alt", state: "filtered", latencyMs: null },
  ],
  scanDurationMs: 1842,
};

// ── Mocks ──

const mockNavigate = vi.fn();

// Mock framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    motion: {
      div: ({
        children,
        ...props
      }: React.PropsWithChildren<Record<string, unknown>>) => {
        const {
          initial,
          animate,
          exit,
          transition,
          whileHover,
          whileTap,
          onHoverStart,
          onHoverEnd,
          ...rest
        } = props;
        return <div {...rest}>{children}</div>;
      },
      p: ({
        children,
        ...props
      }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { initial, animate, transition, ...rest } = props;
        return <p {...rest}>{children}</p>;
      },
      span: ({
        children,
        ...props
      }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { animate, transition, ...rest } = props;
        return <span {...rest}>{children}</span>;
      },
      button: ({
        children,
        ...props
      }: React.PropsWithChildren<Record<string, unknown>>) => {
        const { whileHover, whileTap, ...rest } = props;
        return <button {...rest}>{children}</button>;
      },
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import DemoNmapLab from "@/pages/Labs/DemoNmapLab";

// ── Helpers ──

const renderComponent = () => render(<DemoNmapLab />);

const mockFetchSuccess = () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(MOCK_SCAN_RESPONSE),
  });
};

const mockFetchError = (status: number, body?: Record<string, unknown>) => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () =>
      Promise.resolve(body ?? { error: "Port scan failed." }),
  });
};

const mockFetchNetworkError = () => {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
};

const mockFetchTimeout = () => {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));
};

// ── Tests ──

describe("DemoNmapLab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──

  it("renders the Free Demo Lab badge", () => {
    renderComponent();
    expect(screen.getByText("Free Demo Lab")).toBeTruthy();
  });

  it("renders the main heading", () => {
    renderComponent();
    expect(
      screen.getByRole("heading", { level: 1 }).textContent
    ).toContain("Nmap Port Scanner");
  });

  it("renders the description paragraph", () => {
    renderComponent();
    expect(screen.getByText(/no account required/i)).toBeTruthy();
  });

  it("renders the IP input field with correct label and placeholder", () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toBe("e.g., scanme.nmap.org");
  });

  it("renders the Scan button", () => {
    renderComponent();
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.textContent).toContain("Scan");
  });

  it("renders quick target suggestion buttons", () => {
    renderComponent();
    expect(screen.getByText("scanme.nmap.org")).toBeTruthy();
    expect(screen.getByText("192.168.1.1")).toBeTruthy();
    expect(screen.getByText("example.com")).toBeTruthy();
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
    expect(
      screen.getByText(/Enter an IP address or hostname and click Scan/i)
    ).toBeTruthy();
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
    await userEvent.type(input, "scanme.nmap.org");
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.hasAttribute("disabled")).toBe(false);
  });

  // ── Quick Target Buttons ──

  it("fills the input when a quick target button is clicked", async () => {
    renderComponent();
    await userEvent.click(screen.getByText("scanme.nmap.org"));
    const input = screen.getByLabelText("Target IP address") as HTMLInputElement;
    expect(input.value).toBe("scanme.nmap.org");
  });

  it("enables Scan button after clicking quick target button", async () => {
    renderComponent();
    await userEvent.click(screen.getByText("192.168.1.1"));
    const scanBtn = screen.getByRole("button", { name: /run scan/i });
    expect(scanBtn.hasAttribute("disabled")).toBe(false);
  });

  // ── Validation ──

  it("shows validation error for gibberish input", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "!!!invalid!!!");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    // Validation error appears both below input AND in terminal, so use getAllByText
    expect(screen.getAllByText(/Invalid target/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Invalid Target Ingress Structure/i)
    ).toBeTruthy();
  });

  it("shows validation error when IP octets exceed 255", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "999.999.999.999");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    // Error text appears both inline (setError) and in terminal — use getAllByText
    expect(
      screen.getAllByText(/Each IP octet must be 0–255/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Invalid Target Ingress Structure/i)
    ).toBeTruthy();
  });

  it("clears validation error when user types valid input after error", async () => {
    renderComponent();
    const input = screen.getByLabelText("Target IP address");
    // "%%%" is not a valid IP or hostname — triggers validation
    await userEvent.type(input, "%%%");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    // Multiple elements match (inline + terminal) — check at least one exists
    expect(screen.getAllByText(/Invalid target/i).length).toBeGreaterThanOrEqual(1);
    await userEvent.clear(input);
    await userEvent.type(input, "192.168.1.1");
    // Inline error (starts with "Invalid target —") should be cleared
    // Terminal line (starts with "[!] ERROR: Invalid Target Ingress Structure") persists — that's fine
    expect(screen.queryByText(/^Invalid target —/)).toBeNull();
  });

  // ── Scan flow (mocked fetch) ──
  // Phase delays total ~3s, so use generous test timeout
  const SCAN_TEST_TIMEOUT = 15_000;

  it("completes a scan and shows result cards", async () => {
    mockFetchSuccess();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    // Wait for scan to complete and results to appear
    // Phase delays total ~3s, so use ample timeout
    await waitFor(
      () => {
        expect(screen.getByText("Open Ports")).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
    expect(screen.getByText("Duration")).toBeTruthy();
    expect(screen.getByText("Discovered Ports")).toBeTruthy();
    expect(screen.getByText("Explain This")).toBeTruthy();
    expect(screen.getByText("New Scan")).toBeTruthy();
  });

  it("displays discovered port entries in the ports table", async () => {
    mockFetchSuccess();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(screen.getByText("SSH")).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
    expect(screen.getByText("HTTP")).toBeTruthy();
    expect(screen.getByText("HTTPS")).toBeTruthy();
  });

  it("shows OS fingerprint note with TCP connect scan message", async () => {
    mockFetchSuccess();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "scanme.nmap.org");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/OS Fingerprint/i)).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
    expect(
      screen.getByText(/TCP connect scan — OS detection requires privileged SYN scan/i)
    ).toBeTruthy();
  });

  it("toggles explanation panel when Explain This is clicked", async () => {
    mockFetchSuccess();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(screen.getByText("Explain This")).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );

    fireEvent.click(screen.getByText("Explain This"));
    expect(screen.getByText("What does this mean?")).toBeTruthy();

    fireEvent.click(screen.getByText("Hide Explanation"));
    expect(screen.queryByText("What does this mean?")).toBeNull();
  });

  it("resets to initial state when New Scan is clicked", async () => {
    mockFetchSuccess();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(screen.getByText("Open Ports")).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );

    fireEvent.click(screen.getByText("New Scan"));

    // Should return to empty state
    expect(screen.getByText(/Awaiting target input/)).toBeTruthy();
    expect(
      (screen.getByLabelText("Target IP address") as HTMLInputElement).value
    ).toBe("");
  });

  it("handles Enter key to trigger scan", async () => {
    mockFetchSuccess();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(
      () => {
        expect(screen.getByText("Open Ports")).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
  });

  // ── Error states ──

  it("shows terminal error on network failure", async () => {
    mockFetchNetworkError();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(
          screen.getByText(/\[!\] ERROR: Invalid Target Ingress Structure/)
        ).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
  });

  it("shows terminal error on backend 400 response", async () => {
    mockFetchError(400, {
      error: "Hostname could not be resolved.",
    });
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "nonexistent.invalid");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(
          screen.getByText(
            /\[!\] CRITICAL: Hostname could not be resolved/
          )
        ).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
  });

  it("shows terminal error on backend 429 rate limit", async () => {
    mockFetchError(429, {
      error: "Too many port scans. Please wait and retry.",
    });
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(
          screen.getByText(/Too many port scans/)
        ).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
  });

  it("shows timeout error when scan exceeds 30s", async () => {
    mockFetchTimeout();
    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));

    await waitFor(
      () => {
        expect(
          screen.getByText(/\[!\] CRITICAL: Outpost Connection Timeout/)
        ).toBeTruthy();
      },
      { timeout: 10000, interval: 200 }
    );
  });

  it("disables button during scanning to prevent double-submit", async () => {
    // Simulate a slow response — delay the fetch resolution
    globalThis.fetch = vi
      .fn()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve(MOCK_SCAN_RESPONSE),
                }),
              100
            )
          )
      );

    renderComponent();

    const input = screen.getByLabelText("Target IP address");
    await userEvent.type(input, "192.168.1.1");
    const scanBtn = screen.getByRole("button", { name: /run scan/i });

    await userEvent.click(scanBtn);

    // Button should show "Scanning..." and be disabled
    expect(scanBtn.textContent).toContain("Scanning");
    expect(scanBtn.hasAttribute("disabled")).toBe(true);
  });
});
