import { incMetric } from "../../src/observability/telemetry.mjs";

const MAX_FAILURES = 3;
const OPEN_MS = 30_000;

const state = {
  failures: 0,
  degraded: false,
  openedAt: 0,
};

export const recordFailure = (source = "chat") => {
  state.failures += 1;
  if (state.failures > MAX_FAILURES && !state.degraded) {
    state.degraded = true;
    state.openedAt = Date.now();
    incMetric("chat_recovery_enter_total", 1, { source: `circuit_${source}` });
  }
};

export const recordSuccess = (source = "chat") => {
  const wasDegraded = state.degraded;
  state.failures = 0;
  state.degraded = false;
  state.openedAt = 0;
  if (wasDegraded) {
    incMetric("chat_recovery_restore_total", 1, { source: `circuit_${source}` });
  }
};

export const canAttempt = () => {
  if (!state.degraded) return true;
  return Date.now() - state.openedAt >= OPEN_MS;
};

export const getCircuitState = () => ({ ...state, maxFailures: MAX_FAILURES, cooldownMs: OPEN_MS });
