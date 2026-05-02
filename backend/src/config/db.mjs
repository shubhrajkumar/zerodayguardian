import { MongoClient } from "mongodb";
import { env } from "./env.mjs";
import { logInfo } from "../utils/logger.mjs";

let client;
let db;
let indexesEnsured = false;

const createDbUnavailableError = (message = "Database not initialized. Call connectDb first.") => {
  const error = new Error(message);
  error.status = 500;
  error.statusCode = 500;
  error.code = "db_unavailable";
  return error;
};

export const getDbPoolStatus = () => ({
  initialized: !!db,
  connected: !!client,
  maxPoolSize: 30,
  minPoolSize: 5,
  source: db ? "mongodb" : "none",
});

const deriveIndexName = (keys = {}) =>
  Object.entries(keys)
    .map(([field, direction]) => `${field}_${direction}`)
    .join("_");

const ensureIndex = async (collection, keys, options = {}) => {
  try {
    await collection.createIndex(keys, options);
  } catch (error) {
    const conflict = Number(error?.code || 0);
    if (![85, 86].includes(conflict)) throw error;
    const name = String(options.name || deriveIndexName(keys)).trim();
    if (!name) throw error;
    await collection.dropIndex(name).catch(() => {});
    await collection.createIndex(keys, options);
  }
};

export const connectDb = async () => {
  if (db) return db;

  const mongoUri = String(process.env.MONGODB_URI || env.mongoUri || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!mongoUri) {
    throw new Error("Missing required environment variable: MONGODB_URI");
  }

  const startedAt = Date.now();
  client = new MongoClient(mongoUri, {
    maxPoolSize: 30,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 10000,
  });

  await client.connect();
  await client.db("admin").command({ ping: 1 });
  db = client.db();

  if (!indexesEnsured) {
    await ensureIndex(db.collection("conversations"), { sessionId: 1 }, { unique: true });
    await ensureIndex(db.collection("conversations"), { userId: 1, updatedAt: -1 });
    await ensureIndex(db.collection("users"), { email: 1 }, { unique: true });
    await ensureIndex(db.collection("users"), { role: 1 });
    await ensureIndex(db.collection("users"),
      { emailHash: 1 },
      { unique: true, partialFilterExpression: { emailHash: { $type: "string" } } }
    );
    await db.collection("users").updateMany({ googleId: "" }, { $set: { googleId: null } });
    try {
      await db.collection("users").dropIndex("googleId_1");
    } catch {
      // ignore if the legacy index is absent
    }
    await ensureIndex(db.collection("users"),
      { googleId: 1 },
      {
        unique: true,
        partialFilterExpression: { googleId: { $type: "string" } },
        name: "googleId_1",
      }
    );
    await ensureIndex(db.collection("users"), { resetOtpExpire: 1 }, { sparse: true });
    await ensureIndex(db.collection("stream_checkpoints"), { streamId: 1 }, { unique: true });
    await ensureIndex(db.collection("stream_checkpoints"), { sessionId: 1, updatedAt: -1 });
    await ensureIndex(db.collection("stream_checkpoints"), { expiresAt: 1 }, { expireAfterSeconds: 0 });
    await ensureIndex(db.collection("osint_queries"), { userId: 1, createdAt: -1 });
    await ensureIndex(db.collection("scans"), { userId: 1, createdAt: -1 });
    await ensureIndex(db.collection("user_notifications"), { userId: 1, createdAt: -1 });
    await ensureIndex(db.collection("user_notifications"), { userId: 1, read: 1 });
    await ensureIndex(db.collection("adaptive_events"), { userId: 1, createdAt: -1 });
    await ensureIndex(db.collection("adaptive_events"), { surface: 1, type: 1, createdAt: -1 });
    await ensureIndex(db.collection("security_events"), { kind: 1, createdAt: -1 });
    await ensureIndex(db.collection("security_events"), { createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });
    await ensureIndex(db.collection("security_events"), { identifierHash: 1, createdAt: -1 });
    await ensureIndex(db.collection("growth_push_subscriptions"), { userId: 1, endpoint: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_push_subscriptions"), { createdAt: -1 });
    await ensureIndex(db.collection("growth_digest_preferences"), { userId: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_digest_preferences"), { enabled: 1, updatedAt: -1 });
    await ensureIndex(db.collection("growth_streak_freezes"), { userId: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_user_certifications"), { userId: 1, pathId: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_ctf_events"), { weekKey: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_ctf_events"), { startsAt: -1, endsAt: -1 });
    await ensureIndex(db.collection("growth_ctf_submissions"), { userId: 1, eventId: 1 });
    await ensureIndex(db.collection("growth_ctf_submissions"), { eventId: 1, correct: 1, createdAt: -1 });
    await ensureIndex(db.collection("growth_github_integrations"), { userId: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_billing_subscriptions"), { userId: 1 }, { unique: true });
    await ensureIndex(db.collection("growth_billing_subscriptions"), { status: 1, updatedAt: -1 });
    indexesEnsured = true;
  }

  logInfo("Database connected successfully", {
    dbName: db.databaseName,
    latencyMs: Date.now() - startedAt,
    pool: getDbPoolStatus(),
  });

  return db;
};

export const getDb = () => {
  if (!db) throw createDbUnavailableError();
  return db;
};

export const verifyDbConnection = async () => {
  const current = getDb();
  const startedAt = Date.now();
  await current.command({ ping: 1 });
  return { ok: true, latencyMs: Date.now() - startedAt, pool: getDbPoolStatus() };
};

export const closeDb = async () => {
  if (client) await client.close();
  client = null;
  db = null;
  indexesEnsured = false;
};
