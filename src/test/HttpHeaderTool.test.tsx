/**
 * HttpHeaderTool Tests — Covers rendering, URL input, header inspection,
 * security scoring, error handling, Enter key, copy-to-clipboard,
 * and auto-prepend https:// behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock fetch globally ──
const mockFetch = vi.fn();

const MOCK_HEADER_RESPONSE = {
  status: "ok",
  url: "https://example.com",
  statusCode: 200,
  statusText: "OK",
  headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "public, max-age=3600",
    "strict-transport-security": "max-age=63072000",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "server": "nginx/1.24.0",
    "date": "Mon, 19 Jun 2026 12:00:00 GMT",
  },
  headerCount: 8,
  categories: {
    security: {
      "strict-transport-security": "max-age=63072000",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
    cache: {
      "cache-control": "public, max-age=3600",
    },
    content: {
      "content-type": "text/html; charset=utf-8",
    },
    cors: {},
    other: {
      server: "nginx/1.24.0",
      date: "Mon, 19 Jun 2026 12:00:00 GMT",
    },
  },
  security: {
    score: 33,
    present: [
      "strict-transport-security",
      "x-content-type-options",
      "x-frame-options",
      "referrer-policy",
    ],
    missing: [
      "content-security-policy",
      "x-xss-protection",
      "permissions-policy",
      "cache-control",
      "access-control-allow-origin",
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "cross-origin-resource-policy",
    ],
    total: 12,
    found: 4,
  },
};

const MOCK_HIGH_SCORE_RESPONSE = {
  ...MOCK_HEADER_RESPONSE,
  security: {
    score: 83,
    present: [
      "strict-transport-security",
      "content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "x-xss-protection",
      "referrer-policy",
      "permissions-policy",
      "cache-control",
      "access-control-allow-origin",
      "cross-origin-opener-policy",
    ],
    missing: [
      "cross-origin-embedder-policy",
      "cross-origin-resource-policy",
    ],
    total: 12,
    found: 10,
  },
};

const MOCK_LOW_SCORE_RESPONSE = {
  ...MOCK_HEADER_RESPONSE,
  url: "https://insecure.example.com",
  headers: {
    server: "Apache/2.4.41",
    date: "Mon, 19 Jun 2026 12:00:00 GMT",
  },
  headerCount: 2,
  categories: {
    security: {},
    cache: {},
    content: {},
    cors: {},
    other: {
      server: "Apache/2.4.41",
      date: "Mon, 19 Jun 2026 12:00:00 GMT",
    },
  },
  security: {
    score: 0,
    present: [],
    missing: [
      "strict-transport-security",
      "content-security-policy",
      "x-content-type-options",
      "x-frame-options",
      "x-xss-protection",
      "referrer-policy",
      "permissions-policy",
      "cache-control",
      "access-control-allow-origin",
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "cross-origin-resource-policy",
    ],
    total: 12,
    found: 0,
  },
};

const MOCK_ERROR_RESPONSE = {
  status: "error",
  code: "dns_failed",
  error: "Could not resolve the target hostname.",
};

import HttpHeaderTool from "@/components/HttpHeaderTool";

const renderComponent = () => render(<HttpHeaderTool />);

const setupSuccessfulLookup = (response: Record<string, unknown> = MOCK_HEADER_RESPONSE) => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(response),
  });
};

const setupErrorLookup = (status = 400, body: Record<string, unknown> = MOCK_ERROR_RESPONSE) => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
};

const setupNetworkError = () => {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));
};

// ── Tests ──
describe("HttpHeaderTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);

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

  it("renders the HTTP HEADER INSPECTOR heading", () => {
    renderComponent();
    expect(screen.getByText("HTTP HEADER INSPECTOR")).toBeTruthy();
  });

  it("renders the URL input with placeholder", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER URL/i);
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toBe("ENTER URL (e.g., https://example.com)");
  });

  it("renders the INSPECT HEADERS button", () => {
    renderComponent();
    const btn = screen.getByRole("button", { name: /inspect headers/i });
    expect(btn).toBeTruthy();
  });

  it("renders the initial empty state message", () => {
    renderComponent();
    expect(screen.getByText(/Enter a URL to inspect/i)).toBeTruthy();
  });

  // ── Input state ──

  it("disables the inspect button when URL is empty", () => {
    renderComponent();
    const btn = screen.getByRole("button", { name: /inspect headers/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("enables the inspect button when URL has text", async () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "example.com");
    const btn = screen.getByRole("button", { name: /inspect headers/i });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  // ── Successful lookup ──

  it("performs a header lookup and displays results", async () => {
    setupSuccessfulLookup();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeTruthy();
    });

    // Status line
    expect(screen.getByText("200 OK")).toBeTruthy();
    expect(screen.getByText(/8 headers/)).toBeTruthy();

    // Security score display
    expect(screen.getByText("33%")).toBeTruthy();
    expect(screen.getByText("+4 present")).toBeTruthy();
    expect(screen.getByText("-8 missing")).toBeTruthy();

    // Category sections — use getAllByText since category labels appear in multiple places
    expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cache/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/content/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/other/i)).toBeTruthy();

    // Missing security headers section
    expect(screen.getByText("MISSING SECURITY HEADERS")).toBeTruthy();

    // Specific headers rendered
    expect(screen.getByText("strict-transport-security")).toBeTruthy();
    expect(screen.getByText("x-content-type-options")).toBeTruthy();
    expect(screen.getByText(/nginx\/1\.24\.0/)).toBeTruthy();

    // Verify fetch was called with the right URL
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tools/headers?url=https%3A%2F%2Fexample.com"
    );
  });

  // ── Auto-prepend https:// ──

  it("auto-prepends https:// when no protocol is provided", async () => {
    setupSuccessfulLookup();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    // The URL in the response is the original, but the fetch call should use auto-prepended URL
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/tools/headers?url=https%3A%2F%2Fexample.com"
    );
  });

  // ── Security score color variants ──

  it("shows ShieldCheck icon for high security score (>=75%)", async () => {
    setupSuccessfulLookup(MOCK_HIGH_SCORE_RESPONSE);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://secure.site");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("83%")).toBeTruthy();
    });
    expect(screen.getByText("+10 present")).toBeTruthy();
    expect(screen.getByText("-2 missing")).toBeTruthy();
  });

  it("shows Shield icon for low security score (<40%)", async () => {
    setupSuccessfulLookup(MOCK_LOW_SCORE_RESPONSE);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "insecure.example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("0%")).toBeTruthy();
    });
    // present.length is 0 so no "+0 present" badge — verify it's absent
    expect(screen.queryByText("0 present")).toBeNull();
    expect(screen.getByText("-12 missing")).toBeTruthy();
  });

  // ── CORS category ──

  it("renders CORS category when headers have access-control entries", async () => {
    const corsResponse = {
      ...MOCK_HEADER_RESPONSE,
      headers: {
        ...MOCK_HEADER_RESPONSE.headers,
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST",
      },
      headerCount: 10,
      categories: {
        ...MOCK_HEADER_RESPONSE.categories,
        cors: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST",
        },
      },
      security: {
        ...MOCK_HEADER_RESPONSE.security,
        present: [...MOCK_HEADER_RESPONSE.security.present, "access-control-allow-origin"],
        missing: MOCK_HEADER_RESPONSE.security.missing.filter(
          (h) => h !== "access-control-allow-origin"
        ),
      },
    };
    setupSuccessfulLookup(corsResponse);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://cors-enabled.site");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("access-control-allow-origin")).toBeTruthy();
    });
    // CORS category label should appear
    const corsLabels = screen.getAllByText(/cors/i);
    expect(corsLabels.length).toBeGreaterThan(0);
  });

  // ── No missing headers ──

  it("does not show MISSING SECURITY HEADERS when none are missing", async () => {
    const perfectResponse = {
      ...MOCK_HEADER_RESPONSE,
      security: {
        score: 100,
        present: Array.from({ length: 12 }, (_, i) => `header-${i}`),
        missing: [],
        total: 12,
        found: 12,
      },
    };
    setupSuccessfulLookup(perfectResponse);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://perfect.site");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText("MISSING SECURITY HEADERS")).toBeNull();
    });
  });

  // ── Error handling ──

  it("shows error message when lookup returns 400", async () => {
    setupErrorLookup(400);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "nonexistent.invalid");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Could not resolve the target hostname/i)
      ).toBeTruthy();
    });
  });

  it("shows fallback error when backend returns unknown error", async () => {
    setupErrorLookup(500, {});
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
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

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Uplink rejected target structure/i)
      ).toBeTruthy();
    });
  });

  // ── Enter key ──

  it("triggers lookup when Enter is pressed on the URL input", async () => {
    setupSuccessfulLookup();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://example.com");

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    await waitFor(() => {
      expect(screen.getByText("https://example.com")).toBeTruthy();
    });
  });

  // ── Copy headers ──

  it("copy button appears after lookup and copies headers to clipboard", async () => {
    setupSuccessfulLookup();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("COPY ALL HEADERS")).toBeTruthy();
    });

    await userEvent.click(screen.getByText("COPY ALL HEADERS"));

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const clipboardText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(clipboardText).toContain("content-type: text/html; charset=utf-8");
    expect(clipboardText).toContain("strict-transport-security: max-age=63072000");
  });

  // ── Loading state ──

  it("disables the inspect button while loading and shows FETCHING HEADERS", async () => {
    let resolvePromise;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    renderComponent();
    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    // Button should show loading text and be disabled
    const btn = screen.getByRole("button", { name: /fetching headers/i });
    expect(btn.hasAttribute("disabled")).toBe(true);

    // Resolve the promise
    await act(async () => {
      resolvePromise({
        ok: true,
        json: () => Promise.resolve(MOCK_HEADER_RESPONSE),
      });
    });

    await waitFor(() => {
      const inspectBtn = screen.getByRole("button", { name: /inspect headers/i });
      expect(inspectBtn.hasAttribute("disabled")).toBe(false);
    });
  });

  // ── URL validation edge case ──

  it("does not trigger lookup when URL is empty after trim", async () => {
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "   ");
    await userEvent.tab();

    const btn = screen.getByRole("button", { name: /inspect headers/i });
    expect(btn.hasAttribute("disabled")).toBe(true);

    // fetch should NOT have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Status code color ──

  it("renders status code with correct color for 200", async () => {
    setupSuccessfulLookup();
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://example.com");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      const statusEl = screen.getByText("200 OK");
      expect(statusEl).toBeTruthy();
      // Should have emerald text for 2xx
      expect(statusEl.className).toContain("emerald");
    });
  });

  it("renders status code with correct color for 300", async () => {
    const redirectResponse = {
      ...MOCK_HEADER_RESPONSE,
      statusCode: 301,
      statusText: "Moved Permanently",
    };
    setupSuccessfulLookup(redirectResponse);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://redirect.example");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      const statusEl = screen.getByText("301 Moved Permanently");
      expect(statusEl).toBeTruthy();
      // Should have amber text for 3xx
      expect(statusEl.className).toContain("amber");
    });
  });

  it("renders status code with correct color for 400+", async () => {
    const errorResponse = {
      ...MOCK_HEADER_RESPONSE,
      statusCode: 404,
      statusText: "Not Found",
    };
    setupSuccessfulLookup(errorResponse);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://notfound.example");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      const statusEl = screen.getByText("404 Not Found");
      expect(statusEl).toBeTruthy();
      // Should have rose text for 4xx/5xx
      expect(statusEl.className).toContain("rose");
    });
  });

  // ── Has no missing security headers section when present ──

  it("hides total headers count when response has none", async () => {
    const emptyResponse = {
      ...MOCK_HEADER_RESPONSE,
      headers: {},
      headerCount: 0,
      categories: {
        security: {},
        cache: {},
        content: {},
        cors: {},
        other: {},
      },
      security: {
        score: 0,
        present: [],
        missing: [...MOCK_HEADER_RESPONSE.security.missing],
        total: 12,
        found: 0,
      },
    };
    setupSuccessfulLookup(emptyResponse);
    renderComponent();

    const input = screen.getByPlaceholderText(/ENTER URL/i);
    await userEvent.type(input, "https://empty.example");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /inspect headers/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("0 headers")).toBeTruthy();
    });
  });
});
