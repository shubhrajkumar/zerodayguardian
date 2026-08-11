import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { OAuth2Client } from "google-auth-library";
import { getDb, getDbPoolStatus } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";
import { logInfo, logWarn } from "../../src/utils/logger.mjs";
import { buildCookieOptions } from "../../src/utils/cookiePolicy.mjs";
import { createBlindIndex, decryptSensitive, encryptSensitive, sanitizeText } from "../../src/utils/security.mjs";
import { getAuthFallbackCollection } from "./authFallbackStore.mjs";

const USERS = "users";
let googleOauthClient = null;
let googleOauthWebClient = null;

const getCollection = (name) => {
  const pool = getDbPoolStatus();
  if (!pool.initialized || !pool.connected) {
    logWarn("Using auth fallback store because MongoDB is unavailable", { collection: name });
    return getAuthFallbackCollection(name);
  }
  return getDb().collection(name);
};
const ACCESS_COOKIE = "neurobot_at";
const REFRESH_COOKIE = "neurobot_rt";
const ZDG_ACCESS_COOKIE = "zdg_token";
const ZDG_REFRESH_COOKIE = "zdg_refresh";
const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TTL = "7d";
const REFRESH_TTL = "30d";
const REFRESH_TTL_LONG = "30d";
const BCRYPT_ROUNDS = 12;
const REFRESH_GRACE_WINDOW_MS = 30 * 1000;

const toObjectId = (value) => (ObjectId.isValid(value) ? new ObjectId(value) : value);
const now = () => Date.now();

const createError = (message, status, code, retryAfterSec) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  if (retryAfterSec) error.retryAfterSec = retryAfterSec;
  return error;
};

const normalizeEmail = (value = "") => sanitizeText(value).trim().toLowerCase();
const normalizeName = (value = "") => sanitizeText(value).trim();
const normalizeRole = (value = "") => String(value || "user").trim().toLowerCase() || "user";
const buildEmailHash = (value = "") => createBlindIndex(normalizeEmail(value), "user-email");
const normalizeUrl = (value = "") => {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
};
const GOOGLE_AUTH_REQUIRED_KEYS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const buildDefaultGoogleRedirectUri = () => {
  const base = String(env.backendPublicUrl || "").trim() || `http://127.0.0.1:${env.port || 8787}`;
  return `${base.replace(/\/+$/, "")}/auth/google/callback`;
};
const isValidHttpUrl = (value = "") => {
  try {
    const parsed = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};
export const getGoogleAuthConfigStatus = () => {
  const missingKeys = GOOGLE_AUTH_REQUIRED_KEYS.filter((key) => {
    if (key.includes("CLIENT_ID")) return !String(env.googleOauthClientId || "").trim();
    if (key.includes("CLIENT_SECRET")) return !String(env.googleOauthClientSecret || "").trim();
    return false;
  });
  const resolvedRedirectUri = String(env.googleRedirectUri || "").trim() || buildDefaultGoogleRedirectUri();
  const invalidKeys = [];
  if (String(env.googleRedirectUri || "").trim() && !isValidHttpUrl(env.googleRedirectUri)) {
    invalidKeys.push("GOOGLE_REDIRECT_URI");
  }
  return {
    enabled: missingKeys.length === 0 && invalidKeys.length === 0,
    missingKeys,
    invalidKeys,
    redirectUri: resolvedRedirectUri,
    hasExplicitRedirectUri: Boolean(String(env.googleRedirectUri || "").trim()),
  };
};
const isGoogleAuthConfigured = () => getGoogleAuthConfigStatus().enabled;
const createGoogleConfigError = (message = "Google sign-in is disabled because GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.") => {
  const status = getGoogleAuthConfigStatus();
  const error = createError(message, 503, "google_auth_not_configured");
  error.missingKeys = status.missingKeys;
  error.invalidKeys = status.invalidKeys;
  error.action = status.invalidKeys.length
    ? "Fix GOOGLE_REDIRECT_URI or remove it to disable Google sign-in safely."
    : "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the backend environment to enable Google sign-in.";
  return error;
};
const getGoogleOauthClient = () => {
  if (!isGoogleAuthConfigured()) {
    throw createGoogleConfigError();
  }
  if (!googleOauthClient) googleOauthClient = new OAuth2Client(env.googleOauthClientId);
  return googleOauthClient;
};

const getGoogleOauthWebClient = () => {
  const googleAuth = getGoogleAuthConfigStatus();
  if (!googleAuth.enabled) {
    throw createGoogleConfigError("Google OAuth redirect flow is disabled because GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.");
  }
  if (!googleOauthWebClient) {
    googleOauthWebClient = new OAuth2Client(env.googleOauthClientId, env.googleOauthClientSecret, googleAuth.redirectUri);
  }
  return googleOauthWebClient;
};

const createRefreshJti = () => crypto.randomUUID();
const hashRefreshToken = async (token) => bcrypt.hash(String(token || ""), BCRYPT_ROUNDS);

const verifyJwt = (token, { allowRefresh = false } = {}) => {
  if (!env.jwtSecret) {
    throw createError("JWT secret missing", 500, "jwt_secret_missing");
  }
  let payload;
  try {
    payload = jwt.verify(String(token || ""), env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
  } catch {
    throw createError("Invalid token", 401, allowRefresh ? "invalid_refresh_token" : "invalid_token");
  }
  const tokenType = String(payload?.type || "access").toLowerCase();
  if (!allowRefresh && tokenType === "refresh") {
    throw createError("Refresh token cannot be used for API access", 401, "invalid_token");
  }
  if (allowRefresh && tokenType !== "refresh") {
    throw createError("Invalid refresh token", 401, "invalid_refresh_token");
  }
  return payload;
};

const maskEmail = (value = "") => {
  const [local, domain] = String(value || "").split("@");
  if (!local || !domain) return value;
  const visibleLocal = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}`;
  return `${visibleLocal}@${domain}`;
};

const hydrateUser = (user) => {
  if (!user) return null;
  const hydrated = { ...user };
  hydrated.email = normalizeEmail(decryptSensitive(user.email) || user.email);
  hydrated.name = normalizeName(decryptSensitive(user.name) || user.name);
  hydrated.avatarUrl = normalizeUrl(decryptSensitive(user.avatarUrl) || user.avatarUrl);
  if (!hydrated.emailHash && hydrated.email) hydrated.emailHash = buildEmailHash(hydrated.email);
  return hydrated;
};

const protectUserFields = (fields = {}) => {
  const next = { ...fields };
  if (Object.prototype.hasOwnProperty.call(fields, "email")) {
    const safeEmail = normalizeEmail(fields.email);
    next.email = encryptSensitive(safeEmail);
    next.emailHash = buildEmailHash(safeEmail);
  }
  if (Object.prototype.hasOwnProperty.call(fields, "name")) {
    next.name = encryptSensitive(normalizeName(fields.name));
  }
  if (Object.prototype.hasOwnProperty.call(fields, "avatarUrl")) {
    next.avatarUrl = encryptSensitive(normalizeUrl(fields.avatarUrl));
  }
  return next;
};

const emailLookupQuery = (email = "") => {
  const safeEmail = normalizeEmail(email);
  return { $or: [{ emailHash: buildEmailHash(safeEmail) }, { email: safeEmail }] };
};

const AUTH_DB_MAX_TIME_MS = 8_000;

const findUserByEmailRecord = async (users, email) => {
  const safeEmail = normalizeEmail(email);
  const user = await users.findOne(emailLookupQuery(safeEmail), { maxTimeMS: AUTH_DB_MAX_TIME_MS });
  return hydrateUser(user);
};

const signAccessToken = (user) => {
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
    },
    env.jwtSecret,
    {
      expiresIn: ACCESS_TTL,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    }
  );
  logInfo("Token generated", {
    userId: user._id?.toString?.() || "",
    email: user.email,
    tokenType: "access",
  });
  return token;
};

const signRefreshToken = (user, rememberMe = false, jti = createRefreshJti()) => {
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
      type: "refresh",
      remember: rememberMe === true,
    },
    env.jwtSecret,
    {
      expiresIn: rememberMe ? REFRESH_TTL_LONG : REFRESH_TTL,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
      jwtid: jti,
    }
  );
  logInfo("Token generated", {
    userId: user._id?.toString?.() || "",
    email: user.email,
    tokenType: "refresh",
  });
  return { token, jti };
};

/** Cookie options for auth tokens — inherits Secure + HttpOnly from buildCookieOptions. */
const cookieOptions = () => buildCookieOptions();

const persistRefreshSession = async (user, refreshToken, { rememberMe = false, jti = "", expiresAt = 0 } = {}) => {
  const users = getCollection(USERS);
  const timestamp = now();
  const refreshState = {
    tokenHash: await hashRefreshToken(refreshToken),
    jti: String(jti || ""),
    rememberMe: rememberMe === true,
    expiresAt: Number(expiresAt || 0) || 0,
    rotatedAt: timestamp,
  };
  await users.updateOne(
    { _id: toObjectId(user._id) },
    {
      $set: {
        refreshSession: refreshState,
        updatedAt: timestamp,
      },
    },
    { maxTimeMS: AUTH_DB_MAX_TIME_MS }
  );
  return refreshState;
};

export const revokeRefreshSession = async (refreshToken) => {
  if (!refreshToken) return;
  let payload;
  try {
    payload = verifyJwt(refreshToken, { allowRefresh: true });
  } catch {
    return;
  }
  const users = getCollection(USERS);
  await users.updateOne(
    { _id: toObjectId(payload.sub) },
    {
      $unset: {
        refreshSession: "",
      },
      $set: {
        updatedAt: now(),
      },
    }
  );
};

export const setAuthCookies = async (res, user, options = {}) => {
  const rememberMe = options.rememberMe === true;
  const accessToken = signAccessToken(user);
  const { token: refreshToken, jti } = signRefreshToken(user, rememberMe);
  const refreshPayload = verifyJwt(refreshToken, { allowRefresh: true });
  await persistRefreshSession(user, refreshToken, {
    rememberMe,
    jti,
    expiresAt: Number(refreshPayload?.exp || 0) * 1000,
  });

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  res.cookie(ZDG_ACCESS_COOKIE, accessToken, {
    ...cookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  res.cookie(ZDG_REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(),
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  return { accessToken, refreshToken };
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions());
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.clearCookie(ZDG_ACCESS_COOKIE, cookieOptions());
  res.clearCookie(ZDG_REFRESH_COOKIE, cookieOptions());
};

const sanitizeUser = (user) => {
  const hydrated = hydrateUser(user);
  if (!hydrated) return null;
  return {
    ...hydrated,
    email: normalizeEmail(hydrated.email),
    name: normalizeName(hydrated.name),
    avatarUrl: normalizeUrl(hydrated.avatarUrl),
  };
};

export const registerUser = async ({ name, email, password }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);

  const existing = await findUserByEmailRecord(users, safeEmail);
  if (existing) {
    throw createError("An account with this email already exists", 409, "email_exists");
  }

  const timestamp = now();
  const passwordHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiresDate = new Date(timestamp + 15 * 60_000);

  const document = {
    ...protectUserFields({
      email: safeEmail,
      name: normalizeName(name),
    }),
    password: passwordHash,
    role: "user",
    authProvider: "email",
    emailVerified: false,
    isVerified: false,
    otp: otpCode,
    otpExpires: otpExpiresDate,
    lastLoginAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const result = await users.insertOne(document);
  logInfo("User registered", { email: safeEmail, userId: result.insertedId?.toString?.() || "" });

  return {
    user: sanitizeUser({ ...document, _id: result.insertedId }),
    otp: otpCode,
  };
};

export const verifyUserOtp = async ({ email, otp }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const user = await findUserByEmailRecord(users, safeEmail);

  if (!user) throw createError("User not found", 404, "user_not_found");
  if (user.emailVerified) return { verified: true, user: sanitizeUser(user) };

  if (!user.otp || !user.otpExpires) {
    throw createError("No verification pending. Please sign up again.", 400, "no_otp_pending");
  }

  if (new Date(user.otpExpires).getTime() < Date.now()) {
    throw createError("OTP has expired. Please sign up again.", 400, "otp_expired");
  }

  // ── Dev bypass: accept '123456' as universal OTP for testing (development only) ──
  const isDevBypass = env.nodeEnv !== "production" && String(otp) === "123456";
  if (isDevBypass) {
    logInfo("[DEV] OTP bypass activated — accepting '123456' as valid OTP", { email: safeEmail, userId: user._id?.toString?.() || "" });
  }
  if (!isDevBypass && user.otp !== String(otp)) {
    throw createError("Invalid verification code", 400, "otp_invalid");
  }

  const timestamp = now();
  await users.updateOne(
    { _id: toObjectId(user._id) },
    {
      $set: {
        emailVerified: true,
        isVerified: true,
        otp: null,
        otpExpires: null,
        updatedAt: timestamp,
      },
    }
  );

  return { verified: true, user: sanitizeUser({ ...user, emailVerified: true, isVerified: true }) };
};

export const requestPasswordReset = async ({ email }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const user = await findUserByEmailRecord(users, safeEmail);

  // Always return success to prevent user enumeration
  if (!user) {
    logInfo("Password reset requested for non-existent email", { email: safeEmail });
    return { message: "If an account exists with this email, a reset code has been sent." };
  }

  // Block Google-only accounts from password reset
  if (user.googleId && user.authProvider === "google") {
    logInfo("Password reset requested for Google-only account", { email: safeEmail });
    return { message: "If an account exists with this email, a reset code has been sent." };
  }

  // Block accounts without a password
  if (!user.password) {
    logInfo("Password reset requested for account without password", { email: safeEmail });
    return { message: "If an account exists with this email, a reset code has been sent." };
  }

  const timestamp = now();
  const resetOtpCode = String(Math.floor(100000 + Math.random() * 900000));
  const resetOtpExpiresDate = new Date(timestamp + 15 * 60_000);

  await users.updateOne(
    { _id: toObjectId(user._id) },
    {
      $set: {
        resetOtp: resetOtpCode,
        resetOtpExpires: resetOtpExpiresDate,
        updatedAt: timestamp,
      },
    }
  );

  logInfo("Password reset OTP generated", { email: safeEmail, userId: user._id?.toString?.() || "" });

  return {
    message: "If an account exists with this email, a reset code has been sent.",
    resetOtp: resetOtpCode,
    user: sanitizeUser(user),
  };
};

export const resetPassword = async ({ email, otp, newPassword }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const user = await findUserByEmailRecord(users, safeEmail);

  if (!user) throw createError("User not found", 404, "user_not_found");

  if (user.googleId && user.authProvider === "google") {
    throw createError(
      "This account uses Google sign-in. Please sign in with Google.",
      400,
      "google_only_account"
    );
  }

  if (!user.resetOtp || !user.resetOtpExpires) {
    throw createError("No reset request pending. Please request a new code.", 400, "no_reset_pending");
  }

  if (new Date(user.resetOtpExpires).getTime() < Date.now()) {
    throw createError("Reset code has expired. Please request a new one.", 400, "reset_otp_expired");
  }

  if (user.resetOtp !== String(otp)) {
    throw createError("Invalid reset code", 400, "reset_otp_invalid");
  }

  const timestamp = now();
  const passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);

  await users.updateOne(
    { _id: toObjectId(user._id) },
    {
      $set: {
        password: passwordHash,
        resetOtp: null,
        resetOtpExpires: null,
        refreshSession: null,
        updatedAt: timestamp,
      },
    }
  );

  logInfo("Password reset successful", { email: safeEmail, userId: user._id?.toString?.() || "" });

  return { message: "Password reset successful. Please sign in with your new password." };
};

export const loginUser = async ({ email, password }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const user = await findUserByEmailRecord(users, safeEmail);

  if (!user) {
    throw createError("Invalid email or password", 401, "invalid_credentials");
  }

  if (user.googleId && user.authProvider === "google") {
    throw createError(
      "This account uses Google sign-in. Please sign in with Google.",
      400,
      "google_only_account"
    );
  }

  if (!user.password) {
    throw createError("Invalid email or password", 401, "invalid_credentials");
  }

  const passwordMatch = await bcrypt.compare(String(password), user.password);
  if (!passwordMatch) {
    throw createError("Invalid email or password", 401, "invalid_credentials");
  }

  if (!user.emailVerified && !user.isVerified) {
    throw createError("Please verify your account first", 403, "email_not_verified");
  }

  const timestamp = now();
  await users.updateOne(
    { _id: toObjectId(user._id) },
    { $set: { lastLoginAt: timestamp, updatedAt: timestamp } }
  );

  return sanitizeUser(user);
};

export const getUserByEmail = async ({ email }) => {
  const safeEmail = normalizeEmail(email);
  const user = await findUserByEmailRecord(getCollection(USERS), safeEmail);
  logInfo("User fetch", {
    email: safeEmail,
    found: Boolean(user),
  });
  return user;
};

export const getUserById = async (id) => sanitizeUser(await getCollection(USERS).findOne({ _id: toObjectId(id) }));

export const authenticateGoogleUser = async ({ idToken }) => {
  const token = String(idToken || "").trim();
  if (!token) throw createError("Google credential is required", 400, "google_token_required");

  const client = getGoogleOauthClient();
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: env.googleOauthClientId,
  });
  const payload = ticket.getPayload();
  const googleId = String(payload?.sub || "").trim();
  const email = normalizeEmail(payload?.email || "");
  const emailVerified = payload?.email_verified === true;
  const displayName = normalizeName(payload?.name || payload?.given_name || email.split("@")[0] || "Google User");
  const avatarUrl = normalizeUrl(payload?.picture || "");

  if (!googleId || !email) throw createError("Google identity is incomplete", 401, "google_identity_invalid");
  if (!emailVerified) throw createError("Google email is not verified", 403, "google_email_not_verified");

  const users = getCollection(USERS);
  const timestamp = now();
  let user = hydrateUser(await users.findOne({ googleId }));
  if (!user) user = await findUserByEmailRecord(users, email);

  if (user) {
    const updates = {
      ...protectUserFields({
        name: displayName || String(user.name || ""),
        email,
        avatarUrl: avatarUrl || String(user.avatarUrl || ""),
      }),
      googleId,
      authProvider: "google",
      emailVerified: true,
      emailVerifiedAt: user.emailVerifiedAt || timestamp,
      lastLoginAt: timestamp,
      updatedAt: timestamp,
    };
    await users.updateOne({ _id: user._id }, { $set: updates });
    return sanitizeUser({ ...user, ...updates });
  }

  const document = {
    ...protectUserFields({
      email,
      name: displayName,
      avatarUrl,
    }),
    role: "user",
    authProvider: "google",
    googleId,
    emailVerified: true,
    emailVerifiedAt: timestamp,
    lastLoginAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const result = await users.insertOne(document);
  return sanitizeUser({ ...document, _id: result.insertedId });
};

export const buildGoogleOauthRedirectUrl = ({ state = "" } = {}) => {
  const client = getGoogleOauthWebClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    include_granted_scopes: true,
    scope: ["openid", "email", "profile"],
    ...(state ? { state: String(state) } : {}),
  });
};

export const authenticateGoogleCode = async ({ code }) => {
  const safeCode = String(code || "").trim();
  if (!safeCode) throw createError("Google authorization code is required", 400, "google_code_required");

  const client = getGoogleOauthWebClient();
  const { tokens } = await client.getToken(safeCode);
  const idToken = String(tokens?.id_token || "").trim();
  if (!idToken) throw createError("Google did not return an ID token", 401, "google_identity_invalid");
  return authenticateGoogleUser({ idToken });
};

export const refreshAuth = async (refreshToken) => {
  if (!refreshToken) {
    throw createError("Refresh token required", 401, "refresh_token_required");
  }

  const payload = verifyJwt(refreshToken, { allowRefresh: true });
  if (!payload?.sub || !payload?.jti) {
    throw createError("Invalid refresh token", 401, "invalid_refresh_token");
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw createError("User not found", 404, "user_not_found");
  }

  const refreshSession = user.refreshSession || null;
  if (!refreshSession?.tokenHash || !refreshSession?.jti) {
    throw createError("Refresh session expired", 401, "refresh_session_missing");
  }
  if (String(refreshSession.jti) !== String(payload.jti)) {
    throw createError("Refresh token rotated", 401, "refresh_token_rotated");
  }
  if (Number(refreshSession.expiresAt || 0) && Number(refreshSession.expiresAt) + REFRESH_GRACE_WINDOW_MS < now()) {
    throw createError("Refresh session expired", 401, "refresh_session_expired");
  }
  const tokenMatches = await bcrypt.compare(String(refreshToken || ""), String(refreshSession.tokenHash || ""));
  if (!tokenMatches) {
    throw createError("Refresh token rotated", 401, "refresh_token_rotated");
  }

  return {
    user,
    rememberMe: payload.remember === true || refreshSession.rememberMe === true,
  };
};

export const updateUserThemePreference = async ({ userId, theme }) => {
  const users = getCollection(USERS);
  await users.updateOne(
    { _id: toObjectId(userId) },
    {
      $set: {
        "settings.theme": theme,
        updatedAt: now(),
      },
    }
  );
  return getUserById(userId);
};

export const emailAvailableForUser = async ({ email, excludeUserId }) => {
  const candidate = await getUserByEmail({ email });
  if (!candidate) return true;
  return String(candidate._id?.toString?.() || candidate._id || "") === String(excludeUserId || "");
};

/**
 * Get email configuration status (for debug/diagnostic endpoints).
 * In Google-only mode this always reports mail as disabled.
 */
export const getEmailConfigStatus = () => ({
  emailEnabled: false,
  authEmailEnabled: false,
  hasFrom: false,
  hasUser: false,
  hasPassword: false,
  smtpHost: "",
  smtpPort: 0,
  smtpSecure: false,
  smtpRequireTls: false,
  authEmailFrom: "",
  authEmailUser: "",
  authEmailFromName: "",
  previewMode: false,
});

/**
 * Send a test email — always fails in Google-only mode.
 */
export const sendTestEmail = async ({ to }) => {
  return {
    success: false,
    message: "Email service is disabled. This application uses Google sign-in only.",
    code: "email_disabled",
  };
};

export const updateUserProfileSecure = async ({ userId, name, email }) => {
  const users = getCollection(USERS);
  const updates = { updatedAt: now() };
  if (name != null) Object.assign(updates, protectUserFields({ name }));
  if (email != null) Object.assign(updates, protectUserFields({ email }));
  await users.updateOne({ _id: toObjectId(userId) }, { $set: updates });
  return getUserById(userId);
};
