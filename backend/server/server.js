import "dotenv/config";
import { env } from "../src/config/env.mjs";
import { createServerApp } from "./app.js";
import { validateStartupConfig } from "./utils/startupValidation.js";
import { logError, logInfo, logWarn } from "../src/utils/logger.mjs";
import { startTelemetry, shutdownTelemetry } from "../src/observability/sdk.mjs";
import { connectDb, closeDb } from "../src/config/db.mjs";
import { connectRedis, closeRedis } from "../src/config/redis.mjs";
import { validateLlmStartupConfig, verifyLlmConnection } from "../src/services/llmService.mjs";
import { startNewsIngestionScheduler, stopNewsIngestionScheduler } from "../src/services/newsService.mjs";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.NEUROBOT_PORT || env.port || 8787);

const bootstrap = async () => {
  await startTelemetry();
  validateStartupConfig();
  validateLlmStartupConfig();

  await connectDb();
  if (env.redisUrl) {
    try {
      await connectRedis();
    } catch (error) {
      logWarn("Redis unavailable at startup", { error: String(error?.message || error) });
      if (env.strictDependencyStartup) throw error;
    }
  }

  await verifyLlmConnection({ timeoutMs: Math.min(20_000, env.llmCriticalTimeoutMs) });

  const app = createServerApp();
  
  const server = app.listen(PORT, HOST);
  server.requestTimeout = 20_000;
  server.headersTimeout = 25_000;
  server.keepAliveTimeout = 8_000;

  startNewsIngestionScheduler({ intervalMs: env.newsRefreshIntervalMs });

  server.on("listening", () => {
    logInfo("Backend listening", { host: HOST, port: PORT, mode: "rebuild" });
  });

  let shuttingDown = false;
  const shutdown = async (signal = "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    logInfo("Shutting down backend", { signal });
    server.close(async () => {
      stopNewsIngestionScheduler();
      await Promise.allSettled([closeDb(), closeRedis(), shutdownTelemetry()]);
      process.exit(0);
    });
    setTimeout(async () => {
      await Promise.allSettled([closeDb(), closeRedis(), shutdownTelemetry()]);
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
  logError("Failed to bootstrap rebuilt backend", error);
  await shutdownTelemetry();
  process.exit(1);
});
