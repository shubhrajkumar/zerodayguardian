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

const USERS = "users";
let googleOauthClient = null;
let googleOauthWebClient = null;

const getCollection = (name) => {
  const pool = getDbPoolStatus();
  if (!pool.initialized || !pool.connected) {
    throw createError("Database connection is required for authentication.", 503, "db_unavailable_auth");
  }
  return getDb().collection(name);
};
const ACCESS_COOKIE = "neurobot_at";
const REFRESH_COOKIE = "neurobot_rt";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const REFRESH_TTL_LONG = "30d";
const BCRYPT_ROUNDS = 12;
const RESET_OTP_TTL_MS = 10 * 60 * 1000;
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
const isGoogleAuthConfigured = () => Boolean(env.googleOauthClientId && env.googleOauthClientSecret);
const getGoogleOauthClient = () => {
  if (!isGoogleAuthConfigured()) {
    throw createError("Google sign-in is not configured", 503, "google_auth_not_configured");
  }
  if (!googleOauthClient) googleOauthClient = new OAuth2Client(env.googleOauthClientId);
  return googleOauthClient;
};

const getGoogleOauthWebClient = () => {
  if (!isGoogleAuthConfigured() || !env.googleOauthClientSecret || !env.googleRedirectUri) {
    throw createError("Google OAuth redirect flow is not configured", 503, "google_oauth_redirect_not_configured");
  }
  if (!googleOauthWebClient) {
    googleOauthWebClient = new OAuth2Client(env.googleOauthClientId, env.googleOauthClientSecret, env.googleRedirectUri);
  }
  return googleOauthWebClient;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const resetOtpExpiresInMinutes = Math.round(RESET_OTP_TTL_MS / 60000);

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

const getMailTransporter = async () => {
  if (!mailConfigured()) {
    throw createError("Email service is not configured", 500, "mail_not_configured");
  }
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: env.authEmailUser,
          pass: env.authEmailAppPassword,
        },
        requireTLS: true,
      })
    ).then(async (transporter) => {
      await transporter.verify();
      return transporter;
    });
  }
  return transporterPromise;
};

const findUserByEmailRecord = async (users, email) => {
  const safeEmail = normalizeEmail(email);
  const user = await users.findOne(emailLookupQuery(safeEmail));
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

const cookieOptions = () => buildCookieOptions({
  httpOnly: true,
});

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
    }
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
    maxAge: 15 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(),
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, cookieOptions());
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
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
    emailVerified: false,
    emailVerifiedAt: null,
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

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = now() + RESET_OTP_TTL_MS;

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        resetOtp: otpHash,
        resetOtpExpire: expiresAt,
        updatedAt: now(),
      },
    }
  );

  if (!mailConfigured()) {
    throw createError("Password reset email is not configured", 503, "mail_not_configured");
  }

  try {
    const transporter = await getMailTransporter();
    await transporter.sendMail({
      from: brandedFromField(),
      to: safeEmail,
      subject: "ZeroDay Guardian Security | Password Reset Verification Code",
      text: [
        "ZeroDay Guardian Security",
        "",
        `Your password reset verification code is: ${otp}`,
        `This code expires in ${resetOtpExpiresInMinutes} minutes.`,
        "",
        "If you requested this reset, enter the code in the app to continue.",
        "If you did not request a password reset, you can safely ignore this email.",
        "",
        `${env.appBaseUrl}`,
      ].join("\n"),
      html: `
        <div style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:16px;overflow:hidden">
            <div style="padding:20px 24px;background:linear-gradient(135deg,#0f172a,#0f766e);color:#ffffff">
              <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.82">ZeroDay Guardian Security</div>
              <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3">Password Reset Verification</h2>
            </div>
            <div style="padding:24px">
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6">Use the verification code below to continue your password reset request.</p>
              <div style="margin:18px 0;padding:18px;border:1px dashed #94a3b8;border-radius:14px;background:#f8fafc;text-align:center">
                <div style="font-size:30px;font-weight:700;letter-spacing:8px;color:#0f172a">${otp}</div>
              </div>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6">This code expires in <strong>${resetOtpExpiresInMinutes} minutes</strong>.</p>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6">If you did not request a password reset, you can safely ignore this email and your account will remain unchanged.</p>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#475569">Requested from ZeroDay Guardian Security</p>
            </div>
          </div>
        </div>`,
    });

    logInfo("OTP email sent", {
      email: safeEmail,
      delivery: "email",
    });

    return {
      sent: true,
      delivery: "email",
      destination: maskEmail(safeEmail),
      expiresInMinutes: resetOtpExpiresInMinutes,
      message: "Password reset OTP sent successfully.",
    };
  } catch (error) {
    logWarn("OTP email delivery failed", {
      email: safeEmail,
      code: String(error?.code || ""),
      message: String(error?.message || "unknown_error"),
    });
    throw createError("Password reset email could not be sent", 502, "mail_delivery_failed");
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

  if (!user.resetOtp || !user.resetOtpExpire) {
    throw createError("OTP not requested", 400, "otp_not_requested");
  }

  if (Number(user.resetOtpExpire) < now()) {
    throw createError("OTP expired", 400, "otp_expired");
  }

  const otpMatches = await bcrypt.compare(safeOtp, String(user.resetOtp || ""));
  if (!otpMatches) {
    throw createError("Invalid OTP", 400, "invalid_otp");
  }

  const passwordHash = await hashPassword(password);
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

export const updateUserProfileSecure = async ({ userId, name, email }) => {
  const users = getCollection(USERS);
  const updates = { updatedAt: now() };
  if (name != null) Object.assign(updates, protectUserFields({ name }));
  if (email != null) Object.assign(updates, protectUserFields({ email }));
  await users.updateOne({ _id: toObjectId(userId) }, { $set: updates });
  return getUserById(userId);
};
