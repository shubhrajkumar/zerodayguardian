import { env } from "../config/env.mjs";
import { logWarn } from "../utils/logger.mjs";

const LEVEL_WEIGHT = {
  info: 1,
  warn: 2,
  error: 3,
};

const lastSentAt = new Map();

const shouldAlert = (level = "warn") => {
  if (!env.alertWebhookUrl) return false;
  const min = LEVEL_WEIGHT[env.alertMinLevel] || LEVEL_WEIGHT.warn;
  const current = LEVEL_WEIGHT[level] || LEVEL_WEIGHT.warn;
  return current >= min;
};

const canSendKey = (key) => {
  const now = Date.now();
  const last = Number(lastSentAt.get(key) || 0);
  if (now - last < env.alertCooldownMs) return false;
  lastSentAt.set(key, now);
  return true;
};

export const sendAlert = async ({ level = "warn", key = "generic", title, message, meta = {} } = {}) => {
  if (!shouldAlert(level)) return false;
  if (!canSendKey(key)) return false;
  try {
    const response = await fetch(env.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        level,
        service: env.serviceName,
        env: env.nodeEnv,
        key,
        title: String(title || "backend alert"),
        message: String(message || ""),
        meta,
      }),
    });
    if (!response.ok) {
      logWarn("Alert webhook rejected request", { statusCode: response.status, key, level });
      return false;
    }
    return true;
  } catch (error) {
    logWarn("Alert webhook delivery failed", { key, level, reason: String(error?.message || error) });
    return false;
  }
};
