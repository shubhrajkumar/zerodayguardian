import { getCircuitState, recordSuccess } from "../services/circuitBreaker.js";

export const health = (_req, res) => {
  const state = getCircuitState();
  if (state.degraded && Date.now() - state.openedAt >= state.cooldownMs) {
    recordSuccess("health_reset");
  }
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
};
