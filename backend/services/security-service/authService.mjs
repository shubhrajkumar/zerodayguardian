import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { getDb } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";
import { sanitizeText } from "../../src/utils/security.mjs";

const USERS = "users";
const PASSWORD_RESET_TOKENS = "password_reset_tokens";
const ACCESS_COOKIE = "neurobot_at";
const REFRESH_COOKIE = "neurobot_rt";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 30;

const hashPassword = async (password) => bcrypt.hash(String(password || ""), BCRYPT_ROUNDS);

const verifyLegacyScryptPassword = (password, encoded) => {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
};

const verifyPassword = async (password, encoded) => {
  const raw = String(encoded || "");
  if (!raw) return false;
  if (raw.includes(":")) return verifyLegacyScryptPassword(password, raw);
  return bcrypt.compare(String(password || ""), raw);
};

const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), email: user.email, name: user.name, role: "user" }, env.jwtSecret, {
    expiresIn: ACCESS_TTL,
  });

const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString(), type: "refresh" }, env.jwtSecret, {
    expiresIn: REFRESH_TTL,
  });

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: env.nodeEnv === "production" ? "strict" : "lax",
  secure: env.nodeEnv === "production",
  path: "/",
});

export const setAuthCookies = (res, user) => {
  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  res.cookie(ACCESS_COOKIE, access, { ...cookieOptions(), maxAge: 1000 * 60 * 15 });
  res.cookie(REFRESH_COOKIE, refresh, { ...cookieOptions(), maxAge: 1000 * 60 * 60 * 24 * 7 });
  return { accessToken: access };
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE, { ...cookieOptions() });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions() });
};

export const registerUser = async ({ email, password, name }) => {
  const db = getDb();
  const users = db.collection(USERS);
  const safeEmail = sanitizeText(email).toLowerCase();
  const safeName = sanitizeText(name);
  const existing = await users.findOne({ email: safeEmail });
  if (existing) {
    const error = new Error("Email already registered");
    error.status = 409;
    throw error;
  }

  const now = Date.now();
  const doc = {
    email: safeEmail,
    name: safeName,
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };

  const result = await users.insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

export const loginUser = async ({ email, password }) => {
  const db = getDb();
  const users = db.collection(USERS);
  const safeEmail = sanitizeText(email).toLowerCase();
  const user = await users.findOne({ email: safeEmail });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const error = new Error("Invalid email or password");
    error.status = 401;
    throw error;
  }
  // Seamless password hash upgrade for legacy accounts.
  if (String(user.passwordHash || "").includes(":")) {
    const upgradedHash = await hashPassword(password);
    await users.updateOne({ _id: user._id }, { $set: { passwordHash: upgradedHash, updatedAt: Date.now() } });
  }
  return user;
};

export const refreshAuth = async (refreshToken) => {
  if (!refreshToken || !env.jwtSecret) {
    const error = new Error("Missing refresh token");
    error.status = 401;
    throw error;
  }
  const payload = jwt.verify(refreshToken, env.jwtSecret);
  if (payload.type !== "refresh") {
    const error = new Error("Invalid refresh token");
    error.status = 401;
    throw error;
  }

  const db = getDb();
  const users = db.collection(USERS);
  const idFilter = ObjectId.isValid(payload.sub) ? new ObjectId(payload.sub) : payload.sub;
  const user = await users.findOne({ _id: idFilter });
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }
  return user;
};

export const getOrCreateOAuthUser = async ({ provider, providerId, email, name }) => {
  const db = getDb();
  const users = db.collection(USERS);
  const safeEmail = sanitizeText(email).toLowerCase();
  const safeName = sanitizeText(name || "NeuroBot User");
  const now = Date.now();
  const providerPath = `oauth.${provider}`;

  let user = await users.findOne({ email: safeEmail });
  if (user) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          name: safeName || user.name,
          updatedAt: now,
          [providerPath]: providerId,
        },
      }
    );
    return users.findOne({ _id: user._id });
  }

  const doc = {
    email: safeEmail,
    name: safeName,
    passwordHash: "",
    oauth: { [provider]: providerId },
    createdAt: now,
    updatedAt: now,
  };
  const result = await users.insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

const tokenHash = (token) => createHash("sha256").update(String(token || "")).digest("hex");

export const createPasswordResetRequest = async ({ email }) => {
  const db = getDb();
  const users = db.collection(USERS);
  const resetTokens = db.collection(PASSWORD_RESET_TOKENS);
  const safeEmail = sanitizeText(email).toLowerCase();
  const user = await users.findOne({ email: safeEmail });

  const now = Date.now();
  await resetTokens.deleteMany({ expiresAt: { $lt: now } });
  if (!user) return { accepted: true, tokenPreview: null };

  const plainToken = randomBytes(32).toString("hex");
  const hashed = tokenHash(plainToken);
  await resetTokens.insertOne({
    userId: user._id,
    email: safeEmail,
    tokenHash: hashed,
    used: false,
    createdAt: now,
    expiresAt: now + RESET_TOKEN_TTL_MS,
  });

  return {
    accepted: true,
    // Dev/testing aid; hidden in production.
    tokenPreview: env.nodeEnv !== "production" ? plainToken : null,
  };
};

export const resetPasswordWithToken = async ({ token, password }) => {
  const db = getDb();
  const users = db.collection(USERS);
  const resetTokens = db.collection(PASSWORD_RESET_TOKENS);
  const now = Date.now();
  const hashed = tokenHash(token);
  const resetRow = await resetTokens.findOne({
    tokenHash: hashed,
    used: false,
    expiresAt: { $gt: now },
  });
  if (!resetRow?.userId) {
    const error = new Error("Invalid or expired reset token");
    error.status = 400;
    throw error;
  }

  const nextHash = await hashPassword(password);
  await users.updateOne({ _id: resetRow.userId }, { $set: { passwordHash: nextHash, updatedAt: now } });
  await resetTokens.updateOne(
    { _id: resetRow._id },
    { $set: { used: true, usedAt: now } }
  );
  await resetTokens.updateMany(
    { userId: resetRow.userId, used: false },
    { $set: { used: true, usedAt: now, invalidatedBy: "password_reset" } }
  );
  const user = await users.findOne({ _id: resetRow.userId });
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }
  return user;
};

export const getUserById = async (id) => {
  const db = getDb();
  const users = db.collection(USERS);
  const idFilter = ObjectId.isValid(id) ? new ObjectId(id) : id;
  return users.findOne({ _id: idFilter });
};

export const updateUserThemePreference = async ({ userId, theme }) => {
  const db = getDb();
  const users = db.collection(USERS);
  const idFilter = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;
  await users.updateOne(
    { _id: idFilter },
    {
      $set: {
        "settings.theme": theme,
        updatedAt: Date.now(),
      },
    }
  );
  return getUserById(userId);
};
