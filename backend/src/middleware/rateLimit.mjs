import rateLimit from "express-rate-limit";
import { env } from "../config/env.mjs";

const byIpAndUser = (req) => `${req.ip}:${req.user?.sub || "anon"}`;
const defaultRateResponse = (message, code = "rate_limited") => (req, res) => {
  const retryAfterSec = Math.max(1, Math.ceil(Number(req.rateLimit?.resetTime || Date.now()) - Date.now()) / 1000);
  res.status(429).json({
    status: "error",
    code,
    error: message,
    message,
    retryAfterSec: Math.max(1, Math.ceil(retryAfterSec)),
    requestId: req.requestId || "",
  });
};

const createLimiter = ({ windowMs, max, message, code = "rate_limited" }) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: byIpAndUser,
    standardHeaders: true,
    legacyHeaders: false,
    handler: defaultRateResponse(message, code),
  });

export const neurobotRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many requests. Please wait and try again.",
});

export const authRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 10 : 40,
  message: "Too many authentication attempts. Please wait and retry.",
  code: "auth_rate_limited",
});

export const authSessionRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many session checks. Please wait and retry.",
  code: "auth_session_rate_limited",
});

export const authProvidersRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Provider metadata limit reached. Please retry shortly.",
  code: "auth_providers_rate_limited",
});

export const chatRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: "Chat request limit reached. Slow down and retry shortly.",
});

export const apiReadRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 180 : 360,
  message: "Read request limit reached. Retry shortly.",
});

export const mutationRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 45 : 120,
  message: "Write request limit reached. Retry shortly.",
});

export const intelligenceRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 80,
  message: "Intelligence API rate limit reached. Retry shortly.",
});

export const osintRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: "OSINT rate limit reached. Please retry shortly.",
});

export const readyzRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 4,
  message: "Too many readiness checks.",
});

export const livezRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: 6,
  message: "Too many liveness checks.",
});

export const fileUploadRateLimit = createLimiter({
  windowMs: 60 * 1000,
  max: env.nodeEnv === "production" ? 12 : 30,
  message: "File upload rate limit reached. Retry shortly.",
});
