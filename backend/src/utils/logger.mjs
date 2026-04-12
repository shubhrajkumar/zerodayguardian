import { env } from "../config/env.mjs";

const now = () => new Date().toISOString();
const LEVEL_EMOJI = {
  info: "✅",
  warn: "⚠️",
  error: "❌",
};
const base = () => ({
  ts: now(),
  service: "neurobot-backend",
  env: env.nodeEnv,
  pid: process.pid,
});

const SENSITIVE_META_KEYS = new Set([
  "authorization",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "apikey",
  "password",
  "secret",
]);

const limit = (value, max = 400) => {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

const sanitizeMeta = (input, depth = 0) => {
  if (input == null || depth > 3) return input;
  if (Array.isArray(input)) return input.slice(0, 20).map((item) => sanitizeMeta(item, depth + 1));
  if (typeof input !== "object") {
    if (typeof input === "string") return limit(input, 500);
    return input;
  }

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_META_KEYS.has(String(key))) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeMeta(value, depth + 1);
  }
  return output;
};

const normalizeError = (error) => {
  if (!error) return null;
  return {
    name: String(error?.name || "Error"),
    message: limit(error?.message || error, 500),
    code: String(error?.code || ""),
    statusCode: Number(error?.statusCode || error?.status || 0) || 0,
    provider: String(error?.provider || ""),
    rootCause: String(error?.rootCause || ""),
    ...(env.nodeEnv !== "production" && error?.stack ? { stack: limit(error.stack, 5000) } : {}),
  };
};

const emit = (level, message, meta = {}, error = null) => {
  const payload = {
    ...base(),
    level,
    emoji: LEVEL_EMOJI[level] || "ℹ️",
    msg: String(message),
    ...sanitizeMeta(meta),
    ...(error ? { error: normalizeError(error) } : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else process.stdout.write(`${line}\n`);
};

export const logInfo = (message, meta = {}) => {
  emit("info", message, meta);
};

export const logWarn = (message, meta = {}) => {
  emit("warn", message, meta);
};

export const logError = (message, error, meta = {}) => {
  emit("error", message, meta, error);
};

export const redact = (value = "") => {
  const s = String(value);
  if (!s) return "";
  if (s.length <= 8) return "********";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};
