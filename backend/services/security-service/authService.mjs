import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { OAuth2Client } from "google-auth-library";
import { getDb, getDbPoolStatus } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";
import { logInfo, logWarn } from "../../src/utils/logger.mjs";
import { buildCookieOptions } from "../../src/utils/cookiePolicy.mjs";
import { createBlindIndex, decryptSensitive, encryptSensitive, sanitizeText } from "../../src/utils/security.mjs";
import { getAuthFallbackCollection } from "./authFallbackStore.mjs";
import * as otpService from "../../src/services/otpService.mjs";

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
// OTP bcrypt uses fewer rounds — it's only a backup persistence hash.
// Primary verification uses the in-memory OTP service (no bcrypt).
// Render's 0.1 CPU: 12 rounds = ~6s, 8 rounds = ~0.4s, 6 rounds = ~0.1s.
// 8 rounds balances speed with adequate protection for short-lived OTPs.
const OTP_BCRYPT_ROUNDS = 8;
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

const hashPassword = async (password) => bcrypt.hash(String(password || ""), BCRYPT_ROUNDS);
const createRefreshJti = () => crypto.randomUUID();
const hashRefreshToken = async (token) => bcrypt.hash(String(token || ""), BCRYPT_ROUNDS);

export const verifyPassword = async (plainPassword, hashedPassword) => {
  const safeHash = String(hashedPassword || "");
  if (!safeHash) return false;
  return bcrypt.compare(String(plainPassword || ""), safeHash);
};

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

const mailConfigured = () => Boolean(env.authEmailEnabled && env.authEmailUser && env.authEmailAppPassword && env.authEmailFrom);
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

const brandedFromField = () => {
  const email = String(env.authEmailFrom || env.authEmailUser || "").trim();
  const name = String(env.authEmailFromName || "ZeroDay Guardian Security").trim();
  return name && email ? `"${name.replace(/"/g, "")}" <${email}>` : email;
};

let transporterPromise = null;

/**
 * Get or create the nodemailer transporter.
 * Logs transport creation, SMTP verify result, and full error details on failure.
 */
const getMailTransporter = async () => {
  if (!mailConfigured()) {
    logWarn("[MAIL] getMailTransporter called but mail is not configured", {
      hasFrom: Boolean(env.authEmailFrom),
      hasUser: Boolean(env.authEmailUser),
      hasPassword: Boolean(env.authEmailAppPassword),
      host: env.smtpHost,
      port: env.smtpPort,
    });
    throw createError("Email service is not configured", 500, "mail_not_configured");
  }
  if (!transporterPromise) {
    logInfo("[MAIL] Creating nodemailer transport", {
      host: env.smtpHost,
      port: env.smtpPort,
      user: env.authEmailUser,
      from: brandedFromField(),
      secure: env.smtpSecure,
      requireTLS: env.smtpRequireTls,
    });
    transporterPromise = (async () => {
      const transporter = nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.authEmailUser,
          pass: env.authEmailAppPassword,
        },
        requireTLS: env.smtpRequireTls,
        connectionTimeout: 5_000, // 5s to connect
        greetingTimeout: 5_000,   // 5s for SMTP greeting
        socketTimeout: 10_000,    // 10s for socket operations
      });
      try {
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SMTP verify timed out after 5000ms')), 5000)
          ),
        ]);
        logInfo("[MAIL] SMTP transport verified successfully", {
          host: env.smtpHost,
          port: env.smtpPort,
          user: maskEmail(env.authEmailUser),
        });
      } catch (verifyError) {
        logWarn("[MAIL] SMTP transport verification failed — sendMail will still be attempted", {
          error: String(verifyError?.message || verifyError),
          code: String(verifyError?.code || ""),
          command: String(verifyError?.command || ""),
        });
      }
      return transporter;
    })();
  }
  return transporterPromise;
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

export const registerUser = async ({ email, password, name }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const safeName = normalizeName(name);

  const existingUser = await findUserByEmailRecord(users, safeEmail);
  if (existingUser) {
    throw createError("User already exists", 409, "user_exists");
  }

  const passwordHash = await hashPassword(password);
  const timestamp = now();
  const document = {
    ...protectUserFields({
      email: safeEmail,
      name: safeName,
      avatarUrl: "",
    }),
    password: passwordHash,
    role: "user",
    authProvider: "local",
    googleId: null,
    emailVerified: true,
    emailVerifiedAt: timestamp,
    lastLoginAt: timestamp,
    resetOtp: null,
    resetOtpExpire: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const result = await users.insertOne(document);
  return sanitizeUser({ ...document, _id: result.insertedId });
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
      authProvider: user.password ? "hybrid" : "google",
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
    password: null,
    role: "user",
    authProvider: "google",
    googleId,
    emailVerified: true,
    emailVerifiedAt: timestamp,
    lastLoginAt: timestamp,
    resetOtp: null,
    resetOtpExpire: null,
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

export const loginUser = async ({ email, password }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const user = await findUserByEmailRecord(users, safeEmail);

  logInfo("User fetch", {
    email: safeEmail,
    found: Boolean(user),
  });

  if (!user) {
    throw createError("User not found", 404, "user_not_found");
  }

  const storedPassword = String(user.password || user.passwordHash || "");
  if (!storedPassword) {
    throw createError("Password not set", 401, "password_not_set");
  }

  const passwordMatch = await verifyPassword(password, storedPassword);
  logInfo("Password match", {
    email: safeEmail,
    matched: passwordMatch,
  });

  if (!passwordMatch) {
    throw createError("Wrong password", 401, "wrong_password");
  }

  if (user.password !== storedPassword) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          password: storedPassword,
          updatedAt: now(),
        },
        $unset: {
          passwordHash: "",
        },
      }
    );
  }

  return sanitizeUser({ ...user, password: storedPassword });
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

export const sendResetOtp = async ({ email }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);

  const user = await findUserByEmailRecord(users, safeEmail);

  logInfo("User fetch", {
    email: safeEmail,
    found: Boolean(user),
    purpose: "send_reset_otp",
  });

  if (!user) {
    throw createError("User not found", 404, "user_not_found");
  }

  const { otp, expiresAt, expiresInMinutes } = otpService.createOtp(safeEmail);

  logInfo("[AUTH] Hashing OTP for storage", {
    email: maskEmail(safeEmail),
    rounds: OTP_BCRYPT_ROUNDS,
  });
  const otpHash = await bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
  logInfo("[AUTH] OTP hashed successfully", {
    email: maskEmail(safeEmail),
    rounds: OTP_BCRYPT_ROUNDS,
  });

  logInfo("[AUTH] Persisting OTP hash to MongoDB", {
    email: maskEmail(safeEmail),
    expiresAt: new Date(expiresAt).toISOString(),
  });
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        resetOtp: otpHash,
        resetOtpExpire: expiresAt,
        updatedAt: now(),
      },
    },
    { maxTimeMS: AUTH_DB_MAX_TIME_MS }
  );
  logInfo("[AUTH] OTP hash persisted to MongoDB", {
    email: maskEmail(safeEmail),
    expiresAt: new Date(expiresAt).toISOString(),
  });

  if (!mailConfigured()) {
    if (env.authOtpPreviewEnabled) {
      logWarn("Password reset OTP email NOT sent — email service is not configured (preview mode)", {
        email: safeEmail,
        delivery: "preview",
        hasFrom: Boolean(env.authEmailFrom),
        hasUser: Boolean(env.authEmailUser),
        hasPassword: Boolean(env.authEmailAppPassword),
      });
      return {
        sent: false,
        delivery: "preview",
        destination: maskEmail(safeEmail),
        expiresInMinutes,
        message: "Email service is not configured. OTP would have been sent to " + maskEmail(safeEmail) + ".",
      };
    }
    throw createError("Unable to send verification email. The email service is not configured. Please contact the administrator.", 503, "mail_not_configured");
  }

  // Send OTP via email using OTP service
  // ── 5s hard timeout across getMailTransporter + sendMail ──
  // Prevents any SMTP connection or send hang from blocking the request.
  // On failure, returns a preview fallback so the client never experiences a 35s freeze.
  const EMAIL_TIMEOUT_MS = 5_000;
  const emailPromise = otpService.sendOtpEmail(safeEmail, otp, expiresInMinutes);
  try {
    await Promise.race([
      emailPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Email dispatch timed out after ${EMAIL_TIMEOUT_MS}ms`)), EMAIL_TIMEOUT_MS)
      ),
    ]);
    logInfo("[AUTH] OTP email sent successfully", {
      email: maskEmail(safeEmail),
      expiresInMinutes,
    });
    return {
      sent: true,
      delivery: "email",
      destination: maskEmail(safeEmail),
      expiresInMinutes,
      message: "Password reset OTP sent successfully.",
    };
  } catch (error) {
    logWarn("[AUTH] OTP email delivery failed — falling back to preview mode", {
      email: maskEmail(safeEmail),
      code: String(error?.code || ""),
      message: String(error?.message || "timeout"),
      fallback: "preview",
    });
    // Return preview fallback instead of throwing — the OTP is stored in-memory
    // and can still be verified via the in-memory OTP store.
    return {
      sent: false,
      delivery: "preview",
      destination: maskEmail(safeEmail),
      expiresInMinutes,
      message: "Email delivery temporarily unavailable. The reset code has been stored and can be verified.",
    };
  } finally {
    // Suppress any late rejection after the race is settled
    emailPromise.catch(() => {});
  }
};

export const resetPassword = async ({ email, otp, password }) => {
  const users = getCollection(USERS);
  const safeEmail = normalizeEmail(email);
  const safeOtp = String(otp || "").trim();
  const user = await findUserByEmailRecord(users, safeEmail);

  logInfo("User fetch", {
    email: safeEmail,
    found: Boolean(user),
    purpose: "reset_password",
  });

  if (!user) {
    throw createError("User not found", 404, "user_not_found");
  }

  // Try in-memory OTP store first (fast path)
  const inMemoryValid = otpService.verifyOtp(safeEmail, safeOtp);
  logInfo("[AUTH] OTP verification (in-memory)", {
    email: maskEmail(safeEmail),
    valid: inMemoryValid,
  });

  if (!inMemoryValid) {
    // Fall back to MongoDB bcrypt OTP hash
    if (!user.resetOtp || !user.resetOtpExpire) {
      throw createError("OTP not requested or expired", 400, "otp_not_requested");
    }

    if (Number(user.resetOtpExpire) < now()) {
      throw createError("OTP expired", 400, "otp_expired");
    }

    logInfo("[AUTH] Comparing OTP against MongoDB bcrypt hash", {
      email: maskEmail(safeEmail),
    });
    const otpMatches = await bcrypt.compare(safeOtp, String(user.resetOtp || ""));
    logInfo("[AUTH] OTP bcrypt comparison result", {
      email: maskEmail(safeEmail),
      matched: otpMatches,
    });
    if (!otpMatches) {
      throw createError("Invalid OTP", 400, "invalid_otp");
    }
  }

  // Clean up OTP from in-memory store if still present
  otpService.deleteOtp(safeEmail);
  logInfo("[AUTH] OTP consumed from in-memory store", {
    email: maskEmail(safeEmail),
  });

  logInfo("[AUTH] Hashing new password", {
    email: maskEmail(safeEmail),
  });
  const passwordHash = await hashPassword(password);
  logInfo("[AUTH] New password hashed successfully", {
    email: maskEmail(safeEmail),
  });

  logInfo("[AUTH] Persisting new password hash to MongoDB", {
    email: maskEmail(safeEmail),
  });
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        password: passwordHash,
        updatedAt: now(),
      },
      $unset: {
        passwordHash: "",
        resetOtp: "",
        resetOtpExpire: "",
      },
    }
  );
  logInfo("[AUTH] New password hash persisted to MongoDB", {
    email: maskEmail(safeEmail),
  });

  return getUserById(user._id);
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
 * Never exposes the actual password — only flags and masked info.
 */
export const getEmailConfigStatus = () => ({
  emailEnabled: mailConfigured(),
  authEmailEnabled: Boolean(env.authEmailEnabled),
  hasFrom: Boolean(env.authEmailFrom),
  hasUser: Boolean(env.authEmailUser),
  hasPassword: Boolean(env.authEmailAppPassword),
  smtpHost: env.smtpHost,
  smtpPort: env.smtpPort,
  smtpSecure: env.smtpSecure,
  smtpRequireTls: env.smtpRequireTls,
  authEmailFrom: env.authEmailFrom ? maskEmail(env.authEmailFrom) : "",
  authEmailUser: env.authEmailUser ? maskEmail(env.authEmailUser) : "",
  authEmailFromName: env.authEmailFromName,
  previewMode: env.authOtpPreviewEnabled,
});

/**
 * Send a test email to verify SMTP configuration.
 * Used by POST /api/debug/send-test-email.
 */
export const sendTestEmail = async ({ to }) => {
  const safeTo = normalizeEmail(to);
  try {
    const transporter = await getMailTransporter();
    const sendMailPromise = transporter.sendMail({
        from: brandedFromField(),
        to: safeTo,
        subject: "ZeroDay Guardian Security | Test Email",
        text: [
          "ZeroDay Guardian Security",
          "",
          "This is a test email to verify your SMTP configuration.",
          "If you received this, SMTP is working correctly.",
          "",
          `Sent at: ${new Date().toISOString()}`,
          "",
          `${env.appBaseUrl}`,
        ].join("\n"),
        html: `
        <div style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden">
            <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#0f766e);color:#ffffff">
              <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.82">ZeroDay Guardian Security</div>
              <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3">SMTP Test Email</h2>
            </div>
            <div style="padding:24px">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6">This is a test email to verify your SMTP configuration.</p>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6">If you received this, SMTP is working correctly.</p>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#475569">Sent at: ${new Date().toISOString()}</p>
            </div>
          </div>
        </div>`,
      });
    const result = await Promise.race([
      sendMailPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SMTP sendMail timed out after 5000ms')), 5000)
      ),
    ]);
    // If we reach here, sendMail resolved successfully. Suppress any late rejection from a race-condition tick.
    sendMailPromise.catch(() => {});
    logInfo("[MAIL] Test email sent successfully", {
      to: maskEmail(safeTo),
      messageId: String(result?.messageId || ""),
      accepted: Array.isArray(result?.accepted) ? result.accepted.map(maskEmail) : [],
    });
    return {
      success: true,
      messageId: String(result?.messageId || ""),
      accepted: Array.isArray(result?.accepted) ? result.accepted : [],
      message: `Test email sent to ${maskEmail(safeTo)}`,
    };
  } catch (error) {
    logWarn("[MAIL] Test email delivery failed", {
      to: maskEmail(safeTo),
      code: String(error?.code || ""),
      message: String(error?.message || "unknown_error"),
      command: String(error?.command || ""),
      response: String(error?.response || ""),
      responseCode: String(error?.responseCode || ""),
    });
    return {
      success: false,
      message: error?.message || "Failed to send test email",
      code: String(error?.code || ""),
      command: String(error?.command || ""),
      response: String(error?.response || ""),
      responseCode: String(error?.responseCode || ""),
    };
  }
};

export const updateUserProfileSecure = async ({ userId, name, email }) => {
  const users = getCollection(USERS);
  const updates = { updatedAt: now() };
  if (name != null) Object.assign(updates, protectUserFields({ name }));
  if (email != null) Object.assign(updates, protectUserFields({ email }));
  await users.updateOne({ _id: toObjectId(userId) }, { $set: updates });
  return getUserById(userId);
};
