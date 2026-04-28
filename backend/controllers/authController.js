import {
  authenticateGoogleCode,
  authenticateGoogleUser,
  buildGoogleOauthRedirectUrl,
  clearAuthCookies,
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
import { logError, logInfo, redact } from "../src/utils/logger.mjs";

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
    const { accessToken } = await setAuthCookies(res, user);
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.status(201).json({ status: "ok", user: toPublicUser(user), accessToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: error?.code || "signup_failed" });
    logError("Auth signup failed", error, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, error);
  }
};

export const login = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
    logInfo("Auth login request", { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    const user = await loginUser(req.validatedBody);
    const { accessToken } = await setAuthCookies(res, user, { rememberMe: req.validatedBody.rememberMe === true });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", user: toPublicUser(user), accessToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: error?.code || "login_failed" });
    logError("Auth login failed", error, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, error);
  }
};

export const googleLogin = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: "google-oauth" });
    logInfo("Auth Google login request", { requestId: req.requestId || "" });
    const user = await authenticateGoogleUser({ idToken: req.validatedBody?.credential });
    const { accessToken } = await setAuthCookies(res, user, { rememberMe: true });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", user: toPublicUser(user), accessToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: "google-oauth", reason: error?.code || "google_login_failed" });
    logError("Auth Google login failed", error, { requestId: req.requestId || "" });
    sendAuthError(req, res, error);
  }
};

export const startGoogleOauth = async (req, res) => {
  try {
    logInfo("Auth Google OAuth start", { requestId: req.requestId || "" });
    const next = String(req.query?.next || "").trim();
    const redirectUrl = buildGoogleOauthRedirectUrl({ state: next || "" });
    res.redirect(302, redirectUrl);
  } catch (error) {
    logError("Auth Google OAuth start failed", error, { requestId: req.requestId || "" });
    sendAuthError(req, res, error);
  }
};

export const sendOtp = async (req, res) => {
  try {
    await assertAuthAttemptAllowed({ req, identifier: req.validatedBody?.email || "" });
    logInfo("Auth send OTP request", { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    const result = await sendResetOtp(req.validatedBody);
    await safeRecordAuthSuccess({ req, identifier: req.validatedBody?.email || "" });
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
    const { accessToken } = await setAuthCookies(res, user);
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", message: "Password reset successful", user: toPublicUser(user), accessToken });
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: req.validatedBody?.email || "", reason: error?.code || "reset_password_failed" });
    logError("Auth reset password failed", error, { requestId: req.requestId || "", email: req.validatedBody?.email || "" });
    sendAuthError(req, res, error);
  }
};

export const refreshSession = async (req, res) => {
  try {
    logInfo("Auth refresh request", { requestId: req.requestId || "", hasRefreshCookie: Boolean(req.cookies?.neurobot_rt) });
    const { user, rememberMe } = await refreshAuth(req.cookies?.neurobot_rt);
    const { accessToken } = await setAuthCookies(res, user, { rememberMe });
    await safeRecordAuthSuccess({ req, identifier: user.email, userId: user._id?.toString?.() || "" });
    res.json({ status: "ok", user: toPublicUser(user), accessToken });
  } catch (error) {
    const normalizedError = normalizeRefreshError(error);
    await safeRecordAuthFailure({ req, identifier: req.ip || "refresh", reason: normalizedError?.code || "refresh_failed" });
    logError("Auth refresh failed", normalizedError, { requestId: req.requestId || "" });
    sendAuthError(req, res, normalizedError);
  }
};

export const logout = async (req, res) => {
  try {
    logInfo("Auth logout request", { requestId: req.requestId || "" });
    await revokeRefreshSession(req.cookies?.neurobot_rt);
    clearAuthCookies(res);
    res.status(204).end();
  } catch (error) {
    logError("Auth logout failed", error, { requestId: req.requestId || "" });
    sendAuthError(req, res, error);
  }
};

export const getAuthProviders = async (req, res) => {
  const hasGoogleRedirectFlow = Boolean(env.googleOauthClientId && env.googleOauthClientSecret && env.googleRedirectUri);
  const startPath = resolvePublicAuthPath(req, "/google");
  const callbackPath = resolvePublicAuthPath(req, "/google/callback");
  const startUrl = resolveBackendAuthUrl(req, startPath);
  const callbackUrl = resolveBackendAuthUrl(req, callbackPath);
  res.json({
    status: "ok",
    providers: ["google"],
    google: {
      enabled: true,
      clientId: env.googleOauthClientId || "",
      backendFlow: hasGoogleRedirectFlow,
      popupFlow: true,
      startUrl,
      callbackUrl,
      redirectUri: env.googleRedirectUri || callbackUrl,
      frontendOrigin: env.appBaseUrl || "",
      authorizedOrigins: env.googleAuthorizedOrigins || [],
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

export const googleOauthCallback = async (req, res) => {
  try {
    const code = String(req.query?.code || "").trim();
    const state = String(req.query?.state || "").trim();
    if (!code) {
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
    res.redirect(target);
  } catch (error) {
    await safeRecordAuthFailure({ req, identifier: "google-oauth", reason: error?.code || "oauth_callback_failed" });
    logError("Google OAuth callback redirect failed", error, { requestId: req.requestId || "" });
    const failureBase = resolveAppRedirect(env.oauthFailureRedirect || "/auth?error=oauth_failed", "/auth?error=oauth_failed");
    const failedTarget = `${failureBase}${String(failureBase).includes("?") ? "&" : "?"}code=${encodeURIComponent(String(error?.code || "oauth_failed"))}`;
    res.redirect(failedTarget);
  }
};
