import { getDb } from "../../src/config/db.mjs";
import { env } from "../../src/config/env.mjs";

const MEMORY = {
  items: [],
};

const COLLECTION = "knowledge_items";
const DIM = 128;
const MAX_TEXT = 2000;
const MAX_QUERY_ITEMS = 200;
const canFallbackToMemory = () => env.nodeEnv !== "production";

const now = () => Date.now();
const actorKey = ({ userId = null, sessionId = null }) => (userId ? `user:${userId}` : `session:${sessionId || "anon"}`);

const tokenize = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 400);

const hashToken = (token) => {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const embedText = (text = "") => {
  const vector = Array.from({ length: DIM }, () => 0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const idx = hashToken(token) % DIM;
    vector[idx] += 1;
  }
  const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
};

const cosine = (a = [], b = []) => {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
};

const ensureIndexes = async () => {
  let db;
  try {
    db = getDb();
  } catch {
    if (!canFallbackToMemory()) throw new Error("knowledge_db_unavailable");
    return;
  }
  await db.collection(COLLECTION).createIndex({ actorKey: 1, createdAt: -1 });
};

export const ingestKnowledge = async ({ userId = null, sessionId = null, source = "conversation", text = "", metadata = {} } = {}) => {
  const compact = String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!compact) return null;
  const doc = {
    actorKey: actorKey({ userId, sessionId }),
    userId,
    sessionId,
    source,
    text: compact,
    summary: String(metadata.summary || "").slice(0, 240),
    tags: Array.isArray(metadata.tags) ? metadata.tags.slice(0, 6) : [],
    embedding: embedText(compact),
    createdAt: now(),
  };
  try {
    await ensureIndexes();
    const db = getDb();
    await db.collection(COLLECTION).insertOne(doc);
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    MEMORY.items.push(doc);
  }
  return doc;
};

const fetchRecentItems = async (actor, limit = MAX_QUERY_ITEMS) => {
  try {
    await ensureIndexes();
    const db = getDb();
    return await db.collection(COLLECTION).find({ actorKey: actorKey(actor) }).sort({ createdAt: -1 }).limit(limit).toArray();
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    return MEMORY.items.filter((item) => item.actorKey === actorKey(actor)).slice(-limit);
  }
};

export const searchKnowledge = async ({ userId = null, sessionId = null, query = "", limit = 4 } = {}) => {
  const q = String(query || "").trim();
  if (!q) return [];
  const actor = { userId, sessionId };
  const items = await fetchRecentItems(actor);
  if (!items.length) return [];
  const qVec = embedText(q);
  return items
    .map((item) => ({
      ...item,
      score: cosine(qVec, item.embedding || []),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

export const getKnowledgeStats = async ({ userId = null, sessionId = null } = {}) => {
  const actor = { userId, sessionId };
  try {
    await ensureIndexes();
    const db = getDb();
    const total = await db.collection(COLLECTION).countDocuments({ actorKey: actorKey(actor) });
    return { total };
  } catch (error) {
    if (!canFallbackToMemory()) throw error;
    const total = MEMORY.items.filter((item) => item.actorKey === actorKey(actor)).length;
    return { total };
  }
};
