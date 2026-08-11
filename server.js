import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./backend/src/app.mjs";
import { closeDb, connectDb, setExternalDb, verifyDbConnection } from "./backend/src/config/db.mjs";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || process.env.NEUROBOT_PORT || 8787);
// Use the raw MONGODB_URI from .env — no URI manipulation.
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || "";
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

    // Periodic DB health check — auto-reconnect if native driver connection drops
    const DB_HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
    const dbHealthTimer = setInterval(async () => {
      try {
        await verifyDbConnection();
      } catch (error) {
        console.warn("[DB Health] Connection lost, attempting reconnect:", error?.message || "unknown");
        try {
          await closeDb();
          await connectDb();
          console.log("[DB Health] Reconnected successfully");
        } catch (reconnectError) {
          console.error("[DB Health] Reconnect failed:", reconnectError?.message || "unknown");
        }
      }
    }, DB_HEALTH_CHECK_INTERVAL_MS);

    process.on("SIGINT", () => clearInterval(dbHealthTimer));
    process.on("SIGTERM", () => clearInterval(dbHealthTimer));
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

  // ── Log the exact URI being used (password masked) ──
  console.log("Connecting with URI:", process.env.MONGODB_URI.replace(/:([^@]+)@/, ":****@"));

  console.log("[MongoDB] Connecting to Atlas...");
  try {
    await Promise.race([
      mongoose.connect(process.env.MONGODB_URI),
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
    console.error("MONGO_DETAILED_ERROR:", error instanceof Error ? error.message : String(error), error instanceof Error ? error.code : "");
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
    // Fallback: Share Mongoose's native connection with the native driver layer.
    // This prevents the auth service from falling back to the in-memory store
    // (which loses data on every cold start/deploy).
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      try {
        setExternalDb(mongoose.connection.db, mongoose.connection.getClient());
        console.log("[MongoDB] Shared Mongoose Atlas connection with native driver layer");
      } catch (shareError) {
        console.warn("[MongoDB] Could not share Mongoose connection:", shareError instanceof Error ? shareError.message : String(shareError));
      }
    }
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

// ── Process-level crash handlers ──
process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRASH] Unhandled Promise Rejection:");
  console.error("  Reason:", reason instanceof Error ? reason.message : String(reason));
  if (reason instanceof Error) {
    console.error("  Stack:", reason.stack || "No stack trace");
  }
  console.error("  Timestamp:", new Date().toISOString());
  // Don't exit — keep the server alive but log the full error for debugging.
});

process.on("uncaughtException", (error) => {
  console.error("[CRASH] Uncaught Exception:");
  console.error("  Message:", error?.message || "Unknown error");
  console.error("  Stack:", error?.stack || "No stack trace");
  console.error("  Code:", error?.code || "none");
  console.error("  Timestamp:", new Date().toISOString());
  // Graceful shutdown on uncaught exception to avoid corrupted state.
  process.exit(1);
});

await connectMongoBestEffort();
await connectNativeDbBestEffort();
startHttpServer();
