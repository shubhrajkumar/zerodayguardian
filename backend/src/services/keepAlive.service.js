import cron from "node-cron";
import axios from "axios";
import { logInfo, logWarn } from "../utils/logger.mjs";

// ── Configuration ──────────────────────────────────────────────────────
const PYTHON_BACKEND_URL = (process.env.PYTHON_BACKEND_URL || "").replace(
  /\/+$/,
  ""
);
const PING_PATH = "/health";
const PING_TIMEOUT_MS = 8_000; // 8s — Render cold-start can be slow

let scheduledTask = null;

// ── Ping function ──────────────────────────────────────────────────────
// Sends a lightweight GET to the Python backend /health endpoint.
// Wrapped in try/catch so a failed ping never crashes the Node process.
// Cyber rationale: Render free tier spins down after 15 minutes of
// inactivity. A ping every 5 minutes keeps the service warm and
// prevents 503 Bad Gateway during student labs.
const pingPythonBackend = async () => {
  if (!PYTHON_BACKEND_URL) return;

  const url = `${PYTHON_BACKEND_URL}${PING_PATH}`;
  try {
    const response = await axios.get(url, {
      timeout: PING_TIMEOUT_MS,
      // Don't follow redirects — just confirm the server is alive
      maxRedirects: 0,
      // Validate HTTP status to avoid false-positive "success" on 5xx
      validateStatus: (status) => status >= 200 && status < 400,
    });

    logInfo("Python backend keep-alive ping succeeded", {
      url,
      status: response.status,
      latencyMs: response.headers?.["x-response-time"] || null,
    });
  } catch (error) {
    // Silent log — ping failures are expected when the Python service is
    // cold-starting or temporarily overloaded. Don't spam error alerts.
    const status = error?.response?.status || 0;
    const reason = error?.code || String(error?.message || "").slice(0, 120);

    logWarn("Python backend keep-alive ping failed", {
      url,
      status,
      reason,
    });
  }
};

// ── Scheduler ──────────────────────────────────────────────────────────
// Starts a cron job that runs every 5 minutes. The `scheduledTask`
// reference is stored so it can be stopped cleanly on shutdown.
export const startKeepAliveScheduler = () => {
  if (!PYTHON_BACKEND_URL) {
    logWarn("Python backend keep-alive skipped — PYTHON_BACKEND_URL is not set");
    return null;
  }

  // Prevent duplicate schedulers
  if (scheduledTask) {
    logWarn("Python backend keep-alive scheduler already running");
    return scheduledTask;
  }

  // Cron: every 5 minutes — keeps Render free-tier instance warm
  scheduledTask = cron.schedule("*/5 * * * *", pingPythonBackend, {
    scheduled: true,
    // Run the first ping 30 seconds after startup (not immediately)
    // to give the Python backend time to initialize if needed.
    timezone: undefined, // Use UTC for consistency
  });

  // Unref the cron timer so it doesn't keep the Node process alive
  // during graceful shutdown.
  if (scheduledTask?.stop) {
    // node-cron v4 returns a ScheduledTask; its timer isn't directly
    // accessible, but the stop() method works for cleanup.
  }

  logInfo("Python backend keep-alive scheduler started", {
    url: PYTHON_BACKEND_URL,
    cronExpression: "*/5 * * * *",
    target: `${PYTHON_BACKEND_URL}${PING_PATH}`,
  });

  // Fire an initial ping after a short delay (not blocking startup)
  setTimeout(() => {
    pingPythonBackend().catch(() => undefined);
  }, 30_000);

  return scheduledTask;
};

// ── Stop ───────────────────────────────────────────────────────────────
// Called during graceful shutdown to cancel the cron job cleanly.
export const stopKeepAliveScheduler = () => {
  if (!scheduledTask) return;

  try {
    scheduledTask.stop();
  } catch {
    // Swallow — stop() is best-effort
  }

  scheduledTask = null;
  logInfo("Python backend keep-alive scheduler stopped");
};

export default { startKeepAliveScheduler, stopKeepAliveScheduler };
