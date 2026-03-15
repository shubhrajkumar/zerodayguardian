import jwt from "jsonwebtoken";
import { env } from "../config/env.mjs";
import { logInfo } from "../utils/logger.mjs";

const ACCESS_COOKIE = "neurobot_at";

const parseBearerToken = (authorization = "") => {
  const raw = String(authorization || "");
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = String(match[1] || "").trim();
  return token || null;
};

const verifyToken = (token) => {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return { ok: true, payload, error: null };
  } catch (error) {
    return { ok: false, payload: null, error };
  }
};

export const optionalAuth = (req, _res, next) => {
  if (!env.jwtSecret) {
    req.user = null;
    req.authError = "jwt_secret_missing";
    next();
    return;
  }

  const tokenFromHeader = parseBearerToken(req.headers.authorization);
  const tokenFromCookie = req.cookies?.[ACCESS_COOKIE];
  if (!tokenFromHeader && !tokenFromCookie) {
    req.user = null;
    req.authError = "token_missing";
    next();
    return;
  }

  const headerAttempt = tokenFromHeader ? verifyToken(tokenFromHeader) : null;
  if (headerAttempt?.ok) {
    req.user = headerAttempt.payload;
    req.authError = null;
    next();
    return;
  }

  const cookieAttempt = tokenFromCookie ? verifyToken(tokenFromCookie) : null;
  if (cookieAttempt?.ok) {
    req.user = cookieAttempt.payload;
    req.authError = null;
    next();
    return;
  }

  const failure = headerAttempt?.error || cookieAttempt?.error || null;
  if (failure) {
    req.user = null;
    if (failure?.name === "TokenExpiredError") req.authError = "token_expired";
    else req.authError = "token_invalid";
    next();
    return;
  }
  req.user = null;
  req.authError = "token_invalid";
  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.user?.sub) {
    logInfo("Auth denied", {
      path: req.originalUrl || req.path,
      method: req.method,
      hasAuthorizationHeader: !!req.headers.authorization,
      hasCookieHeader: !!req.headers.cookie,
      authError: req.authError || "unknown",
      requestId: req.requestId || "",
    });
    if (req.authError === "token_expired") {
      res.status(401).json({ error: "Token expired" });
      return;
    }
    if (req.authError === "token_invalid") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user?.sub) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!roles.includes(req.user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
