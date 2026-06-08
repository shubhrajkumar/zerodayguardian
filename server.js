import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./backend/src/app.mjs";
import { connectDb, closeDb } from "./backend/src/config/db.mjs";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || process.env.NEUROBOT_PORT || 8787);
const MONGO_URI = String(process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const MONGO_CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000);

let serverStarted = false;
let mongooseReconnectTimer = null;
let keepAliveTimer = null;

const clearReconnectTimer = () => {
  if (!mongooseReconnectTimer) return;
  clearTimeout(mongooseReconnectTimer);
  mongooseReconnectTimer = null;
};

const startHttpServer = () => {
  if (serverStarted) return;
  serverStarted = true;

  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`[Server] Listening on http://${HOST}:${PORT}`);
    console.log("[Server] Startup complete");
    if (mongoose.connection.readyState === 1) {
      console.log(`[MongoDB] Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    } else {
      console.warn("[MongoDB] Continuing without active Atlas connection");
    }

    // Keep-alive: ping /api/health every 14 minutes to prevent Render cold starts
    const BACKEND_URL = process.env.BACKEND_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${PORT}`;
    const KEEPALIVE_INTERVAL_MS = 14 * 60 * 1000;
    keepAliveTimer = setInterval(() => {
      fetch(`${BACKEND_URL}/api/health`)
        .then((res) => {
          if (!res.ok) console.warn(`[KeepAlive] /api/health responded ${res.status}`);
        })
        .catch(() => {});
    }, KEEPALIVE_INTERVAL_MS);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(`[Server] Port ${PORT} is already in use. Stop the old process or change NEUROBOT_PORT/PORT.`);
      process.exit(1);
    }
    console.error("[Server] Startup error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
};

const connectMongoBestEffort = async () => {
  if (!MONGO_URI) {
    console.warn("[MongoDB] MONGO_URI/DATABASE_URL missing, starting server without Atlas connection");
    return;
  }

  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  console.log("[MongoDB] Connecting to Atlas...");
  try {
    await Promise.race([
      mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
        connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
        family: 4,
        maxPoolSize: 10,
        autoIndex: false,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Mongo connect timeout after ${MONGO_CONNECT_TIMEOUT_MS}ms`)), MONGO_CONNECT_TIMEOUT_MS)
      ),
    ]);

    clearReconnectTimer();
    // Reconcile indexes once after connect to resolve any conflicts
    try {
      const User = (await import("./backend/src/models/User.mjs")).User;
      await User.syncIndexes();
      console.log("[MongoDB] User model indexes synced");
    } catch {
      console.warn("[MongoDB] User.syncIndexes() skipped — will resolve on next startup");
    }
  } catch (error) {
    console.warn("[MongoDB] Atlas connect skipped:", error instanceof Error ? error.message : String(error));
  }
};

mongoose.connection.on("connected", () => {
  clearReconnectTimer();
  console.log(`[MongoDB] Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
});

mongoose.connection.on("error", (error) => {
  console.error("[MongoDB] Connection error:", error.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB] Disconnected");
  if (mongooseReconnectTimer || !MONGO_URI) return;
  mongooseReconnectTimer = setTimeout(() => {
    mongooseReconnectTimer = null;
    connectMongoBestEffort().catch((error) => {
      console.warn("[MongoDB] Reconnect skipped:", error instanceof Error ? error.message : String(error));
    });
  }, 3000);
});

const connectNativeDbBestEffort = async () => {
  try {
    await connectDb();
  } catch (error) {
    console.warn("[Mongo Native] Shared pool connect skipped:", error instanceof Error ? error.message : String(error));
  }
};

process.on("SIGINT", async () => {
  console.log("\n[Server] SIGINT received, shutting down...");
  clearReconnectTimer();
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  await mongoose.connection.close().catch(() => undefined);
  await closeDb().catch(() => undefined);
  console.log("[MongoDB] Connection closed");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Server] SIGTERM received, shutting down...");
  clearReconnectTimer();
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  await mongoose.connection.close().catch(() => undefined);
  await closeDb().catch(() => undefined);
  console.log("[MongoDB] Connection closed");
  process.exit(0);
});

await connectMongoBestEffort();
await connectNativeDbBestEffort();
startHttpServer();
