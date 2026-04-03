import { getDb } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";
import { logWarn } from "../../src/utils/logger.mjs";

const COLLECTION = "ai_request_logs";
const MEMORY = [];
const canFallbackToMemory = () => env.nodeEnv !== "production";

const sanitize = (value = "", max = 200) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

export const recordAiRequest = async ({
  requestId = "",
  userId = null,
  sessionId = null,
  mode = "general",
  provider = "",
  status = "ok",
  latencyMs = 0,
  promptSummary = "",
  metadata = {},
} = {}) => {
  const payload = {
    requestId: sanitize(requestId, 120),
    userId,
    sessionId,
    mode: sanitize(mode, 40),
    provider: sanitize(provider, 40),
    status: sanitize(status, 20),
    latencyMs: Number(latencyMs || 0) || 0,
    promptSummary: sanitize(promptSummary, 240),
    metadata,
    createdAt: Date.now(),
  };
  try {
    const db = getDb();
    await db.collection(COLLECTION).insertOne(payload);
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    MEMORY.push(payload);
    if (MEMORY.length > 200) MEMORY.shift();
    logWarn("AI request logger fell back to memory", { reason: String(error?.message || "db_unavailable") });
  }
};

export const getAiRequestLogs = async ({ limit = 20 } = {}) => {
  try {
    const db = getDb();
    return await db.collection(COLLECTION).find({}).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(100, limit))).toArray();
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    return MEMORY.slice(-Math.max(1, Math.min(100, limit))).reverse();
  }
};
