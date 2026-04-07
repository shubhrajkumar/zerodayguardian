import { MongoClient } from "mongodb";
import net from "node:net";
import { env } from "./env.mjs";
import { logError, logInfo, logWarn } from "../utils/logger.mjs";

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

const checkTcpPort = (host, port, timeoutMs = 1200) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });

export const getDbPoolStatus = () => ({
  initialized: !!db,
  connected: !!client,
  maxPoolSize: 30,
  minPoolSize: 5,
  source: db ? "mongodb" : "none",
});

export const connectDb = async () => {
  if (db) return db;
  if (!String(env.mongoUri || "").trim()) {
    logWarn("Database URL missing, continuing without MongoDB connection");
    return null;
  }
  
  // Check if we should skip database connection in development
  const skipDb = process.env.SKIP_DB_CONNECTION === "true";
  if (skipDb) {
    logInfo("Skipping database connection (SKIP_DB_CONNECTION=true)");
    return null;
  }
  
  if (!env.mongo.isSrv) {
    const reachable = await checkTcpPort(env.mongo.host, env.mongo.port, 1200);
    if (!reachable) {
      const error = new Error(`DB host unreachable ${env.mongo.host}:${env.mongo.port}`);
      logError("Database TCP precheck failed", error, {
        dbHost: env.mongo.host,
        dbPort: env.mongo.port,
        dbUri: env.mongo.masked,
      });
      if (env.strictDependencyStartup) throw error;
      logWarn("Database unavailable, continuing with in-memory storage");
      return null;
    }
  }

  if (env.mongo.requiresTlsHint) {
    logWarn("DATABASE_URL likely requires TLS for remote host; add tls=true/ssl=true if your provider mandates it.", {
      dbHost: env.mongo.host,
      dbUri: env.mongo.masked,
    });
  }

  const startedAt = Date.now();
  let connected = false;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    client = new MongoClient(env.mongoUri, {
      maxPoolSize: 30,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 8000,
    });
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      connected = true;
      break;
    } catch (error) {
      lastError = error;
      logWarn(`Database connection attempt ${attempt + 1} failed`, { error: error.message });
      try {
        await client.close();
      } catch {
        // ignore close failure
      }
      client = null;
      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  if (!connected) {
    logError("Database connection failed, using in-memory storage", lastError, {
      dbHost: env.mongo.host,
      dbPort: env.mongo.port,
      dbName: env.mongo.dbName,
      dbUri: env.mongo.masked,
    });
    // Don't throw error, just return null to use in-memory storage
    client = null;
    db = null;
    return null;
  }
  db = client.db(process.env.MONGODB_DB_NAME || "neurobot");

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
    dbHost: env.mongo.host,
    dbPort: env.mongo.port,
    dbName: env.mongo.dbName,
    dbUri: env.mongo.masked,
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
