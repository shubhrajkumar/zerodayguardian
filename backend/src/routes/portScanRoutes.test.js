// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock net.Socket ─────────────────────────────────────────────────────
const mockSocket = {
  setTimeout: vi.fn(),
  destroy: vi.fn(),
  on: vi.fn(),
  connect: vi.fn(),
};

const mockNet = {
  Socket: vi.fn(() => mockSocket),
};

vi.mock("node:net", () => ({
  default: mockNet,
}));

// ── Mock dns ────────────────────────────────────────────────────────────
const mockDns = {
  lookup: vi.fn(),
};

vi.mock("node:dns", () => ({
  default: mockDns,
}));

// ── Test app builder ───────────────────────────────────────────────────
let testApp;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  // Reset mockSocket event callbacks
  mockSocket.on.mockReset();
  mockSocket.connect.mockReset();
  mockSocket.setTimeout.mockReset();
  mockSocket.destroy.mockReset();

  // Setup mockSocket.on to capture event handlers
  const eventHandlers = {};
  mockSocket.on.mockImplementation((event, handler) => {
    eventHandlers[event] = handler;
    return mockSocket;
  });

  // Store eventHandlers on the mock for tests to use
  mockSocket._eventHandlers = eventHandlers;

  // Stub setTimeout
  mockSocket.setTimeout.mockImplementation((ms) => mockSocket);

  // Dynamic import gives fresh router + rate limiter each time
  const { default: router } = await import("./portScanRoutes.js");
  const app = express();
  app.use(express.json());
  app.use("/api/tools/portscan", router);
  testApp = app;
});

// ── Helpers ────────────────────────────────────────────────────────────

/** Set up dns.lookup to resolve successfully */
const mockDnsResolve = (ip = "93.184.216.34") => {
  mockDns.lookup.mockImplementation((hostname, opts, cb) => {
    if (typeof opts === "function") {
      cb = opts;
    }
    cb(null, ip, 4);
  });
};

/** Set up dns.lookup to fail with ENOTFOUND */
const mockDnsFail = () => {
  mockDns.lookup.mockImplementation((hostname, opts, cb) => {
    if (typeof opts === "function") {
      cb = opts;
    }
    const err = new Error("getaddrinfo ENOTFOUND");
    err.code = "ENOTFOUND";
    cb(err);
  });
};

/**
 * Trigger a socket connect event for the given port.
 * Each call to scanPort creates a new socket, so we need to track
 * which event handler set corresponds to which port.
 */
const triggerSocketConnect = (port) => {
  // The last registered 'connect' handler fires
  const handler = mockSocket._eventHandlers["connect"];
  if (handler) handler();
};

const triggerSocketTimeout = () => {
  const handler = mockSocket._eventHandlers["timeout"];
  if (handler) handler();
};

const triggerSocketError = () => {
  const handler = mockSocket._eventHandlers["error"];
  if (handler) handler();
};

// ── Tests ──────────────────────────────────────────────────────────────
describe("POST /api/tools/portscan", () => {
  // ── 1. Missing target → 400 ───────────────────────────────────────────
  it("returns 400 when target is missing", async () => {
    mockDnsResolve();
    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ group: "web" })
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "missing_target",
      })
    );
  });

  // ── 2. Empty target → 400 ────────────────────────────────────────────
  it("returns 400 when target is empty string", async () => {
    mockDnsResolve();
    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "", group: "web" })
      .expect(400);

    // Empty string fails first at the `if (!target)` check → missing_target
    expect(res.body.code).toBe("missing_target");
  });

  // ── 3. DNS resolution failure → 400 ──────────────────────────────────
  it("returns 400 with dns_resolution_failed when hostname does not resolve", async () => {
    mockDnsFail();
    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "nonexistent.invalid", group: "web" })
      .expect(400);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "dns_resolution_failed",
      })
    );
  });

  // ── 4. Valid target with web group returns 200 with correct shape ────
  it("returns 200 with scan results for valid target and web group", async () => {
    mockDnsResolve();

    // For 'web' group: ports [80, 443, 8080, 8443] — 4 ports
    // Simulate: 80 open, 443 filtered, 8080 closed, 8443 filtered
    const openPorts = new Set([80]);
    const filteredPorts = new Set([443, 8443]);

    // Each call to scanPort creates a new socket, so on is called fresh each time
    // We need to intercept at the port scan level
    // Instead, let's make the first socket open, rest filtered
    let socketCallCount = 0;

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") {
        socketCallCount++;
        // Make port 80 open, others filtered
        if (socketCallCount === 1) {
          // First port (80) — open
          process.nextTick(() => handler());
        }
        // For other ports, don't trigger connect — they'll timeout
      }
      if (event === "timeout") {
        process.nextTick(() => handler());
      }
      if (event === "error") {
        // No errors expected
      }
      return mockSocket;
    });

    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "example.com", group: "web" })
      .expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.body.target).toBe("example.com");
    expect(res.body.scanned).toBe(4);
    expect(res.body.open).toBe(1);
    expect(res.body.filtered).toBe(3);
    expect(res.body.closed).toBe(0);
    expect(res.body.results).toHaveLength(4);
    expect(res.body.results[0]).toEqual(
      expect.objectContaining({
        port: 80,
        state: "open",
        service: "HTTP",
      })
    );
    expect(res.body.results[1]).toEqual(
      expect.objectContaining({
        port: 443,
        state: "filtered",
        service: "HTTPS",
      })
    );
    expect(res.body.scanDurationMs).toEqual(expect.any(Number));
  });

  // ── 5. Custom ports payload ──────────────────────────────────────────
  it("returns 200 with custom ports list", async () => {
    mockDnsResolve();

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") process.nextTick(() => handler());
      if (event === "timeout") process.nextTick(() => handler());
      return mockSocket;
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "scanme.nmap.org", ports: [22, 80, 443] })
      .expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.body.target).toBe("scanme.nmap.org");
    expect(res.body.scanned).toBe(3);
  });

  // ── 6. Invalid port values are filtered out ─────────────────────────
  it("filters out invalid port numbers from custom list", async () => {
    mockDnsResolve();

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") process.nextTick(() => handler());
      if (event === "timeout") process.nextTick(() => handler());
      return mockSocket;
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "scanme.nmap.org", ports: [22, -1, 0, 99999, 80, "invalid"] })
      .expect(200);

    // Only 22 and 80 are valid (1–65535)
    expect(res.body.scanned).toBe(2);
  });

  // ── 7. Default to all ports when no group or ports specified ─────────
  it("defaults to all ports when neither group nor ports are specified", async () => {
    mockDnsResolve();

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") process.nextTick(() => handler());
      if (event === "timeout") process.nextTick(() => handler());
      return mockSocket;
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "example.com" })
      .expect(200);

    // 23 default ports
    expect(res.body.scanned).toBe(23);
  });

  // ── 8. Rate limiting ─────────────────────────────────────────────────
  it("returns 429 after exceeding 5 requests per minute", async () => {
    mockDnsResolve();
    let callCount = 0;

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") process.nextTick(() => handler());
      if (event === "timeout") process.nextTick(() => handler());
      return mockSocket;
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    // Send 5 successful requests
    for (let i = 0; i < 5; i++) {
      await request(testApp)
        .post("/api/tools/portscan")
        .send({ target: "example.com", group: "web" })
        .expect(200);
    }

    // 6th request should be rate-limited
    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "example.com", group: "web" })
      .expect(429);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "portscan_rate_limited",
      })
    );
  });

  // ── 9. Target normalization strips protocol and path ─────────────────
  it("normalizes https:// URLs to bare hostname", async () => {
    mockDnsResolve();

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") process.nextTick(() => handler());
      if (event === "timeout") process.nextTick(() => handler());
      return mockSocket;
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "https://example.com/path/to/page", group: "web" })
      .expect(200);

    // Target should be normalized to bare hostname
    expect(res.body.target).toBe("example.com");
  });

  // ── 10. Content-Type is application/json ─────────────────────────────
  it("returns application/json Content-Type on success", async () => {
    mockDnsResolve();

    mockSocket.on.mockImplementation((event, handler) => {
      if (event === "connect") process.nextTick(() => handler());
      if (event === "timeout") process.nextTick(() => handler());
      return mockSocket;
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "example.com", group: "web" })
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  // ── 11. Outermost catch block (scan_failed) ───────────────────────────
  it("returns 500 with scan_failed when an unexpected error occurs during scanning", async () => {
    mockDnsResolve();

    // Make socket.on throw unexpectedly — this rejects scanPort's promise,
    // which propagates through scanWithConcurrency → Promise.all → route handler
    // and hits the outermost catch block → scan_failed
    mockSocket.on.mockImplementation(() => {
      throw new Error("Simulated unexpected socket failure");
    });
    mockSocket.setTimeout.mockImplementation((ms) => mockSocket);
    mockSocket.destroy.mockImplementation(() => {});

    const res = await request(testApp)
      .post("/api/tools/portscan")
      .send({ target: "example.com", group: "web" })
      .expect(500);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "error",
        code: "scan_failed",
      })
    );
  });
});
