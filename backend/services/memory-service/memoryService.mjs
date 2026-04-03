import { getDb } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";
import { encryptSensitive, decryptSensitive } from "../../src/utils/security.mjs";

const MEMORY = {
  users: new Map(),
  preferences: new Map(),
  learning: new Map(),
  security: new Map(),
  uploads: new Map(),
  audits: new Map(),
};

const COLLECTIONS = {
  users: "users",
  preferences: "user_preferences",
  learning: "learning_history",
  security: "security_logs",
  uploads: "uploaded_files",
  audits: "security_audit",
};

let indexesReady = false;

const canFallbackToMemory = () => env.nodeEnv !== "production";
const now = () => Date.now();
const actorKey = ({ userId = null, sessionId = null }) => (userId ? `user:${userId}` : `session:${sessionId || "anon"}`);

const ensureIndexes = async () => {
  if (indexesReady) return;
  let db;
  try {
    db = getDb();
  } catch {
    if (!canFallbackToMemory()) throw new Error("memory_db_unavailable");
    indexesReady = true;
    return;
  }
  const users = db.collection(COLLECTIONS.users);
  const prefs = db.collection(COLLECTIONS.preferences);
  const learning = db.collection(COLLECTIONS.learning);
  const security = db.collection(COLLECTIONS.security);
  const uploads = db.collection(COLLECTIONS.uploads);
  const audits = db.collection(COLLECTIONS.audits);

  await Promise.all([
    users.createIndex({ userId: 1 }, { unique: false }),
    users.createIndex({ sessionId: 1 }),
    users.createIndex({ email: 1 }),
    users.createIndex({ updatedAt: -1 }),
    prefs.createIndex({ actorKey: 1 }, { unique: true }),
    learning.createIndex({ actorKey: 1 }, { unique: true }),
    security.createIndex({ actorKey: 1 }, { unique: true }),
    uploads.createIndex({ actorKey: 1 }),
    uploads.createIndex({ createdAt: -1 }),
    audits.createIndex({ actorKey: 1 }),
    audits.createIndex({ createdAt: -1 }),
  ]);
  indexesReady = true;
};

const baseProfile = ({ userId = null, sessionId = null, name = "", email = "" } = {}) => ({
  userId,
  sessionId,
  name: String(name || "").trim(),
  email: String(email || "").trim(),
  interests: [],
  learningGoals: [],
  securityPreferences: [],
  lastInteractionAt: now(),
  createdAt: now(),
  updatedAt: now(),
});

const upsertMemory = async (collection, keyFilter, payload, memoryMap) => {
  try {
    await ensureIndexes();
    const db = getDb();
    await db.collection(collection).updateOne(keyFilter, { $set: payload }, { upsert: true });
    return payload;
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    memoryMap.set(keyFilter.actorKey || keyFilter.userId || keyFilter.sessionId, payload);
    return payload;
  }
};

const findMemory = async (collection, filter, memoryMap) => {
  try {
    await ensureIndexes();
    const db = getDb();
    return await db.collection(collection).findOne(filter);
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    return memoryMap.get(filter.actorKey || filter.userId || filter.sessionId) || null;
  }
};

export const getOrCreateUserProfile = async ({ userId = null, sessionId = null, name = "", email = "" } = {}) => {
  const key = actorKey({ userId, sessionId });
  const filter = userId ? { userId } : { sessionId };
  const existing = await findMemory(COLLECTIONS.users, filter, MEMORY.users);
  if (existing) return existing;
  const profile = baseProfile({ userId, sessionId, name, email });
  return upsertMemory(COLLECTIONS.users, { ...filter, actorKey: key }, profile, MEMORY.users);
};

export const updateUserProfile = async ({ userId = null, sessionId = null, updates = {} } = {}) => {
  const key = actorKey({ userId, sessionId });
  const filter = userId ? { userId } : { sessionId };
  const current = (await findMemory(COLLECTIONS.users, filter, MEMORY.users)) || baseProfile({ userId, sessionId });
  const merged = {
    ...current,
    ...updates,
    userId: current.userId || userId,
    sessionId: current.sessionId || sessionId,
    updatedAt: now(),
    lastInteractionAt: now(),
  };
  return upsertMemory(COLLECTIONS.users, { ...filter, actorKey: key }, merged, MEMORY.users);
};

export const saveUserPreferences = async ({ userId = null, sessionId = null, preferences = {} } = {}) => {
  const key = actorKey({ userId, sessionId });
  const payload = {
    actorKey: key,
    userId,
    sessionId,
    preferences,
    updatedAt: now(),
  };
  return upsertMemory(COLLECTIONS.preferences, { actorKey: key }, payload, MEMORY.preferences);
};

export const saveLearningHistory = async ({ userId = null, sessionId = null, learning = {} } = {}) => {
  const key = actorKey({ userId, sessionId });
  const payload = {
    actorKey: key,
    userId,
    sessionId,
    learning,
    updatedAt: now(),
  };
  return upsertMemory(COLLECTIONS.learning, { actorKey: key }, payload, MEMORY.learning);
};

export const saveSecurityPreferences = async ({ userId = null, sessionId = null, security = {} } = {}) => {
  const key = actorKey({ userId, sessionId });
  const payload = {
    actorKey: key,
    userId,
    sessionId,
    security,
    updatedAt: now(),
  };
  return upsertMemory(COLLECTIONS.security, { actorKey: key }, payload, MEMORY.security);
};

export const recordSecurityEvent = async ({ userId = null, sessionId = null, action = "", detail = "", metadata = {} } = {}) => {
  const key = actorKey({ userId, sessionId });
  const payload = {
    actorKey: key,
    userId,
    sessionId,
    action: String(action || "").slice(0, 120),
    detail: encryptSensitive(String(detail || "").slice(0, 2000)),
    metadata: encryptSensitive(metadata),
    createdAt: now(),
  };
  try {
    await ensureIndexes();
    const db = getDb();
    await db.collection(COLLECTIONS.audits).insertOne(payload);
    return payload;
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const existing = MEMORY.audits.get(key) || [];
    MEMORY.audits.set(key, [...existing, payload].slice(-50));
    return payload;
  }
};

export const getSecurityEvents = async ({ userId = null, sessionId = null, limit = 20 } = {}) => {
  const key = actorKey({ userId, sessionId });
  try {
    await ensureIndexes();
    const db = getDb();
    const rows = await db
      .collection(COLLECTIONS.audits)
      .find({ actorKey: key })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(50, limit)))
      .toArray();
    return rows.map((row) => ({
      ...row,
      detail: decryptSensitive(row.detail),
      metadata: (() => {
        const decrypted = decryptSensitive(row.metadata);
        try {
          return typeof decrypted === "string" ? JSON.parse(decrypted) : decrypted;
        } catch {
          return decrypted;
        }
      })(),
    }));
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const local = MEMORY.audits.get(key) || [];
    return local.slice(-Math.max(1, Math.min(50, limit))).map((row) => ({
      ...row,
      detail: decryptSensitive(row.detail),
    }));
  }
};

export const recordUploadedFile = async ({ userId = null, sessionId = null, file = {} } = {}) => {
  const key = actorKey({ userId, sessionId });
  const payload = {
    actorKey: key,
    userId,
    sessionId,
    filename: String(file.filename || "").slice(0, 255),
    mimeType: String(file.mimeType || "").slice(0, 120),
    size: Number(file.size || 0) || 0,
    createdAt: now(),
  };
  return upsertMemory(COLLECTIONS.uploads, { actorKey: key, createdAt: payload.createdAt }, payload, MEMORY.uploads);
};

export const getUserMemorySnapshot = async ({ userId = null, sessionId = null } = {}) => {
  const key = actorKey({ userId, sessionId });
  const profile =
    (await findMemory(COLLECTIONS.users, userId ? { userId } : { sessionId }, MEMORY.users)) ||
    baseProfile({ userId, sessionId });
  const preferences =
    (await findMemory(COLLECTIONS.preferences, { actorKey: key }, MEMORY.preferences))?.preferences || {};
  const learning = (await findMemory(COLLECTIONS.learning, { actorKey: key }, MEMORY.learning))?.learning || {};
  const security = (await findMemory(COLLECTIONS.security, { actorKey: key }, MEMORY.security))?.security || {};

  return {
    actorKey: key,
    profile,
    preferences,
    learning,
    security,
  };
};

export const getMemoryStats = async ({ userId = null, sessionId = null } = {}) => {
  const key = actorKey({ userId, sessionId });
  try {
    await ensureIndexes();
    const db = getDb();
    const [prefs, learning, security, uploads] = await Promise.all([
      db.collection(COLLECTIONS.preferences).countDocuments({ actorKey: key }),
      db.collection(COLLECTIONS.learning).countDocuments({ actorKey: key }),
      db.collection(COLLECTIONS.security).countDocuments({ actorKey: key }),
      db.collection(COLLECTIONS.uploads).countDocuments({ actorKey: key }),
    ]);
    return { preferences: prefs, learning, security, uploads };
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    return {
      preferences: MEMORY.preferences.has(key) ? 1 : 0,
      learning: MEMORY.learning.has(key) ? 1 : 0,
      security: MEMORY.security.has(key) ? 1 : 0,
      uploads: MEMORY.uploads.has(key) ? 1 : 0,
    };
  }
};

export const buildMemoryContext = ({ memory, recentMessages = [], activeTopic = null, knowledgeHits = [] } = {}) => {
  const profile = memory?.profile || {};
  const preferences = memory?.preferences || {};
  const learning = memory?.learning || {};
  const security = memory?.security || {};
  const recent = recentMessages
    .filter((m) => m?.role === "user")
    .slice(-3)
    .map((m) => String(m.content || "").slice(0, 160))
    .filter(Boolean);

  const lines = [];
  if (profile?.name) lines.push(`User name: ${profile.name}`);
  if (profile?.interests?.length) lines.push(`Interests: ${profile.interests.slice(0, 5).join(", ")}`);
  if (profile?.learningGoals?.length) lines.push(`Learning goals: ${profile.learningGoals.slice(0, 4).join(", ")}`);
  if (profile?.securityPreferences?.length) lines.push(`Security preferences: ${profile.securityPreferences.slice(0, 4).join(", ")}`);
  if (preferences?.assistantProfile?.tone) lines.push(`Preferred tone: ${preferences.assistantProfile.tone}`);
  if (learning?.level) lines.push(`Learning level: ${learning.level}`);
  if (learning?.track) lines.push(`Learning track: ${learning.track}`);
  if (security?.focus) lines.push(`Security focus: ${security.focus}`);
  if (activeTopic?.title) lines.push(`Active topic: ${String(activeTopic.title).slice(0, 120)}`);
  if (recent.length) lines.push(`Recent user prompts: ${recent.join(" | ")}`);

  if (knowledgeHits?.length) {
    const snippets = knowledgeHits
      .slice(0, 3)
      .map((hit) => String(hit?.summary || hit?.text || "").slice(0, 180))
      .filter(Boolean);
    if (snippets.length) lines.push(`Knowledge hints: ${snippets.join(" | ")}`);
  }

  return lines.join("\n").trim();
};
