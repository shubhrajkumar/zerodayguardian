import { randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.mjs";

const CSRF_COOKIE = "neurobot_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ensureCsrfCookie = (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (existing && typeof existing === "string" && existing.length > 8) return existing;
  const token = randomUUID();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: "strict",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
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
    cookieToken.length === headerToken.length &&
    timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));

  if (validTokens) {
    next();
    return;
  }
  res.status(403).json({
    status: "error",
    error: "CSRF token invalid",
    code: "csrf_token_mismatch",
    requestId: req.requestId || "",
  });
};
