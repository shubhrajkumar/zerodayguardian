import { MongoClient } from "mongodb";
import { env } from "./env.mjs";
import { logInfo, logWarn } from "../utils/logger.mjs";

let client;
let db;
let indexesEnsured = false;

/**
 * Set an external DB instance (e.g., from Mongoose's native connection).
 * This allows the native driver layer to share Mongoose's connection when
 * connectDb() fails but Mongoose succeeds — preventing the auth service
 * from falling back to the ephemeral in-memory store.
 */
export const setExternalDb = (dbInstance, clientInstance) => {
  if (!db && dbInstance) {
    db = dbInstance;
    client = clientInstance || null;
  }
};

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

  const mongoUri = process.env.MONGODB_URI || "";
  if (!mongoUri) {
    logWarn("Database connection skipped because MONGODB_URI is not configured", {
      environment: env.nodeEnv,
    });
    throw new Error("Database connection skipped: MONGODB_URI is missing");
  }

  const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  logInfo("[MongoDB] Native driver URI (masked): " + maskedUri, {
    hasDbName: /\/zeroday_guardian/.test(mongoUri),
  });

  const startedAt = Date.now();

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const candidateClient = new MongoClient(mongoUri);
      await candidateClient.connect();
      await candidateClient.db("admin").command({ ping: 1 });
      client = candidateClient;
      db = client.db();
      break;
    } catch (error) {
      lastError = error;
      console.error("MONGO_DETAILED_ERROR:", error.message, "code:", error.code, "name:", error.name);
      logWarn("MongoDB connection failed", {
        attempt,
        maxRetries: 3,
        code: String(error?.code || ""),
        name: String(error?.name || ""),
        message: String(error?.message || "MongoDB connection failed"),
      });

      if (attempt < 3) {
        const delayMs = 2000 * attempt;
        logInfo(`MongoDB connection retry in ${delayMs}ms`, { attempt: attempt + 1, maxRetries: 3 });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!db) {
    console.error("[MongoDB] All connection attempts exhausted. Starting with fallback in-memory store.");
    throw lastError || createDbUnavailableError("Database connection failed for the configured MongoDB URI.");
  }

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
