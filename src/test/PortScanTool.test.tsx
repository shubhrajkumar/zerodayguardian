/**
 * PortScanTool Tests — Covers rendering, port group selection, custom ports,
 * scan execution with mock apiFetch, progress indicator, error handling,
 * Enter key submission, and copy-to-clipboard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock apiFetch from apiClient ──
const { mockApiFetch } = vi.hoisted(() => ({
  mockApiFetch: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  apiFetch: mockApiFetch,
}));

const MOCK_SCAN_RESPONSE = {
  status: "ok",
  target: "scanme.nmap.org",
  scanned: 4,
  open: 2,
  filtered: 1,
  closed: 1,
  results: [
    { port: 22, service: "SSH", state: "open", latencyMs: 45 },
    { port: 80, service: "HTTP", state: "open", latencyMs: 52 },
    { port: 443, service: "HTTPS", state: "filtered", latencyMs: null },
    { port: 8080, service: "HTTP-Alt", state: "closed", latencyMs: null },
  ],
  scanDurationMs: 1234,
};

const MOCK_ERROR_RESPONSE = {
  status: "error",
  code: "dns_resolution_failed",
  error: "Hostname could not be resolved. Check the target and try again.",
};

import PortScanTool from "@/components/PortScanTool";

const renderComponent = () => render(<PortScanTool />);

const setupSuccessfulScan = () => {
  mockApiFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(MOCK_SCAN_RESPONSE),
  });
};

const setupErrorScan = (status = 400, body: Record<string, unknown> = MOCK_ERROR_RESPONSE) => {
  mockApiFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
};

const setupNetworkError = () => {
  mockApiFetch.mockRejectedValueOnce(new Error("Network error"));
};

// ── Tests ──
describe("PortScanTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // ── Rendering ──

  it("renders the PORT SCANNER heading", () => {
    renderComponent();
    expect(screen.getByText("PORT SCANNER")).toBeTruthy();
  });

  it("renders the host input with placeholder", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toBe("ENTER HOST (e.g., scanme.nmap.org)");
  });

  it("renders all 6 port group buttons", () => {
    renderComponent();
    ["Web", "Mail", "Database", "Infra", "All", "Custom"].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it("renders the SCAN PORTS button", () => {
    renderComponent();
    const btn = screen.getByRole("button", { name: /scan ports/i });
    expect(btn).toBeTruthy();
  });

  it("renders the initial empty state message", () => {
    renderComponent();
    expect(screen.getByText(/Select a port group, enter a host/i)).toBeTruthy();
  });

  it("renders custom port input when Custom group is selected", async () => {
    renderComponent();
    await userEvent.click(screen.getByText("Custom"));
    const customInput = screen.getByDisplayValue(/80,443,22,3306/);
    expect(customInput).toBeTruthy();
  });

  it("hides custom port input when switching away from Custom", async () => {
    renderComponent();
    await userEvent.click(screen.getByText("Custom"));
    expect(screen.getByDisplayValue(/80,443,22,3306/)).toBeTruthy();
    await userEvent.click(screen.getByText("Web"));
    expect(screen.queryByDisplayValue(/80,443,22,3306/)).toBeNull();
  });

  // ── Input state ──

  it("disables the scan button when host is empty", () => {
    renderComponent();
    const btn = screen.getByRole("button", { name: /scan ports/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("enables the scan button when host has text", async () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "scanme.nmap.org");
    const btn = screen.getByRole("button", { name: /scan ports/i });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  // ── Port group selection ──

  it("highlights the selected port group button", async () => {
    renderComponent();
    // Web should be selected by default (has selected styling)
    expect(screen.getByText("Web").className).toContain("bg-slate-800/80");

    // Click All
    await userEvent.click(screen.getByText("All"));
    expect(screen.getByText("All").className).toContain("bg-slate-800/80");
    // Web should no longer be selected — re-query to avoid stale DOM reference
    expect(screen.getByText("Web").className).toContain("bg-white/5");
  });

  // ── Successful scan ──

  it("performs a scan and displays results", async () => {
    setupSuccessfulScan();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "scanme.nmap.org");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("scanme.nmap.org")).toBeTruthy();
    });

    // Summary stats
    expect(screen.getByText("2 open")).toBeTruthy();
    expect(screen.getByText("1 filtered")).toBeTruthy();
    expect(screen.getByText("1 closed")).toBeTruthy();
    expect(screen.getByText(/4 total/)).toBeTruthy();

    // Port results
    expect(screen.getByText("SSH")).toBeTruthy();
    expect(screen.getByText("HTTP")).toBeTruthy();

    // Verify apiFetch was called with correct URL and payload
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/tools/portscan",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "scanme.nmap.org", group: "web" }),
      })
    );
  });

  it("sends the correct port group in the payload", async () => {
    setupSuccessfulScan();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "example.com");

    // Switch to All group
    await userEvent.click(screen.getByText("All"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/tools/portscan",
      expect.objectContaining({
        body: JSON.stringify({ target: "example.com", group: "all" }),
      })
    );
  });

  it("sends custom ports in the payload when Custom group is selected", async () => {
    setupSuccessfulScan();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "test.dev");

    // Switch to Custom
    await userEvent.click(screen.getByText("Custom"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.target).toBe("test.dev");
    expect(body.ports).toEqual([80, 443, 22, 3306]);
    expect(body.group).toBeUndefined();
  });

  // ── Scan progress indicator ──

  it("shows progress bar and port count during scan", async () => {
    // Use fake timers only for this test — use fireEvent (sync) instead of userEvent
    // Avoid waitFor() because it uses setTimeout which is captured by fake timers
    vi.useFakeTimers();

    let resolvePromise;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    fireEvent.change(input, { target: { value: "scanme.nmap.org" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    // Should show scanning state with port count
    expect(screen.getByText(/SCANNING 4 PORTS/)).toBeTruthy();
    expect(screen.getByText(/Probing 4 ports with 5 concurrent workers/)).toBeTruthy();

    // Verify the progress bar container renders (scanProgress starts at 0)
    const scanButton = screen.getByRole('button', { name: /scanning/i });
    expect(scanButton.textContent).toContain('0%');

    // Advance timers to make progress move
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Verify progress updated after advancing timers
    expect(scanButton.textContent).toMatch(/\d+%/);

    // Resolve the scan (don't use waitFor — it uses setTimeout)
    await act(async () => {
      resolvePromise({
        ok: true,
        json: () => Promise.resolve(MOCK_SCAN_RESPONSE),
      });
    });

    // Let React process the resolved state — flush microtasks
    await act(async () => {});

    // Assert results rendered synchronously
    expect(screen.queryByText("SSH")).toBeTruthy();
    expect(screen.queryByText("scanme.nmap.org")).toBeTruthy();

    vi.useRealTimers();
  });

  // ── Error handling ──

  it("shows error message when scan returns 400", async () => {
    setupErrorScan(400);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "nonexistent.invalid");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Hostname could not be resolved/i)
      ).toBeTruthy();
    });
  });

  it("shows fallback error when backend returns unknown error", async () => {
    setupErrorScan(500, {});
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Uplink rejected target structure/i)
      ).toBeTruthy();
    });
  });

  it("shows error message on network failure", async () => {
    setupNetworkError();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Uplink rejected target structure/i)
      ).toBeTruthy();
    });
  });

  it("shows error when custom ports list is empty", async () => {
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "test.dev");

    await userEvent.click(screen.getByText("Custom"));

    // Clear the custom ports input and type invalid values
    const customInput = screen.getByDisplayValue(/80,443,22,3306/);
    await userEvent.clear(customInput);
    await userEvent.type(customInput, "0,99999");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    expect(
      screen.getByText(/No valid ports specified in custom list/i)
    ).toBeTruthy();

    // apiFetch should NOT have been called
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // ── Enter key ──

  it("triggers scan when Enter is pressed on the host input", async () => {
    setupSuccessfulScan();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "scanme.nmap.org");

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => {
      expect(screen.getByText("scanme.nmap.org")).toBeTruthy();
    });
  });

  // ── Copy results ──

  it("copy button appears after scan and copies results to clipboard", async () => {
    setupSuccessfulScan();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "scanme.nmap.org");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("COPY TO CLIPBOARD")).toBeTruthy();
    });

    await userEvent.click(screen.getByText("COPY TO CLIPBOARD"));

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const clipboardText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(clipboardText).toContain("22/SSH");
    expect(clipboardText).toContain("80/HTTP");
  });

  // ── Input normalization ──

  it("strips protocol prefix from host input", async () => {
    setupSuccessfulScan();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "https://scanme.nmap.org/path");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("scanme.nmap.org")).toBeTruthy();
    });

    const body = JSON.parse(mockApiFetch.mock.calls[0][1].body);
    expect(body.target).toBe("scanme.nmap.org");
  });

  // ── Loading state ──

  it("disables the scan button while scanning", async () => {
    let resolvePromise;
    mockApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await userEvent.type(input, "scanme.nmap.org");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    // Button should be disabled during scan
    const btn = screen.getByRole("button", { name: /scanning/i });
    expect(btn.hasAttribute("disabled")).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolvePromise({
        ok: true,
        json: () => Promise.resolve(MOCK_SCAN_RESPONSE),
      });
    });

    await waitFor(() => {
      const scanBtn = screen.getByRole("button", { name: /scan ports/i });
      expect(scanBtn.hasAttribute("disabled")).toBe(false);
    });
  });

  // ── Shows same host after scan ──

  it("displays the target hostname in the results panel", async () => {
    setupSuccessfulScan();
    renderComponent();

    // Use fireEvent.change for the input to avoid userEvent timing issues
    const input = screen.getByPlaceholderText(/ENTER HOST/i);
    await act(async () => {
      fireEvent.change(input, { target: { value: "scanme.nmap.org" } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /scan ports/i }));
    });

    await waitFor(
      () => {
        // The results panel should include the target host
        const targetElements = screen.getAllByText("scanme.nmap.org");
        expect(targetElements.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
  });
});
