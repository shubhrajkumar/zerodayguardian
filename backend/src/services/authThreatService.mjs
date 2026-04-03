import { getDbPoolStatus, getDb } from "../config/db.mjs";
import { createBlindIndex } from "../utils/security.mjs";
import { logWarn } from "../utils/logger.mjs";

const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const FAILURE_THRESHOLD = 7;
const CACHE_LIMIT = 2000;
const memoryState = new Map();

const now = () => Date.now();

const isDbAvailable = () => {
  const pool = getDbPoolStatus();
  return pool.initialized && pool.connected;
};

const pruneState = () => {
  const cutoff = now() - WINDOW_MS - LOCK_MS;
  for (const [key, entry] of memoryState.entries()) {
    if ((entry?.lockedUntil || 0) < cutoff && (entry?.failures?.[entry.failures.length - 1] || 0) < cutoff) {
      memoryState.delete(key);
    }
  }
  if (memoryState.size <= CACHE_LIMIT) return;
  const oldest = [...memoryState.entries()]
    .sort((a, b) => (a[1]?.updatedAt || 0) - (b[1]?.updatedAt || 0))
    .slice(0, Math.max(1, memoryState.size - CACHE_LIMIT));
  oldest.forEach(([key]) => memoryState.delete(key));
};

const getKey = ({ ip = "", identifier = "" }) => `${String(ip || "").trim() || "unknown"}::${String(identifier || "").trim() || "anon"}`;

const getEntry = (key) => {
  const current = memoryState.get(key) || { failures: [], lockedUntil: 0, updatedAt: 0 };
  current.failures = (current.failures || []).filter((ts) => ts >= now() - WINDOW_MS);
  memoryState.set(key, current);
  return current;
};

const persistSecurityEvent = async ({ ip, identifierHash, outcome, reason, userId = "" }) => {
  if (!isDbAvailable()) return;
  try {
    await getDb().collection("security_events").insertOne({
      kind: "auth",
      ip: String(ip || ""),
      identifierHash: String(identifierHash || ""),
      userId: String(userId || ""),
      outcome: String(outcome || ""),
      reason: String(reason || ""),
      createdAt: now(),
    });
  } catch {
    // keep auth path non-blocking
  }
};

export const assertAuthAttemptAllowed = async ({ req, identifier = "" }) => {
  pruneState();
  const identifierHash = createBlindIndex(identifier || req.ip || "anon", "auth-identifier");
  const key = getKey({ ip: req.ip, identifier: identifierHash });
  const entry = getEntry(key);
  entry.updatedAt = now();

  if (Number(entry.lockedUntil || 0) > now()) {
    const retryAfterSec = Math.max(1, Math.ceil((Number(entry.lockedUntil || 0) - now()) / 1000));
    const error = new Error("Authentication temporarily locked due to suspicious activity.");
    error.status = 429;
    error.code = "auth_temporarily_locked";
    error.retryAfterSec = retryAfterSec;
    throw error;
  }
};

export const recordAuthFailure = async ({ req, identifier = "", reason = "unknown", userId = "" }) => {
  pruneState();
  const identifierHash = createBlindIndex(identifier || req.ip || "anon", "auth-identifier");
  const key = getKey({ ip: req.ip, identifier: identifierHash });
  const entry = getEntry(key);
  entry.failures.push(now());
  entry.updatedAt = now();
  if (entry.failures.length >= FAILURE_THRESHOLD) {
    entry.lockedUntil = now() + LOCK_MS;
    logWarn("Auth threat lock activated", {
      requestId: req.requestId || "",
      ip: req.ip || "",
      userId: userId || "",
      reason,
      retryAfterSec: Math.ceil(LOCK_MS / 1000),
    });
  }
  memoryState.set(key, entry);
  await persistSecurityEvent({ ip: req.ip, identifierHash, outcome: "failure", reason, userId });
};

export const recordAuthSuccess = async ({ req, identifier = "", userId = "" }) => {
  pruneState();
  const identifierHash = createBlindIndex(identifier || req.ip || "anon", "auth-identifier");
  const key = getKey({ ip: req.ip, identifier: identifierHash });
  memoryState.delete(key);
  await persistSecurityEvent({ ip: req.ip, identifierHash, outcome: "success", reason: "ok", userId });
};
