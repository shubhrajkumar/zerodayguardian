import { randomUUID, timingSafeEqual } from "node:crypto";
import { buildCookieOptions } from "../utils/cookiePolicy.mjs";
import { logInfo, logWarn, redact } from "../utils/logger.mjs";

const CSRF_COOKIE = "neurobot_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ensureCsrfCookie = (req, res) => {
  if (req.csrfToken && typeof req.csrfToken === "string" && req.csrfToken.length > 8) return req.csrfToken;
  const existing = req.cookies?.[CSRF_COOKIE];
  if (existing && typeof existing === "string" && existing.length > 8) {
    req.csrfToken = existing;
    return existing;
  }
  const token = randomUUID();
  req.csrfToken = token;
  if (!req.cookies || typeof req.cookies !== "object") {
    req.cookies = {};
  }
  req.cookies[CSRF_COOKIE] = token;
  try {
    res.cookie(CSRF_COOKIE, token, buildCookieOptions({
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    }));
  } catch (error) {
    logWarn("Failed to set CSRF cookie", {
      requestId: req.requestId || "",
      error: String(error),
      token: redact(token),
    });
  }
  logInfo("CSRF cookie issued", {
    requestId: req.requestId || "",
    origin: String(req.headers.origin || ""),
    host: String(req.headers.host || ""),
    method: req.method,
    path: req.originalUrl || req.url || "",
    token: redact(token),
  });
  return token;
};

export const issueCsrfToken = (req, res, next) => {
  const token = ensureCsrfCookie(req, res);
  req.csrfToken = token;
  next();
};

export const requireCsrf = (req, res, next) => {
  ensureCsrfCookie(req, res);
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];
  const validTokens =
    typeof cookieToken === "string" &&
    typeof headerToken === "string" &&
    cookieToken.length > 8 &&
    headerToken.length === cookieToken.length &&
    timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));

  if (validTokens) {
    next();
    return;
  }
  logWarn("CSRF validation failed", {
    requestId: req.requestId || "",
    origin: String(req.headers.origin || ""),
    host: String(req.headers.host || ""),
    method: req.method,
    path: req.originalUrl || req.url || "",
    hasCookieToken: typeof cookieToken === "string" && cookieToken.length > 8,
    hasHeaderToken: typeof headerToken === "string" && headerToken.length > 8,
    cookieToken: typeof cookieToken === "string" ? redact(cookieToken) : "",
    headerToken: typeof headerToken === "string" ? redact(headerToken) : "",
  });
  res.status(403).json({
    status: "error",
    error: "CSRF token invalid",
    code: "csrf_token_mismatch",
    requestId: req.requestId || "",
  });
};
