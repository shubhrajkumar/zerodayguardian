import net from "node:net";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { env } from "./config/env.mjs";
import { markFatal } from "./state/runtimeState.mjs";
import { startTelemetry, shutdownTelemetry } from "./observability/sdk.mjs";
import { logError, logInfo, logWarn, redact } from "./utils/logger.mjs";

const HOST = process.env.HOST || "0.0.0.0";
const BASE_PORT = Number(process.env.NEUROBOT_PORT || env.port || 8787);
const MAX_PORT_CANDIDATES = Number(process.env.MAX_PORT_CANDIDATES || 10);
const RUNTIME_DIR = path.resolve(process.cwd(), ".local", "runtime");
const PORT_MANIFEST_PATH = path.join(RUNTIME_DIR, "neurobot-port.json");
const ALLOW_PORT_FALLBACK =
  process.env.ALLOW_PORT_FALLBACK != null
    ? String(process.env.ALLOW_PORT_FALLBACK) === "true"
    : env.nodeEnv !== "production";

const isPortFree = (port, host = HOST) =>
  new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, host);
  });

const resolveListenPort = async () => {
  if (!ALLOW_PORT_FALLBACK) return BASE_PORT;
  for (let index = 0; index < MAX_PORT_CANDIDATES; index += 1) {
    const candidate = BASE_PORT + index;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) return candidate;
  }
  const error = new Error(`No available port in range ${BASE_PORT}-${BASE_PORT + MAX_PORT_CANDIDATES - 1}`);
  error.code = "no_free_port";
  throw error;
};

const writePortManifest = (port) => {
  mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(
    PORT_MANIFEST_PATH,
    JSON.stringify(
      {
        port,
        host: HOST,
        basePort: BASE_PORT,
        pid: process.pid,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
};

const clearPortManifest = () => {
  rmSync(PORT_MANIFEST_PATH, { force: true });
};

const bootstrap = async () => {
  await startTelemetry();

  const [{ createApp }, dbModule, redisModule, llmModule] = await Promise.all([
    import("./app.mjs"),
    import("./config/db.mjs"),
    import("./config/redis.mjs"),
    import("./ai-engine/index.mjs"),
  ]);

  const { connectDb, closeDb, getDbPoolStatus } = dbModule;
  const { connectRedis, closeRedis } = redisModule;
  const { verifyAiEngine, runAiSelfDiagnosis, validateAiStartupConfig, startAiHealthMonitor, stopAiHealthMonitor } = llmModule;

  logInfo("Starting NeuroBot backend", {
    nodeEnv: env.nodeEnv,
    host: HOST,
    basePort: BASE_PORT,
    allowPortFallback: ALLOW_PORT_FALLBACK,
    maxPortCandidates: MAX_PORT_CANDIDATES,
    corsOrigin: env.corsOrigin,
    llmMode: env.llmMode,
    routingMode: env.routingMode,
    openaiModel: env.openaiModel,
    googleModel: env.googleModel,
    databaseConfigured: !!env.mongoUri,
    redisConfigured: !!env.redisUrl,
    mongoUri: env.mongo.masked,
    strictDependencyStartup: env.strictDependencyStartup,
    openaiKey: redact(env.openaiApiKey),
    googleKey: redact(env.googleApiKey),
  });

  try {
    const db = await connectDb();
    if (db) logInfo("Database connection verified.", { pool: getDbPoolStatus() });
    else logInfo("Database unavailable; using in-memory conversation store.", { pool: getDbPoolStatus() });
  } catch (error) {
    logError("Database startup check failed", error);
    if (env.strictDependencyStartup) throw error;
    logInfo("Continuing startup in degraded mode: database unavailable.");
  }

  try {
    await connectRedis();
    logInfo("Redis connection verified.");
  } catch (error) {
    logError("Redis startup check failed", error);
    if (env.strictDependencyStartup) throw error;
    logInfo("Continuing startup in degraded mode: redis unavailable.");
  }

  try {
    validateAiStartupConfig();
    logInfo("LLM configuration validated.");
  } catch (error) {
    logError("LLM configuration invalid at startup", error);
    if (env.strictDependencyStartup) throw error;
  }

  if (env.verifyLlmOnStartup) {
    try {
      const verification = await verifyAiEngine({ timeoutMs: env.llmCriticalTimeoutMs });
      logInfo("LLM connectivity verified.", {
        provider: verification?.provider || "",
        model: verification?.model || "",
        latencyMs: Number(verification?.latencyMs || 0) || 0,
        attempts: Number(verification?.attempts || 1) || 1,
        verifyRequired: env.verifyLlmOnStartup,
      });
      if (verification?.latencyExceeded) {
        logWarn("LLM startup check passed with elevated latency", {
          provider: verification?.provider || "",
          model: verification?.model || "",
          latencyMs: Number(verification?.latencyMs || 0) || 0,
          maxLatencyMs: env.llmMaxLatencyMs,
        });
      }
    } catch (error) {
      logError("LLM startup check failed", error);
      try {
        const diagnostics = await runAiSelfDiagnosis({ timeoutMs: env.llmCriticalTimeoutMs });
        logWarn("LLM startup self-diagnosis", {
          rootCause: diagnostics.rootCause?.code || "unknown",
          outbound: diagnostics.outbound?.ok === true ? "up" : "down",
          providers: Object.fromEntries(
            Object.entries(diagnostics.providers || {}).map(([provider, report]) => [
              provider,
              {
                dns: report?.dns?.ok === true ? "up" : "down",
                tcp: report?.tcp?.ok === true ? "up" : "down",
                endpoint: report?.endpoint?.ok === true ? "up" : "down",
                endpointCode: report?.endpoint?.code || "",
              },
            ])
          ),
        });
      } catch (diagnosticError) {
        logError("LLM startup self-diagnosis failed", diagnosticError);
      }
      if (env.strictDependencyStartup && env.verifyLlmOnStartup) throw error;
      logWarn("Continuing startup in degraded mode: llm not reachable.", {
        verifyRequired: env.verifyLlmOnStartup,
      });
    }
  } else {
    logInfo("Skipping LLM startup check.", { verifyRequired: env.verifyLlmOnStartup });
  }
  startAiHealthMonitor();
  logInfo("LLM health monitor started.", {
    intervalMs: env.llmHealthProbeIntervalMs,
    timeoutMs: env.llmHealthProbeTimeoutMs,
  });

  const app = createApp();
  const listenPort = await resolveListenPort();
  const server = app.listen(listenPort, HOST);

  server.requestTimeout = 35_000;
  server.headersTimeout = 40_000;
  server.keepAliveTimeout = 8_000;

  server.on("listening", () => {
    writePortManifest(listenPort);
    logInfo("Backend listening", { host: HOST, port: listenPort });
  });
  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      logError(`Port conflict on ${HOST}:${listenPort}`, error, {
        code: "port_in_use",
        hint: "Kill conflicting PID or change NEUROBOT_PORT.",
      });
      process.exit(1);
    }
    logError("Server startup error", error);
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = async (signal = "SIGTERM") => {
    if (shuttingDown) return;
    shuttingDown = true;
    logInfo("Shutting down...", { signal, port: listenPort });
    clearPortManifest();
    server.close(async () => {
      await Promise.allSettled([closeDb(), closeRedis(), Promise.resolve(stopAiHealthMonitor()), shutdownTelemetry()]);
      process.exit(0);
    });
    setTimeout(async () => {
      logError("Forced shutdown after timeout", new Error("shutdown_timeout"));
      await Promise.allSettled([closeDb(), closeRedis(), Promise.resolve(stopAiHealthMonitor()), shutdownTelemetry()]);
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", async (error) => {
    markFatal("uncaught_exception");
    logError("Uncaught exception", error);
    await shutdown("uncaughtException");
  });
  process.on("unhandledRejection", async (reason) => {
    markFatal("unhandled_rejection");
    logError("Unhandled rejection", reason);
    await shutdown("unhandledRejection");
  });
};

bootstrap().catch(async (error) => {
  logError("Failed to start", error);
  await shutdownTelemetry();
  process.exit(1);
});
