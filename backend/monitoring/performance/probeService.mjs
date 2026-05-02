import { verifyDbConnection } from "../../src/config/db.mjs";
import { getRuntimeState } from "../../src/state/runtimeState.mjs";
import { env } from "../../src/config/env.mjs";
import { logWarn } from "../../src/utils/logger.mjs";

const READINESS_CACHE_TTL_MS = 7000;
let readinessCache = null;
const PROBE_TIMEOUT_MS = 1500;
const LOG_COOLDOWN_MS = 60000;

const probeState = {
  livez: { failures: 0, healthy: true, lastLogAt: 0 },
  readyz: { failures: 0, healthy: true, lastLogAt: 0 },
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nextBackoffDelayMs = (failures) => {
  if (failures < 2) return 0;
  const exp = Math.min(4, failures - 2);
  const base = Math.min(200, 50 * 2 ** exp);
  const jitter = Math.floor(Math.random() * 51);
  return Math.min(250, base + jitter);
};

const logProbeState = (probeName, healthy, reason = "") => {
  const state = probeState[probeName];
  const now = Date.now();
  const transitioned = state.healthy !== healthy;
  const cooldownPassed = now - state.lastLogAt >= LOG_COOLDOWN_MS;
  if (!transitioned && !cooldownPassed) return;
  state.healthy = healthy;
  state.lastLogAt = now;
  if (healthy) {
    if (env.nodeEnv !== "production") {
      logWarn(`${probeName} recovered`);
    }
    return;
  }
  logWarn(`${probeName} probe degraded${reason ? ` (${reason})` : ""}`);
};

const applyFailureBackoff = async (probeName) => {
  const state = probeState[probeName];
  state.failures += 1;
  const delayMs = nextBackoffDelayMs(state.failures);
  if (delayMs > 0) await wait(delayMs);
};

const resetProbeFailures = (probeName) => {
  probeState[probeName].failures = 0;
};

const checkEventLoopResponsive = async () => {
  const started = Date.now();
  await withTimeout(
    new Promise((resolve) => setImmediate(resolve)),
    50
  );
  return Date.now() - started;
};

export const getLiveness = async () => {
  const runtime = getRuntimeState();
  if (runtime.fatal) {
    logProbeState("livez", false, "fatal_state");
    await applyFailureBackoff("livez");
    return {
      http: 500,
      payload: {
        status: "fatal",
        uptime: runtime.uptimeSeconds,
      },
    };
  }

  try {
    await checkEventLoopResponsive();
    resetProbeFailures("livez");
    logProbeState("livez", true);
    return {
      http: 200,
      payload: {
        status: "alive",
        uptime: runtime.uptimeSeconds,
      },
    };
  } catch {
    logProbeState("livez", false, "event_loop_unresponsive");
    await applyFailureBackoff("livez");
    return {
      http: 500,
      payload: {
        status: "fatal",
        uptime: runtime.uptimeSeconds,
      },
    };
  }
};

export const getReadiness = async () => {
  const startedAt = Date.now();
  if (readinessCache && startedAt - readinessCache.timestamp <= READINESS_CACHE_TTL_MS) {
    return {
      http: readinessCache.http,
      payload: {
        status: readinessCache.status,
        db: readinessCache.db,
        auth: readinessCache.auth,
        responseTime: Date.now() - startedAt,
      },
    };
  }

  let db = "down";
  let auth = "down";

  const authProbe = async () => {
    const hasGoogleConfig = Boolean(
      String(env.googleOauthClientId || "").trim() &&
      String(env.googleOauthClientSecret || "").trim() &&
      String(env.googleRedirectUri || "").trim() &&
      String(env.appBaseUrl || "").trim() &&
      String(env.backendPublicUrl || "").trim()
    );
    if (!hasGoogleConfig) throw new Error("google_auth_not_ready");
    return { ok: true };
  };

  const [dbResult, authResult] = await Promise.allSettled([
    withTimeout(verifyDbConnection(), PROBE_TIMEOUT_MS),
    withTimeout(authProbe(), PROBE_TIMEOUT_MS),
  ]);

  if (dbResult.status === "fulfilled") db = "up";
  else if (env.nodeEnv !== "production") logWarn("Readiness DB check failed");

  if (authResult.status === "fulfilled") auth = "up";
  else if (env.nodeEnv !== "production") logWarn("Readiness auth check failed");

  const ready = db === "up" && auth === "up";
  if (ready) {
    resetProbeFailures("readyz");
    logProbeState("readyz", true);
  } else {
    logProbeState("readyz", false, "dependency_unavailable");
    await applyFailureBackoff("readyz");
  }
  const payload = {
    status: ready ? "ready" : "not_ready",
    db,
    auth,
    responseTime: Date.now() - startedAt,
  };
  readinessCache = {
    timestamp: Date.now(),
    http: ready ? 200 : 503,
    ...payload,
  };
  return { http: ready ? 200 : 503, payload };
};
