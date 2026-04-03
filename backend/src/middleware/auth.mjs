import jwt from "jsonwebtoken";
import { env } from "../config/env.mjs";
import { logInfo } from "../utils/logger.mjs";

const ACCESS_COOKIE = "neurobot_at";

const sendAuthError = (req, res, status, code, error) => {
  res.status(status).json({
    status: "error",
    code,
    error,
    requestId: req.requestId || "",
  });
};

const parseBearerToken = (authorization = "") => {
  const raw = String(authorization || "");
  const match = raw.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (!match) return null;
  const token = String(match[1] || "").trim();
  return token || null;
};

const parseQueryToken = (value = "") => {
  const token = String(value || "").trim();
  return token || null;
};

const verifyToken = (token) => {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    if (String(payload?.type || "").toLowerCase() === "refresh") {
      const error = new Error("Refresh token cannot be used for API access");
      error.name = "JsonWebTokenError";
      throw error;
    }
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
  const tokenFromQuery = parseQueryToken(req.query?.access_token);
  if (!tokenFromHeader && !tokenFromCookie && !tokenFromQuery) {
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

  const queryAttempt = tokenFromQuery ? verifyToken(tokenFromQuery) : null;
  if (queryAttempt?.ok) {
    req.user = queryAttempt.payload;
    req.authError = null;
    next();
    return;
  }

  const failure = headerAttempt?.error || cookieAttempt?.error || queryAttempt?.error || null;
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
      sendAuthError(req, res, 401, "token_expired", "Token expired");
      return;
    }
    if (req.authError === "token_invalid") {
      sendAuthError(req, res, 401, "token_invalid", "Invalid token");
      return;
    }
    sendAuthError(req, res, 401, "auth_required", "Authentication required");
    return;
  }
  next();
};

const normalizeRole = (value = "") => String(value || "").trim().toLowerCase();

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user?.sub) {
    sendAuthError(req, res, 401, "auth_required", "Authentication required");
    return;
  }
  const allowed = roles.map(normalizeRole);
  const role = normalizeRole(req.user?.role || "user");
  if (!allowed.length || allowed.includes(role)) {
    next();
    return;
  }
  sendAuthError(req, res, 403, "rbac_forbidden", "Forbidden");
};
