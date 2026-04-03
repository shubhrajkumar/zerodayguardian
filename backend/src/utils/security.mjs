import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "../config/env.mjs";

export const sanitizeText = (value = "") =>
  String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

export const createSessionId = () => randomUUID();

const fallbackBlindIndexKey = () => env.dbEncryptionKey || env.jwtSecret || env.sessionSecret || "unsafe-dev-secret";

export const createBlindIndex = (value = "", namespace = "default") =>
  createHmac("sha256", fallbackBlindIndexKey())
    .update(`${namespace}:${String(value || "").trim().toLowerCase()}`)
    .digest("hex");

export const signSession = (sessionId) =>
  createHmac("sha256", env.sessionSecret || "unsafe-dev-secret").update(sessionId).digest("hex");

export const verifySessionSignature = (sessionId, signature) => {
  const expected = Buffer.from(signSession(sessionId));
  const received = Buffer.from(String(signature || ""));
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
};

const sessionKey = () => scryptSync(env.sessionSecret, "neurobot-cookie-salt", 32);
const dbKey = () => (env.dbEncryptionKey ? scryptSync(env.dbEncryptionKey, "zorvix-db-salt", 32) : null);

const encodePacked = (payload) => Buffer.from(JSON.stringify(payload)).toString("base64url");
const decodePacked = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

export const encryptSessionToken = (sessionId) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(sessionId, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: encrypted.toString("base64"),
    })
  ).toString("base64url");
};

export const decryptSessionToken = (token) => {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      sessionKey(),
      Buffer.from(parsed.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
};

export const encryptSensitive = (value) => {
  if (!env.dbEncryptionKey) return value;
  if (value == null || value === "") return value;
  try {
    const key = dbKey();
    if (!key) return value;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const input = typeof value === "string" ? value : JSON.stringify(value);
    const encrypted = Buffer.concat([cipher.update(input, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:${encodePacked({ iv: iv.toString("base64"), tag: tag.toString("base64"), data: encrypted.toString("base64") })}`;
  } catch {
    return value;
  }
};

export const decryptSensitive = (value) => {
  if (!env.dbEncryptionKey) return value;
  if (typeof value !== "string" || !value.startsWith("enc:")) return value;
  try {
    const packed = value.slice(4);
    const parsed = decodePacked(packed);
    const key = dbKey();
    if (!key) return value;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64"));
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(parsed.data, "base64")), decipher.final()]);
    const output = decrypted.toString("utf8");
    return output;
  } catch {
    return value;
  }
};
