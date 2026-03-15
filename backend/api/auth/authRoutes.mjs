import { Router } from "express";
import { randomBytes } from "node:crypto";
import { env } from "../../src/config/env.mjs";
import { validateBody } from "../../src/middleware/validate.mjs";
import { requireAuth, requireRole } from "../../src/middleware/auth.mjs";
import { authProvidersRateLimit, authRateLimit, authSessionRateLimit } from "../../src/middleware/rateLimit.mjs";
import { logInfo } from "../../src/utils/logger.mjs";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../../src/validators/authSchemas.mjs";
import { recordSecurityEvent } from "../../src/services/memoryService.mjs";
import {
  clearAuthCookies,
  createPasswordResetRequest,
  getOrCreateOAuthUser,
  getUserById,
  loginUser,
  refreshAuth,
  registerUser,
  resetPasswordWithToken,
  setAuthCookies,
  updateUserThemePreference,
} from "../../src/services/authService.mjs";

const router = Router();
const oauthStateStore = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const toPublicUser = (user) => ({
  id: user._id.toString(),
  email: user.email,
  name: user.name,
});

const buildAbsoluteRedirect = (path) => {
  if (/^https?:\/\//.test(String(path || ""))) return String(path);
  const origin = String(env.appBaseUrl || "").replace(/\/+$/, "");
  const normalizedPath = String(path || "/").startsWith("/") ? String(path || "/") : `/${String(path || "/")}`;
  return `${origin}${normalizedPath}`;
};

const isHttpsRequiredConfigInvalid = () => {
  if (env.nodeEnv !== "production") return false;
  const base = String(env.appBaseUrl || "");
  if (!base) return true;
  return !base.startsWith("https://");
};

const oauthUiRedirect = ({ provider, status = "error", code = "oauth_failed" }) => {
  const url = new URL(buildAbsoluteRedirect("/auth/callback"));
  url.searchParams.set("oauth", provider);
  url.searchParams.set("status", status);
  url.searchParams.set("code", code);
  return url.toString();
};

const authDeploymentReadiness = () => {
  const appBase = String(env.appBaseUrl || "");
  const googleCb = buildAbsoluteRedirect("/api/auth/oauth/google/callback");
  const githubCb = buildAbsoluteRedirect("/api/auth/oauth/github/callback");
  const googleConfigured = !!(env.googleOauthClientId && env.googleOauthClientSecret);
  const githubConfigured = !!(env.githubOauthClientId && env.githubOauthClientSecret);
  const httpsEnforced = env.nodeEnv !== "production" ? true : appBase.startsWith("https://");
  const callbackValid = [googleCb, githubCb].every((url) =>
    env.nodeEnv !== "production" ? /^https?:\/\//.test(url) : /^https:\/\//.test(url)
  );
  const requiredSecretsConfigured = !!(env.sessionSecret && env.jwtSecret);
  const oauthConfigured = googleConfigured && githubConfigured;
  const deploymentReady = oauthConfigured && callbackValid && httpsEnforced && requiredSecretsConfigured;
  return {
    oauthConfigured,
    callbackValid,
    environment: env.nodeEnv,
    deploymentReady,
    checks: {
      googleClientConfigured: googleConfigured,
      githubClientConfigured: githubConfigured,
      httpsEnforced,
      requiredSecretsConfigured,
      callbacks: {
        google: googleCb,
        github: githubCb,
      },
    },
  };
};

const saveState = (state, provider) => {
  oauthStateStore.set(state, { provider, createdAt: Date.now() });
};

const consumeState = (state, provider) => {
  const row = oauthStateStore.get(state);
  oauthStateStore.delete(state);
  if (!row) return false;
  if (row.provider !== provider) return false;
  return Date.now() - row.createdAt <= OAUTH_STATE_TTL_MS;
};

router.post("/register", authRateLimit, validateBody(registerSchema), async (req, res, next) => {
  try {
    const user = await registerUser(req.validatedBody);
    const { accessToken } = setAuthCookies(res, user);
    await recordSecurityEvent({
      userId: user._id?.toString?.() || null,
      sessionId: req.neurobotSessionId,
      action: "register",
      detail: "User registered",
    });
    res.status(201).json({ user: toPublicUser(user), accessToken });
  } catch (error) {
    next(error);
  }
});

router.post("/login", authRateLimit, validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await loginUser(req.validatedBody);
    const { accessToken } = setAuthCookies(res, user);
    await recordSecurityEvent({
      userId: user._id?.toString?.() || null,
      sessionId: req.neurobotSessionId,
      action: "login",
      detail: "User login successful",
    });
    res.json({ user: toPublicUser(user), accessToken });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", authRateLimit, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.neurobot_rt;
    const user = await refreshAuth(refreshToken);
    const { accessToken } = setAuthCookies(res, user);
    await recordSecurityEvent({
      userId: user._id?.toString?.() || null,
      sessionId: req.neurobotSessionId,
      action: "token_refresh",
      detail: "Access token refreshed",
    });
    res.json({ user: toPublicUser(user), accessToken });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", authRateLimit, (req, res) => {
  clearAuthCookies(res);
  recordSecurityEvent({
    userId: req.user?.sub ?? null,
    sessionId: req.neurobotSessionId,
    action: "logout",
    detail: "User logged out",
  }).catch(() => undefined);
  res.status(204).end();
});

router.post("/forgot-password", authRateLimit, validateBody(forgotPasswordSchema), async (req, res, next) => {
  try {
    const result = await createPasswordResetRequest(req.validatedBody);
    res.status(202).json({
      status: "accepted",
      message: "If that email exists, a reset flow is now available.",
      tokenPreview: result.tokenPreview || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", authRateLimit, validateBody(resetPasswordSchema), async (req, res, next) => {
  try {
    const user = await resetPasswordWithToken(req.validatedBody);
    const { accessToken } = setAuthCookies(res, user);
    await recordSecurityEvent({
      userId: user._id?.toString?.() || null,
      sessionId: req.neurobotSessionId,
      action: "password_reset",
      detail: "Password reset completed",
    });
    res.json({
      status: "ok",
      user: toPublicUser(user),
      accessToken,
      message: "Password reset successful. A fresh session is active.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/csrf", (req, res) => {
  res.json({ csrfToken: req.csrfToken || null });
});

router.get("/me", authSessionRateLimit, requireAuth, async (req, res, next) => {
  try {
    logInfo("Auth /me access", {
      requestId: req.requestId || "",
      hasAuthorizationHeader: !!req.headers.authorization,
      hasCookieHeader: !!req.headers.cookie,
      userId: req.user?.sub || "",
    });
    const user = await getUserById(req.user.sub);
    res.json({
      user: {
        id: req.user.sub,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        settings: user?.settings || {},
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/settings/theme", async (req, res, next) => {
  try {
    if (!req.user?.sub) {
      res.json({ theme: "dark" });
      return;
    }
    logInfo("Auth /settings/theme access", {
      requestId: req.requestId || "",
      hasAuthorizationHeader: !!req.headers.authorization,
      hasCookieHeader: !!req.headers.cookie,
      userId: req.user?.sub || "",
    });
    const user = await getUserById(req.user.sub);
    const theme = String(user?.settings?.theme || "dark");
    res.json({ theme });
  } catch (error) {
    next(error);
  }
});

router.post("/settings/theme", async (req, res, next) => {
  try {
    const requested = String(req.body?.theme || "").toLowerCase();
    const theme = requested === "light" ? "light" : "dark";
    if (!req.user?.sub) {
      res.json({ theme });
      return;
    }
    const user = await updateUserThemePreference({ userId: req.user.sub, theme });
    res.json({ theme: String(user?.settings?.theme || theme) });
  } catch (error) {
    next(error);
  }
});

router.get("/oauth/providers", authProvidersRateLimit, (_req, res) => {
  const googleConfigured = !!(env.googleOauthClientId && env.googleOauthClientSecret);
  const githubConfigured = !!(env.githubOauthClientId && env.githubOauthClientSecret);
  const secureRedirectConfig = !isHttpsRequiredConfigInvalid();
  res.json({
    google: {
      configured: googleConfigured,
      startPath: "/api/auth/oauth/google/start",
      callbackUrl: buildAbsoluteRedirect("/api/auth/oauth/google/callback"),
    },
    github: {
      configured: githubConfigured,
      startPath: "/api/auth/oauth/github/start",
      callbackUrl: buildAbsoluteRedirect("/api/auth/oauth/github/callback"),
    },
    secureRedirectConfig,
  });
});

router.get("/oauth/health", (_req, res) => {
  const report = authDeploymentReadiness();
  res.status(report.deploymentReady ? 200 : 503).json(report);
});

router.get("/oauth/google/start", (req, res) => {
  if (isHttpsRequiredConfigInvalid()) {
    res.redirect(oauthUiRedirect({ provider: "google", code: "insecure_redirect_config" }));
    return;
  }
  if (!env.googleOauthClientId || !env.googleOauthClientSecret) {
    res.redirect(oauthUiRedirect({ provider: "google", code: "not_configured" }));
    return;
  }
  const state = randomBytes(12).toString("hex");
  saveState(state, "google");
  const redirectUri = buildAbsoluteRedirect("/api/auth/oauth/google/callback");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.googleOauthClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  res.redirect(url.toString());
});

router.get("/oauth/google/callback", async (req, res, next) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !consumeState(state, "google")) throw new Error("invalid_state");
    const redirectUri = buildAbsoluteRedirect("/api/auth/oauth/google/callback");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleOauthClientId,
        client_secret: env.googleOauthClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token_exchange_failed");
    const tokenPayload = await tokenRes.json();
    const accessToken = String(tokenPayload.access_token || "");
    if (!accessToken) throw new Error("token_missing");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new Error("profile_fetch_failed");
    const profile = await profileRes.json();
    const email = String(profile.email || "");
    if (!email) throw new Error("email_missing");

    const user = await getOrCreateOAuthUser({
      provider: "google",
      providerId: String(profile.sub || email),
      email,
      name: String(profile.name || email.split("@")[0]),
    });
    setAuthCookies(res, user);
    res.redirect(oauthUiRedirect({ provider: "google", status: "success", code: "ok" }));
  } catch (error) {
    if (req.query?.code || req.query?.state) {
      const errorCode = String(error?.message || "oauth_failed");
      res.redirect(oauthUiRedirect({ provider: "google", code: errorCode }));
      return;
    }
    next(error);
  }
});

router.get("/oauth/github/start", (req, res) => {
  if (isHttpsRequiredConfigInvalid()) {
    res.redirect(oauthUiRedirect({ provider: "github", code: "insecure_redirect_config" }));
    return;
  }
  if (!env.githubOauthClientId || !env.githubOauthClientSecret) {
    res.redirect(oauthUiRedirect({ provider: "github", code: "not_configured" }));
    return;
  }
  const state = randomBytes(12).toString("hex");
  saveState(state, "github");
  const redirectUri = buildAbsoluteRedirect("/api/auth/oauth/github/callback");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.githubOauthClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

router.get("/oauth/github/callback", async (req, res, next) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !consumeState(state, "github")) throw new Error("invalid_state");
    const redirectUri = buildAbsoluteRedirect("/api/auth/oauth/github/callback");

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.githubOauthClientId,
        client_secret: env.githubOauthClientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error("token_exchange_failed");
    const tokenPayload = await tokenRes.json();
    const accessToken = String(tokenPayload.access_token || "");
    if (!accessToken) throw new Error("token_missing");

    const profileRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    if (!profileRes.ok) throw new Error("profile_fetch_failed");
    const profile = await profileRes.json();

    let email = String(profile.email || "");
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        email = String(emails.find((entry) => entry.primary)?.email || emails[0]?.email || "");
      }
    }

    if (!email) throw new Error("email_missing");

    const user = await getOrCreateOAuthUser({
      provider: "github",
      providerId: String(profile.id || email),
      email,
      name: String(profile.name || profile.login || email.split("@")[0]),
    });
    setAuthCookies(res, user);
    res.redirect(oauthUiRedirect({ provider: "github", status: "success", code: "ok" }));
  } catch (error) {
    if (req.query?.code || req.query?.state) {
      const errorCode = String(error?.message || "oauth_failed");
      res.redirect(oauthUiRedirect({ provider: "github", code: errorCode }));
      return;
    }
    next(error);
  }
});

router.get("/admin/ping", requireRole("admin"), (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
