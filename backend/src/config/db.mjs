import { MongoClient } from "mongodb";
import { logInfo } from "../utils/logger.mjs";

let client;
let db;
let indexesEnsured = false;
const MONGODB_URI = String(process.env.MONGODB_URI || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");

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

export const connectDb = async () => {
  if (db) return db;
  if (!MONGODB_URI) {
    throw new Error("Missing required environment variable: MONGODB_URI");
  }

  const startedAt = Date.now();
  client = new MongoClient(MONGODB_URI, {
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
    await db.collection("conversations").createIndex({ sessionId: 1 }, { unique: true });
    await db.collection("conversations").createIndex({ userId: 1, updatedAt: -1 });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ role: 1 });
    await db.collection("users").createIndex(
      { emailHash: 1 },
      { unique: true, partialFilterExpression: { emailHash: { $type: "string" } } }
    );
    await db.collection("users").updateMany({ googleId: "" }, { $set: { googleId: null } });
    try {
      await db.collection("users").dropIndex("googleId_1");
    } catch {
      // ignore if the legacy index is absent
    }
    await db.collection("users").createIndex(
      { googleId: 1 },
      {
        unique: true,
        partialFilterExpression: { googleId: { $type: "string" } },
        name: "googleId_1",
      }
    );
    await db.collection("users").createIndex({ resetOtpExpire: 1 }, { sparse: true });
    await db.collection("stream_checkpoints").createIndex({ streamId: 1 }, { unique: true });
    await db.collection("stream_checkpoints").createIndex({ sessionId: 1, updatedAt: -1 });
    await db.collection("stream_checkpoints").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("osint_queries").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("scans").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("user_notifications").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("user_notifications").createIndex({ userId: 1, read: 1 });
    await db.collection("adaptive_events").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("adaptive_events").createIndex({ surface: 1, type: 1, createdAt: -1 });
    await db.collection("security_events").createIndex({ kind: 1, createdAt: -1 });
    await db.collection("security_events").createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });
    await db.collection("security_events").createIndex({ identifierHash: 1, createdAt: -1 });
    await db.collection("growth_push_subscriptions").createIndex({ userId: 1, endpoint: 1 }, { unique: true });
    await db.collection("growth_push_subscriptions").createIndex({ createdAt: -1 });
    await db.collection("growth_digest_preferences").createIndex({ userId: 1 }, { unique: true });
    await db.collection("growth_digest_preferences").createIndex({ enabled: 1, updatedAt: -1 });
    await db.collection("growth_streak_freezes").createIndex({ userId: 1 }, { unique: true });
    await db.collection("growth_user_certifications").createIndex({ userId: 1, pathId: 1 }, { unique: true });
    await db.collection("growth_ctf_events").createIndex({ weekKey: 1 }, { unique: true });
    await db.collection("growth_ctf_events").createIndex({ startsAt: -1, endsAt: -1 });
    await db.collection("growth_ctf_submissions").createIndex({ userId: 1, eventId: 1 });
    await db.collection("growth_ctf_submissions").createIndex({ eventId: 1, correct: 1, createdAt: -1 });
    await db.collection("growth_github_integrations").createIndex({ userId: 1 }, { unique: true });
    await db.collection("growth_billing_subscriptions").createIndex({ userId: 1 }, { unique: true });
    await db.collection("growth_billing_subscriptions").createIndex({ status: 1, updatedAt: -1 });
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
