import "dotenv/config";
import { env, REQUIRED_ENV_KEYS, getStartupEnvValidation } from "../src/config/env.mjs";
import { createServerApp } from "./app.js";
import { validateStartupConfig } from "./utils/startupValidation.js";
import { logError, logInfo, logWarn } from "../src/utils/logger.mjs";
import { startTelemetry, shutdownTelemetry } from "../src/observability/sdk.mjs";
import { connectDb, closeDb } from "../src/config/db.mjs";
import { connectMongoose, disconnectMongoose } from "../src/config/mongoose.mjs";
import { connectRedis, closeRedis } from "../src/config/redis.mjs";
import { validateLlmStartupConfig, verifyLlmConnection } from "../src/services/llmService.mjs";
import { startNewsIngestionScheduler, stopNewsIngestionScheduler } from "../src/services/newsService.mjs";
import { startKeepAliveScheduler, stopKeepAliveScheduler } from "../src/services/keepAlive.service.js";
import { seedDefaults } from "../src/seed/seedDefaults.mjs";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.NEUROBOT_PORT || env.port || 8787);
let dbRetryTimer = null;

const scheduleDbReconnect = () => {
  if (dbRetryTimer || !env.mongoUri || !env.mongo) return;
  dbRetryTimer = setInterval(async () => {
    try {
      await connectDb();
      clearInterval(dbRetryTimer);
      dbRetryTimer = null;
      logInfo("Database reconnect succeeded");
    } catch (error) {
      logWarn("Database reconnect attempt failed", {
        code: String(error?.code || ""),
        name: String(error?.name || ""),
        message: String(error?.message || "Database reconnect failed"),
      });
    }
  }, 30_000);
  dbRetryTimer.unref?.();
};

const bootstrap = async () => {
  await startTelemetry();
  const startupValidation = validateStartupConfig({ enforceInProduction: true });
  try {
    validateLlmStartupConfig();
  } catch (error) {
    logWarn("LLM startup configuration invalid; continuing without blocking auth/backend startup", {
      error: String(error?.message || error),
    });
  }

  const app = createServerApp();
  const server = app.listen(PORT, HOST);
  // Render's load balancer idle timeout is ~60s; keep Node timeouts above it to avoid RST on reuse.
  const isRender =
    ["1", "true"].includes(String(process.env.RENDER || "").trim().toLowerCase()) ||
    Boolean(String(process.env.RENDER_EXTERNAL_URL || "").trim());
  server.requestTimeout = isRender ? 120_000 : 20_000;
  server.headersTimeout = isRender ? 125_000 : 25_000;
  server.keepAliveTimeout = isRender ? 65_000 : 8_000;

  server.on("listening", () => {
    logInfo("Backend listening", {
      host: HOST,
      port: PORT,
      mode: "rebuild",
      startupEnvOk: startupValidation.report.ok,
      missingEnv: startupValidation.report.missingKeys,
    });
  });

  if (env.mongoUri && env.mongo) {
    try {
      await connectDb();
      // Connect Mongoose (for Mongoose-based models)
      try {
        await connectMongoose({ maxRetries: 1, exitOnFailure: false });
      } catch (mongooseError) {
        logWarn("Mongoose connection failed (non-blocking)", { error: String(mongooseError?.message || mongooseError) });
      }
      // Auto-seed default admin (and test user in non-production) if they don't exist.
      // Safe to call every startup — skips existing users.
      // Set SEED_SKIP=true env var to disable auto-seeding.
      if (process.env.SEED_SKIP !== "true") {
        const adminOnly = env.nodeEnv === "production";
        await seedDefaults({ adminOnly }).catch((seedErr) => {
          logWarn("Auto-seed failed (non-blocking)", { error: String(seedErr?.message || seedErr) });
        });
      }
    } catch (error) {
      logError("Database startup failed; continuing with auth database unavailable", error, {
        code: String(error?.code || ""),
        name: String(error?.name || ""),
      });
      scheduleDbReconnect();
    }
  } else {
    logWarn("Database startup skipped because env validation is incomplete", {
      missingKeys: startupValidation.report.missingKeys,
      mongoConfigured: Boolean(env.mongoUri),
      mongoValid: Boolean(env.mongo),
    });
  }
  if (env.redisUrl) {
    try {
      await connectRedis();
    } catch (error) {
      logWarn("Redis unavailable at startup; continuing without cache", { error: String(error?.message || error) });
      if (env.strictDependencyStartup) throw error;
    }
  }

  try {
    await verifyLlmConnection({ timeoutMs: Math.min(20_000, env.llmCriticalTimeoutMs) });
  } catch (error) {
    logWarn("LLM provider verification failed at startup; continuing with backend startup", {
      error: String(error?.message || error),
    });
  }

  startNewsIngestionScheduler({ intervalMs: env.newsRefreshIntervalMs });
  startKeepAliveScheduler();

  // Keep-alive ping every 14 minutes to prevent Render free tier from sleeping
  const BACKEND_URL = env.backendPublicUrl || process.env.BACKEND_PUBLIC_URL || '';
  if (env.nodeEnv === 'production' && BACKEND_URL) {
    const keepAliveInterval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        await fetch(`${BACKEND_URL.replace(/\/+$/, '')}/api/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        logInfo('Keep-alive ping sent to self');
      } catch (err) {
        logWarn('Keep-alive ping failed', { error: String(err?.message || err) });
      }
    }, 14 * 60 * 1000); // 14 minutes
    if (keepAliveInterval.unref) keepAliveInterval.unref();
  }

  let shuttingDown = false;
  const shutdown = async (signal = "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    logInfo("Shutting down backend", { signal });
    server.close(async () => {
      stopNewsIngestionScheduler();
      stopKeepAliveScheduler();
      await Promise.allSettled([closeDb(), disconnectMongoose(), closeRedis(), shutdownTelemetry()]);
      process.exit(0);
    });
    setTimeout(async () => {
      await Promise.allSettled([closeDb(), disconnectMongoose(), closeRedis(), shutdownTelemetry()]);
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", async (error) => {
    logError("Uncaught exception", error);
    await shutdown("uncaughtException");
  });
  process.on("unhandledRejection", async (reason) => {
    logError("Unhandled rejection", reason);
    await shutdown("unhandledRejection");
  });
};

bootstrap().catch(async (error) => {
  logError("Failed to bootstrap rebuilt backend", error, {
    code: String(error?.code || ""),
    issues: Array.isArray(error?.issues) ? error.issues : [],
    requiredEnv: REQUIRED_ENV_KEYS,
    startupEnv: getStartupEnvValidation(),
  });
  await shutdownTelemetry();
  process.exit(1);
});
