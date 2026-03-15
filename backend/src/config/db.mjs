import { MongoClient } from "mongodb";
import net from "node:net";
import { env } from "./env.mjs";
import { logError, logInfo, logWarn } from "../utils/logger.mjs";

let client;
let db;

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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    client = new MongoClient(env.mongoUri, {
      maxPoolSize: 30,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 1800,
      connectTimeoutMS: 1800,
      socketTimeoutMS: 8000,
    });
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      connected = true;
      break;
    } catch (error) {
      lastError = error;
      try {
        await client.close();
      } catch {
        // ignore close failure
      }
      client = null;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 260 * 2 ** attempt));
      }
    }
  }
  if (!connected) {
    logError("Database connection attempt failed", lastError, {
      dbHost: env.mongo.host,
      dbPort: env.mongo.port,
      dbName: env.mongo.dbName,
      dbUri: env.mongo.masked,
    });
    if (env.strictDependencyStartup) throw lastError || new Error("db_connect_failed");
    client = null;
    db = null;
    return null;
  }
  db = client.db(process.env.MONGODB_DB_NAME || "neurobot");

  await db.collection("conversations").createIndex({ sessionId: 1 }, { unique: true });
  await db.collection("conversations").createIndex({ userId: 1, updatedAt: -1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("password_reset_tokens").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("password_reset_tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("stream_checkpoints").createIndex({ streamId: 1 }, { unique: true });
  await db.collection("stream_checkpoints").createIndex({ sessionId: 1, updatedAt: -1 });
  await db.collection("stream_checkpoints").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

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
  if (!db) throw new Error("Database not initialized. Call connectDb first.");
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
};
