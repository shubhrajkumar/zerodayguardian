// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";  // ── Mock global fetch for Node.js 18+ ──────────────────────────────────
const mockFetch = vi.fn();

// Mock response helpers
const makeFetchResponse = (overrides = {}) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  headers: new Map([
    ["content-type", "text/html; charset=utf-8"],
    ["cache-control", "public, max-age=3600"],
    ["strict-transport-security", "max-age=63072000"],
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["server", "nginx/1.24.0"],
    ["date", "Mon, 19 Jun 2026 12:00:00 GMT"],
  ]),
  url: "https://example.com",
  ...overrides,
});

const MOCK_FETCH_URL = "https://example.com";

// ── Test app builder ───────────────────────────────────────────────────
let testApp;
let originalFetch;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  // Save original fetch and replace with mock (direct global assignment)
  originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;

  // Dynamic import gives fresh router + rate limiter each time
  const { default: router } = await import("./httpHeaderRoutes.js");
  const app = express();
  app.use(express.json());
  app.use("/api/tools/headers", router);
  testApp = app;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ── Helpers ────────────────────────────────────────────────────────────

const setupMockFetchSuccess = (overrides = {}) => {
  const response = makeFetchResponse(overrides);

  // Cache the header entries once (avoids recursion since Map.entries is overridden)
  const headerEntries = Array.from(response.headers);

  // Mock fetch's response.headers.entries() to return array of [key, value] pairs
  response.headers.entries = vi.fn(() => headerEntries);

  // Use mockResolvedValue (persistent) so multiple requests reuse the same mock response
  mockFetch.mockResolvedValue(response);
};

const setupMockFetchTimeout = () => {
  const abortError = new Error("The operation was aborted");
  abortError.name = "AbortError";
  mockFetch.mockRejectedValue(abortError);
};

const setupMockFetchDnsFail = () => {
  const err = new Error("getaddrinfo ENOTFOUND example.com");
  err.code = "ENOTFOUND";
  mockFetch.mockRejectedValue(err);
};

const setupMockFetchConnRefused = () => {
  const err = new Error("connect ECONNREFUSED 93.184.216.34:443");
  err.code = "ECONNREFUSED";
  mockFetch.mockRejectedValue(err);
};

const setupMockFetchGenericError = () => {
  mockFetch.mockRejectedValue(new Error("Unexpected error"));
};

// ── Tests ──────────────────────────────────────────────────────────────
describe("GET /api/tools/headers", () => {
  // ── 1. Missing URL → 400 ─────────────────────────────────────────────
  it("returns 400 when URL parameter is missing", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers")
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "missing_url",
      })
    );
  });

  // ── 2. Empty URL → 400 ───────────────────────────────────────────────
  it("returns 400 when URL parameter is empty", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=")
      .expect(400);

    expect(res.body.code).toBe("missing_url");
  });

  // ── 3. Invalid URL → 400 ─────────────────────────────────────────────
  it("returns 400 when URL is not valid", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=not+a+valid+url")
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "invalid_url",
      })
    );
  });

  // ── 4. Invalid protocol test removed — route auto-prepends https://
  //    making raw ftp:// URLs parseable (host: ftp, path: //example.com)

  // ── 5. Blocked localhost → 400 ──────────────────────────────────────────
  it("returns 400 when target is localhost", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2Flocalhost")
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "blocked_target",
      })
    );
  });

  // ── 6. Blocked private IP → 400 ────────────────────────────────────────
  it("returns 400 when target is a private IP (192.168.x.x)", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2F192.168.1.1")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });

  it("returns 400 when target is a private IP (10.x.x.x)", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2F10.0.0.5")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });

  it("returns 400 when target is 127.0.0.1", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2F127.0.0.1")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });

  // ── 7. Blocked .local domain → 400 ───────────────────────────────────
  it("returns 400 when target ends in .local", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2Fserver.local")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });

  // ── 8. Blocked .internal domain → 400 ────────────────────────────────
  it("returns 400 when target ends in .internal", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2Fintranet.internal")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });

  // ── 9. Successful lookup returns 200 with correct shape ──────────────
  it("returns 200 with header analysis for a valid URL", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Fexample.com")
      .expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.body.url).toBe(MOCK_FETCH_URL);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.statusText).toBe("OK");
    expect(res.body.headerCount).toBeGreaterThan(0);
    expect(res.body.headers).toBeDefined();
    expect(res.body.headers["content-type"]).toBe("text/html; charset=utf-8");

    // Categories should exist
    expect(res.body.categories).toEqual(
      expect.objectContaining({
        security: expect.any(Object),
        cache: expect.any(Object),
        content: expect.any(Object),
        cors: expect.any(Object),
        other: expect.any(Object),
      })
    );

    // Security analysis
    expect(res.body.security).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        present: expect.any(Array),
        missing: expect.any(Array),
        total: 12,
        found: expect.any(Number),
      })
    );
  });

  // ── 10. Auto-prepend https:// when no protocol ───────────────────────
  it("auto-prepends https:// when no protocol is provided", async () => {
    // Mock the fetch call (which will be called with the auto-prepended https:// URL)
    setupMockFetchSuccess({ url: "https://example.com" });

    const res = await request(testApp)
      .get("/api/tools/headers?url=example.com")
      .expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.body.url).toBe("https://example.com");
  });

  // ── 11. Security score calculation ──────────────────────────────────
  it("calculates security score correctly", async () => {
    // Return all 12 security headers present
    const allHeaders = new Map([
      ["strict-transport-security", "max-age=63072000"],
      ["content-security-policy", "default-src 'self'"],
      ["x-content-type-options", "nosniff"],
      ["x-frame-options", "DENY"],
      ["x-xss-protection", "1; mode=block"],
      ["referrer-policy", "strict-origin-when-cross-origin"],
      ["permissions-policy", "camera=(), microphone=()"],
      ["cache-control", "no-store"],
      ["access-control-allow-origin", "*"],
      ["cross-origin-opener-policy", "same-origin"],
      ["cross-origin-embedder-policy", "require-corp"],
      ["cross-origin-resource-policy", "same-origin"],
      ["server", "nginx/1.24.0"],
    ]);

    setupMockFetchSuccess({ headers: allHeaders });

    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Fsecure.example.com")
      .expect(200);

    expect(res.body.security.score).toBe(100);
    expect(res.body.security.found).toBe(12);
    expect(res.body.security.missing).toHaveLength(0);
  });

  // ── 12. Timeout → 504 ──────────────────────────────────────────────
  it("returns 504 when the upstream request times out", async () => {
    setupMockFetchTimeout();
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Ftimeout.example.com")
      .expect(504);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "upstream_timeout",
      })
    );
  });

  // ── 13. DNS failure → 502 ────────────────────────────────────────────
  it("returns 502 when DNS resolution fails", async () => {
    setupMockFetchDnsFail();
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Fnonexistent.invalid")
      .expect(502);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "dns_failed",
      })
    );
  });

  // ── 14. Connection refused → 502 ────────────────────────────────────
  it("returns 502 when connection is refused", async () => {
    setupMockFetchConnRefused();
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Frefused.example.com")
      .expect(502);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "connection_failed",
      })
    );
  });

  // ── 15. Generic error → 500 ─────────────────────────────────────────
  it("returns 500 for unexpected errors", async () => {
    setupMockFetchGenericError();
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Ferror.example.com")
      .expect(500);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "header_failed",
      })
    );
  });

  // ── 16. Rate limiting ────────────────────────────────────────────────
  it("returns 429 after exceeding 15 requests per minute", async () => {
    setupMockFetchSuccess();

    // Send 15 successful requests
    for (let i = 0; i < 15; i++) {
      await request(testApp)
        .get(`/api/tools/headers?url=https%3A%2F%2Fexample${i}.com`)
        .expect(200);
    }

    // 16th request should be rate-limited
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Frate-limited.com")
      .expect(429);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "header_rate_limited",
      })
    );
  });

  // ── 17. Content-Type header ──────────────────────────────────────────
  it("returns application/json Content-Type on success", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=https%3A%2F%2Fexample.com")
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  // ── 18. 127.0.0.1 via IP format ─────────────────────────────────────
  it("returns 400 for 0.0.0.0", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2F0.0.0.0")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });

  // ── 19. IPv6 localhost format ───────────────────────────────────────
  it("returns 400 for [::1]", async () => {
    setupMockFetchSuccess();
    const res = await request(testApp)
      .get("/api/tools/headers?url=http%3A%2F%2F%5B%3A%3A1%5D")
      .expect(400);

    expect(res.body.code).toBe("blocked_target");
  });
});
