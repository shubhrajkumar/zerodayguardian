import {
  authenticateGoogleCode,
  authenticateGoogleUser,
  buildGoogleOauthRedirectUrl,
  clearAuthCookies,
  getGoogleAuthConfigStatus,
  getUserById,
  loginUser,
  refreshAuth,
  registerUser,
  revokeRefreshSession,
  resetPassword,
  sendResetOtp,
  setAuthCookies,
} from "../src/services/authService.mjs";
import { env } from "../src/config/env.mjs";
import { assertAuthAttemptAllowed, recordAuthFailure, recordAuthSuccess } from "../src/services/authThreatService.mjs";
import { logError, logInfo, logWarn, redact } from "../src/utils/logger.mjs";

const resolveBackendBaseUrl = (req) => {
  if (env.backendPublicUrl) return env.backendPublicUrl;
  try {
    const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore host parsing errors
  }
  return env.appBaseUrl;
};

const resolveBackendAuthUrl = (req, path) => {
  const base = resolveBackendBaseUrl(req).replace(/\/+$/, "");
  try {
    return new URL(path, `${base}/`).toString();
  } catch {
    const fallbackBase = (env.backendPublicUrl || env.appBaseUrl).replace(/\/+$/, "");
    return `${fallbackBase}${path.startsWith("/") ? path : `/${path}`}`;
  }
};

const resolvePublicAuthPath = (req, suffix = "") => {
  const baseUrl = String(req.baseUrl || req.originalUrl || req.url || "");
  const useApiPrefix = baseUrl.startsWith("/api/auth");
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${useApiPrefix ? "/api/auth" : "/auth"}${normalizedSuffix}`;
};

const resolveAppRedirect = (target, fallbackPath = "/") => {
  const raw = String(target || "").trim() || fallbackPath;
  try {
    return new URL(raw, `${env.appBaseUrl.replace(/\/+$/, "")}/`).toString();
  } catch {
    return `${env.appBaseUrl.replace(/\/+$/, "")}${fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`}`;
  }
};

const appendQueryParam = (target, key, value) => {
  try {
    const url = new URL(target);
    url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return target;
  }
};

const isLocalAuthUrl = (target = "") => {
  try {
    const hostname = new URL(String(target || "")).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(hostname);
  } catch {
    return false;
  }
};

const toPublicUser = (user) =>
  user
      ? {
        id: user._id?.toString?.() || "",
        name: String(user.name || ""),
        email: String(user.email || ""),
        role: String(user.role || "user"),
        authProvider: String(user.authProvider || "local"),
        emailVerified: Boolean(user.emailVerified),
        avatarUrl: String(user.avatarUrl || ""),
      }
    : null;

const toTokenBackedUser = (authUser) =>
  authUser
    ? {
        id: String(authUser?.sub || ""),
        name: String(authUser?.name || authUser?.preferred_username || "Operator"),
        email: String(authUser?.email || ""),
        role: String(authUser?.role || "user"),
        authProvider: String(authUser?.authProvider || "local"),
        emailVerified: Boolean(authUser?.emailVerified || authUser?.email_verified),
        avatarUrl: String(authUser?.avatarUrl || ""),
      }
    : null;

const sendAuthError = (req, res, error) => {
  const status = Number(error?.status || error?.statusCode || 500) || 500;
  res.status(status).json({
    status: "error",
    code: error.code || "INTERNAL_SERVER_ERROR",
    message: error.message || "An unexpected error occurred.",
    ...(Array.isArray(error?.missingKeys) ? { missingKeys: error.missingKeys } : {}),
    ...(error?.action ? { action: String(error.action) } : {}),
    ...(error?.retryAfterSec ? { retryAfterSec: Number(error.retryAfterSec) || 0 } : {}),
    requestId: req.requestId || "",
  });
};

const safeRecordAuthSuccess = async (payload) => {
  try {
    await recordAuthSuccess(payload);
  } catch {
    // Keep auth responses non-blocking when audit persistence degrades.
  }
};

const safeRecordAuthFailure = async (payload) => {
  try {
    await recordAuthFailure(payload);
  } catch {
    // Keep auth responses non-blocking when audit persistence degrades.
  }
};

const normalizeRefreshError = (error) => {
  const current = error || {};
  const message = String(current.message || "").toLowerCase();
  const code = String(current.code || "").toLowerCase();
  if (
    code.includes("refresh") ||
    code.includes("token") ||
    code.includes("jwt") ||
    message.includes("refresh") ||
    message.includes("token") ||
    message.includes("jwt")
  ) {
    const normalized = new Error(current.message || "Refresh session unavailable");
    normalized.status = 401;
    normalized.code = current.code || "refresh_unavailable";
    return normalized;
  }
  if (current.status || current.statusCode) return current;
  return current;
};

export const signup = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
    logInfo("Auth signup request", { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    const user = await registerUser(req.validatedBody);
    const { accessToken, refreshToken } = await setAuthCookies(res, user);
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.status(201).json({ status: "ok", user: toPublicUser(user), accessToken, refreshToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: error?.code || "signup_failed" });
    logError("Auth signup failed", error, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, error);
  }
};

const mapAuthDependencyError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (
    error?.code === "db_unavailable" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("server selection")
  ) {
    const mapped = new Error("Authentication database is temporarily unavailable. Please retry in a few seconds.");
    mapped.status = 503;
    mapped.code = "db_unavailable_auth";
    return mapped;
  }
  return error;
};

export const login = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
    logInfo("Auth login request", { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    const user = await loginUser(req.validatedBody);
    const { accessToken, refreshToken } = await setAuthCookies(res, user, { rememberMe: req.validatedBody.rememberMe === true });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", user: toPublicUser(user), accessToken, refreshToken });
  } catch (error) {
    const normalized = mapAuthDependencyError(error);
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: normalized?.code || "login_failed" });
    logError("Auth login failed", normalized, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, normalized);
  }
};

export const googleLogin = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: "google-oauth" });
    const tokenPreview = String(req.validatedBody?.credential || "").substring(0, 20);
    logInfo("Auth Google login request", {
      requestId: req.requestId || "",
      hasCredential: Boolean(req.validatedBody?.credential),
      tokenPrefix: tokenPreview ? `${tokenPreview}...` : "missing",
    });
    if (!req.validatedBody?.credential) {
      throw Object.assign(new Error("Google credential is required. Expected field: 'credential' in the request body (received from Firebase idToken)."), {
        status: 400,
        code: "google_token_required",
      });
    }
    const user = await authenticateGoogleUser({ idToken: req.validatedBody?.credential });
    const { accessToken, refreshToken } = await setAuthCookies(res, user, { rememberMe: true });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", user: toPublicUser(user), accessToken, refreshToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: "google-oauth", reason: error?.code || "google_login_failed" });
    logError("Auth Google login failed", error, {
      requestId: req.requestId || "",
      code: String(error?.code || ""),
      message: String(error?.message || ""),
      missingKeys: Array.isArray(error?.missingKeys) ? error.missingKeys : undefined,
    });
    sendAuthError(req, res, error);
  }
};

export const startGoogleOauth = async (req, res) => {
  try {
    logInfo("Auth Google OAuth start", { requestId: req.requestId || "" });
    const next = String(req.query?.next || "").trim();
    const googleAuth = getGoogleAuthConfigStatus();
    if (!googleAuth.enabled) {
      const err = Object.assign(new Error("Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET."), {
        status: 503,
        code: "google_auth_not_configured",
        missingKeys: googleAuth.missingKeys,
        invalidKeys: googleAuth.invalidKeys,
        action: googleAuth.invalidKeys?.length
          ? "Fix invalid Google OAuth environment variables or remove them to disable."
          : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment.",
      });
      logWarn("Google OAuth start blocked — not configured", {
        requestId: req.requestId || "",
        missingKeys: googleAuth.missingKeys,
        invalidKeys: googleAuth.invalidKeys,
      });
      sendAuthError(req, res, err);
      return;
    }
    const redirectUrl = buildGoogleOauthRedirectUrl({ state: next || "" });
    logInfo("Auth Google OAuth redirecting", {
      requestId: req.requestId || "",
      redirectUrl: String(redirectUrl || "").substring(0, 120),
    });
    res.redirect(302, redirectUrl);
  } catch (error) {
    logError("Auth Google OAuth start failed", error, {
      requestId: req.requestId || "",
      code: String(error?.code || ""),
      message: String(error?.message || ""),
    });
    sendAuthError(req, res, error);
  }
};

export const sendOtp = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
    logInfo("Auth send OTP request", { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    const result = await sendResetOtp(req.validatedBody);
    // Only record auth success when email was actually sent (not preview mode)
    if (result.sent === true) {
      await safeRecordAuthSuccess({ req, identifier: req.validatedBody?.email || "" });
    }
    res.json({ status: "ok", ...result });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: error?.code || "send_otp_failed" });
    logError("Auth send OTP failed", error, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, error);
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
    logInfo("Auth reset password request", { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    const user = await resetPassword(req.validatedBody);
    const { accessToken, refreshToken } = await setAuthCookies(res, user);
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", message: "Password reset successful", user: toPublicUser(user), accessToken, refreshToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: error?.code || "reset_password_failed" });
    logError("Auth reset password failed", error, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, error);
  }
};

const parseBearerToken = (authorization = "") => {
  const raw = String(authorization || "");
  const match = raw.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (!match) return null;
  const token = String(match[1] || "").trim();
  return token || null;
};

export const refreshSession = async (req, res) => {
  try {
    const tokenFromHeader = parseBearerToken(req.headers.authorization);
    const refreshToken = req.validatedBody?.refreshToken || req.cookies?.zdg_refresh || req.cookies?.neurobot_rt || tokenFromHeader;
    logInfo("Auth refresh request", {
      requestId: req.requestId || "",
      hasRefreshCookie: Boolean(req.cookies?.zdg_refresh || req.cookies?.neurobot_rt),
      hasRefreshBody: Boolean(req.validatedBody?.refreshToken),
      hasRefreshHeader: Boolean(tokenFromHeader),
    });
    const { user, rememberMe } = await refreshAuth(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = await setAuthCookies(res, user, { rememberMe });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", user: toPublicUser(user), accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    const normalizedError = normalizeRefreshError(error);
    await safeRecordAuthFailure({ req, identifier: req.ip || "refresh", reason: normalizedError?.code || "refresh_failed" });
    logError("Auth refresh failed", normalizedError, { requestId: req.requestId || "" });
    sendAuthError(req, res, normalizedError);
  }
};

export const logout = async (req, res) => {
  try {
    const tokenFromHeader = parseBearerToken(req.headers.authorization);
    const refreshToken = req.validatedBody?.refreshToken || req.cookies?.zdg_refresh || req.cookies?.neurobot_rt || tokenFromHeader;
    logInfo("Auth logout request", {
      requestId: req.requestId || "",
      hasRefreshCookie: Boolean(req.cookies?.zdg_refresh || req.cookies?.neurobot_rt),
      hasRefreshBody: Boolean(req.validatedBody?.refreshToken),
      hasRefreshHeader: Boolean(tokenFromHeader),
    });
    if (refreshToken) {
      await revokeRefreshSession(refreshToken);
    }
    clearAuthCookies(res);
    res.status(204).end();
  } catch (error) {
    logError("Auth logout failed", error, { requestId: req.requestId || "" });
    sendAuthError(req, res, error);
  }
};

export const getAuthProviders = async (req, res) => {
  const googleAuth = getGoogleAuthConfigStatus();
  const startPath = resolvePublicAuthPath(req, "/google");
  const callbackPath = resolvePublicAuthPath(req, "/google/callback");
  const startUrl = resolveBackendAuthUrl(req, startPath);
  const callbackUrl = resolveBackendAuthUrl(req, callbackPath);
  const redirectUri = googleAuth.hasExplicitRedirectUri && !isLocalAuthUrl(googleAuth.redirectUri)
    ? googleAuth.redirectUri
    : callbackUrl;
  const googleAction = googleAuth.enabled
    ? ""
    : googleAuth.invalidKeys?.length
      ? "Fix invalid Google OAuth environment variables or remove them to keep Google sign-in disabled."
      : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment to enable Google sign-in.";
  if (!googleAuth.enabled) {
    logInfo("Google auth provider disabled", {
      requestId: req.requestId || "",
      missingKeys: googleAuth.missingKeys,
      invalidKeys: googleAuth.invalidKeys,
      action: googleAction,
    });
  }
  res.json({
    status: "ok",
    degraded: !googleAuth.enabled,
    message: googleAuth.enabled ? "" : "Google sign-in is disabled on the backend.",
    action: googleAction,
    providers: googleAuth.enabled ? ["google"] : [],
    google: {
      enabled: googleAuth.enabled,
      clientId: env.googleOauthClientId || "",
      backendFlow: googleAuth.enabled,
      popupFlow: googleAuth.enabled,
      startUrl: googleAuth.enabled ? startUrl : "",
      callbackUrl,
      redirectUri,
      frontendOrigin: env.appBaseUrl || "",
      authorizedOrigins: env.googleAuthorizedOrigins || [],
      missingKeys: googleAuth.missingKeys,
      invalidKeys: googleAuth.invalidKeys,
      action: googleAction,
    },
  });
};

export const getCsrf = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const cookieToken = String(req.cookies?.neurobot_csrf || "").trim();
    const requestTokenRaw =
      typeof req.csrfToken === "string"
        ? req.csrfToken
        : typeof req.csrfToken === "function"
          ? req.csrfToken()
          : "";
    const requestToken = String(requestTokenRaw || "").trim();
    const token = requestToken.length > 8 ? requestToken : cookieToken;
    logInfo("Auth CSRF token requested", {
      requestId: req.requestId || "",
      origin: String(req.headers.origin || ""),
      hasCsrfCookie: Boolean(req.cookies?.neurobot_csrf),
      csrfToken: redact(token),
    });
    res.json({ status: "ok", csrfToken: token });
  } catch (error) {
    logError("Auth CSRF response failed", error, { requestId: req.requestId || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

export const getAuthStatus = async (req, res) => {
  try {
    if (!req.user?.sub) {
      res.json({
        status: "ok",
        authenticated: false,
        user: null,
        requestId: req.requestId || "",
      });
      return;
    }

    const dbUser = await getUserById(req.user.sub).catch(() => null);
    res.json({
      status: "ok",
      authenticated: true,
      user: toPublicUser(dbUser) || toTokenBackedUser(req.user),
      requestId: req.requestId || "",
    });
  } catch (error) {
    logError("Auth status lookup failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

export const verifyAuth = async (req, res) => {
  try {
    if (!req.user?.sub) {
      res.status(401).json({
        success: false,
        error: "Unauthorized",
        message: "Valid authentication required",
        requestId: req.requestId || "",
      });
      return;
    }

    const dbUser = await getUserById(req.user.sub).catch(() => null);
    res.json({
      success: true,
      status: "ok",
      authenticated: true,
      user: toPublicUser(dbUser) || toTokenBackedUser(req.user),
      requestId: req.requestId || "",
    });
  } catch (error) {
    logError("Auth verify failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

export const googleOauthCallback = async (req, res) => {
  try {
    const code = String(req.query?.code || "").trim();
    const state = String(req.query?.state || "").trim();
    const hasError = String(req.query?.error || "").trim();

    logInfo("Google OAuth callback received", {
      requestId: req.requestId || "",
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasError: Boolean(hasError),
      errorDescription: String(req.query?.error_description || "").substring(0, 200),
      codeLength: code.length,
    });

    if (hasError) {
      const errDescription = String(req.query?.error_description || hasError).substring(0, 300);
      logWarn("Google OAuth callback received error from Google", {
        requestId: req.requestId || "",
        error: hasError,
        errorDescription: errDescription,
      });
      const failureBase = resolveAppRedirect(env.oauthFailureRedirect || "/auth?error=oauth_failed", "/auth?error=oauth_failed");
      const failedTarget = `${failureBase}${String(failureBase).includes("?") ? "&" : "?"}error=${encodeURIComponent(hasError)}&error_description=${encodeURIComponent(errDescription)}`;
      res.redirect(failedTarget);
      return;
    }

    if (!code) {
      logWarn("Google OAuth callback missing code", {
        requestId: req.requestId || "",
        query: JSON.stringify(req.query || {}),
      });
      const failureBase = resolveAppRedirect(env.oauthFailureRedirect || "/auth?error=oauth_failed", "/auth?error=oauth_failed");
      const failedTarget = `${failureBase}${String(failureBase).includes("?") ? "&" : "?"}code=missing_google_code`;
      res.redirect(failedTarget);
      return;
    }

    const user = await authenticateGoogleCode({ code });
    await setAuthCookies(res, user, { rememberMe: true });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    const successBase = state
      ? resolveAppRedirect(state, "/dashboard")
      : resolveAppRedirect(env.oauthSuccessRedirect || "/dashboard", "/dashboard");
    const target = appendQueryParam(successBase, "oauth", "google");
    logInfo("Google OAuth callback success, redirecting", {
      requestId: req.requestId || "",
      userId: user._id?.toString?.() || "",
      email: user.email,
      target: target.substring(0, 100),
    });
    res.redirect(target);
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: "google-oauth", reason: error?.code || "oauth_callback_failed" });
    logError("Google OAuth callback redirect failed", error, {
      requestId: req.requestId || "",
      code: String(error?.code || ""),
      message: String(error?.message || ""),
      missingKeys: Array.isArray(error?.missingKeys) ? error.missingKeys : undefined,
    });
    const failureBase = resolveAppRedirect(env.oauthFailureRedirect || "/auth?error=oauth_failed", "/auth?error=oauth_failed");
    const failedTarget = `${failureBase}${String(failureBase).includes("?") ? "&" : "?"}code=${encodeURIComponent(String(error?.code || "oauth_failed"))}`;
    res.redirect(failedTarget);
  }
};
