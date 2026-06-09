// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock node-cron ─────────────────────────────────────────────────────
const mockCronStop = vi.fn();
const mockCronSchedule = vi.fn().mockReturnValue({ stop: mockCronStop });

vi.mock("node-cron", () => ({
  default: { schedule: mockCronSchedule },
}));

// ── Mock axios ─────────────────────────────────────────────────────────
const mockAxiosGet = vi.fn();
vi.mock("axios", () => ({
  default: { get: mockAxiosGet },
}));

// ── Mock logger ────────────────────────────────────────────────────────
vi.mock("../../utils/logger.mjs", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────
/**
 * Load a fresh module instance with the given PYTHON_BACKEND_URL.
 * Uses vi.resetModules() to reset the module-level singleton state.
 */
const loadModule = async (envUrl = "https://python-backend.onrender.com") => {
  process.env.PYTHON_BACKEND_URL = envUrl;
  vi.resetModules();
  return import("./keepAlive.service.js");
};

// ── Tests ──────────────────────────────────────────────────────────────
describe("keepAlive.service", () => {
  const originalEnv = process.env.PYTHON_BACKEND_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PYTHON_BACKEND_URL = originalEnv || "";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PYTHON_BACKEND_URL;
    } else {
      process.env.PYTHON_BACKEND_URL = originalEnv;
    }
    vi.useRealTimers();
  });

  // ── 1. startKeepAliveScheduler registers a cron job ───────────────────
  it("starts a cron job with the correct 5-minute schedule", async () => {
    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    const task = startKeepAliveScheduler();

    expect(mockCronSchedule).toHaveBeenCalledWith(
      "*/5 * * * *",
      expect.any(Function),
      expect.objectContaining({ scheduled: true })
    );
    expect(task).toBeDefined();
    expect(task.stop).toBe(mockCronStop);

    stopKeepAliveScheduler();
  });

  // ── 2. startKeepAliveScheduler returns null when URL is empty ─────────
  it("returns null and skips scheduling when PYTHON_BACKEND_URL is empty", async () => {
    const { startKeepAliveScheduler } = await loadModule("");

    const task = startKeepAliveScheduler();

    expect(task).toBeNull();
    expect(mockCronSchedule).not.toHaveBeenCalled();
  });

  // ── 3. stopKeepAliveScheduler calls stop on the cron task ─────────────
  it("stops the cron task and clears the reference", async () => {
    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();
    stopKeepAliveScheduler();

    expect(mockCronStop).toHaveBeenCalledOnce();
  });

  // ── 4. stopKeepAliveScheduler is safe to call when not started ────────
  it("does not throw when stop is called without a running scheduler", async () => {
    const { stopKeepAliveScheduler } = await loadModule();

    expect(() => stopKeepAliveScheduler()).not.toThrow();
    expect(mockCronStop).not.toHaveBeenCalled();
  });

  // ── 5. Duplicate start is prevented ───────────────────────────────────
  it("returns the existing task and warns when started twice", async () => {
    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    const first = startKeepAliveScheduler();
    const second = startKeepAliveScheduler();

    expect(second).toBe(first);
    expect(mockCronSchedule).toHaveBeenCalledOnce();

    stopKeepAliveScheduler();
  });

  // ── 6. Ping succeeds with 200 ────────────────────────────────────────
  it("pings the Python backend successfully on cron tick", async () => {
    mockAxiosGet.mockResolvedValueOnce({ status: 200, headers: {} });

    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();

    // Extract the callback passed to cron.schedule and invoke it manually
    const cronCallback = mockCronSchedule.mock.calls[0][1];
    await cronCallback();

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://python-backend.onrender.com/health",
      expect.objectContaining({
        timeout: 8000,
        maxRedirects: 0,
      })
    );

    stopKeepAliveScheduler();
  });

  // ── 7. Ping failure is caught silently ────────────────────────────────
  it("catches ping errors without throwing", async () => {
    mockAxiosGet.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();

    const cronCallback = mockCronSchedule.mock.calls[0][1];
    await expect(cronCallback()).resolves.toBeUndefined();

    stopKeepAliveScheduler();
  });

  // ── 8. Ping failure with HTTP 503 ────────────────────────────────────
  it("catches 5xx responses as errors", async () => {
    const err = Object.assign(new Error("Request failed with status 503"), {
      response: { status: 503 },
      code: "ERR_BAD_REQUEST",
    });
    mockAxiosGet.mockRejectedValueOnce(err);

    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();

    const cronCallback = mockCronSchedule.mock.calls[0][1];
    await expect(cronCallback()).resolves.toBeUndefined();

    stopKeepAliveScheduler();
  });

  // ── 9. Initial ping fires via setTimeout at 30s ──────────────────────
  it("schedules an initial ping via setTimeout after 30 seconds", async () => {
    vi.useFakeTimers();
    const realSetTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();

    // The service calls setTimeout(fn, 30_000) — verify it was called
    expect(realSetTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      30_000
    );

    stopKeepAliveScheduler();
    realSetTimeoutSpy.mockRestore();
  });

  // ── 10. Initial ping timeout invokes the ping function ────────────────
  it("initial ping timeout invokes the ping function", async () => {
    mockAxiosGet.mockResolvedValueOnce({ status: 200, headers: {} });

    // Capture the real setTimeout so we can invoke the callback
    let capturedFn = null;
    const realSetTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn) => {
      capturedFn = fn;
      return 12345;
    });

    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();

    // Simulate the setTimeout firing
    expect(capturedFn).not.toBeNull();
    await capturedFn();

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://python-backend.onrender.com/health",
      expect.any(Object)
    );

    stopKeepAliveScheduler();
    realSetTimeoutSpy.mockRestore();
  });

  // ── 11. Ping skips when URL is empty ──────────────────────────────────
  it("does not make HTTP requests when PYTHON_BACKEND_URL is empty", async () => {
    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule("");

    startKeepAliveScheduler();

    expect(mockAxiosGet).not.toHaveBeenCalled();

    stopKeepAliveScheduler();
  });

  // ── 12. Stop is idempotent ───────────────────────────────────────────
  it("can be stopped multiple times safely", async () => {
    const { startKeepAliveScheduler, stopKeepAliveScheduler } = await loadModule();

    startKeepAliveScheduler();
    stopKeepAliveScheduler();
    stopKeepAliveScheduler(); // second stop should not throw

    expect(mockCronStop).toHaveBeenCalledOnce();
  });

  // ── 13. Default export shape ──────────────────────────────────────────
  it("exports startKeepAliveScheduler and stopKeepAliveScheduler", async () => {
    const mod = await loadModule();

    expect(typeof mod.startKeepAliveScheduler).toBe("function");
    expect(typeof mod.stopKeepAliveScheduler).toBe("function");
    expect(typeof mod.default.startKeepAliveScheduler).toBe("function");
    expect(typeof mod.default.stopKeepAliveScheduler).toBe("function");
  });
});
