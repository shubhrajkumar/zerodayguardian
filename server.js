import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(String(process.env.PORT || process.env.NEUROBOT_PORT || "10000"), 10) || 10000;
const MONGO_URI = String(process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");
const MONGO_CONNECT_TIMEOUT_MS = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 8000);
const RENDER_EXTERNAL_URL = String(process.env.RENDER_EXTERNAL_URL || "").trim().replace(/\/+$/, "");
const STARTUP_RETRY_MS = Math.max(5000, Number(process.env.STARTUP_RETRY_MS || 15000));
const SAFE_SESSION_SECRET = "render-session-secret-placeholder-0000000000000000";
const SAFE_JWT_SECRET = "render-jwt-secret-placeholder-000000000000000000000000";
const SAFE_DB_ENCRYPTION_KEY = "render-db-encryption-key-placeholder-000000000000000";
const isManagedRuntime =
  ["1", "true"].includes(String(process.env.RENDER || "").trim().toLowerCase()) ||
  Boolean(RENDER_EXTERNAL_URL);
let startupPublicConfig = {
  backendPublicUrl: "",
  appBaseUrl: "",
  corsOrigin: "",
  googleRedirectUri: "",
  googleAuthorizedOrigins: [],
};

let activeHandler = null;
let fullAppReady = false;
let bootstrapInFlight = false;
let bootstrapAttempts = 0;
let retryTimer = null;
let httpServer = null;
let closeDb = async () => undefined;
let mongooseReconnectTimer = null;

const log = (level, message, meta) => {
  const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  console[level](`[Startup] ${message}${suffix}`);
};

const splitCsv = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const firstOrigin = (value = "") => splitCsv(value)[0] || "";
const isLocalLikeUrl = (value = "") => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value || ""));

const ensureSafeEnvDefaults = () => {
  if (isManagedRuntime && String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    process.env.NODE_ENV = "production";
  }
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = SAFE_SESSION_SECRET;
    log("warn", "SESSION_SECRET missing, using a safe startup placeholder");
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = SAFE_JWT_SECRET;
    log("warn", "JWT_SECRET missing, using a safe startup placeholder");
  }
  if (!process.env.DB_ENCRYPTION_KEY) {
    process.env.DB_ENCRYPTION_KEY = SAFE_DB_ENCRYPTION_KEY;
    log("warn", "DB_ENCRYPTION_KEY missing, using a safe startup placeholder");
  }
  if (!process.env.BACKEND_PUBLIC_URL && RENDER_EXTERNAL_URL) {
    process.env.BACKEND_PUBLIC_URL = RENDER_EXTERNAL_URL;
  }
  if (isManagedRuntime && isLocalLikeUrl(process.env.BACKEND_PUBLIC_URL || "")) {
    process.env.BACKEND_PUBLIC_URL = RENDER_EXTERNAL_URL || "";
  }
  if (!process.env.APP_BASE_URL && process.env.CORS_ORIGIN) {
    process.env.APP_BASE_URL = firstOrigin(process.env.CORS_ORIGIN);
  }
  if (isManagedRuntime && isLocalLikeUrl(process.env.APP_BASE_URL || "")) {
    process.env.APP_BASE_URL = firstOrigin(process.env.CORS_ORIGIN || "") || process.env.BACKEND_PUBLIC_URL || RENDER_EXTERNAL_URL;
  }
  if (!process.env.CORS_ORIGIN) {
    const cloudSafeOrigin = firstOrigin(process.env.APP_BASE_URL || process.env.BACKEND_PUBLIC_URL || RENDER_EXTERNAL_URL);
    if (cloudSafeOrigin) process.env.CORS_ORIGIN = cloudSafeOrigin;
  }
  if (isManagedRuntime && splitCsv(process.env.CORS_ORIGIN || "").some((origin) => isLocalLikeUrl(origin))) {
    process.env.CORS_ORIGIN = firstOrigin(process.env.APP_BASE_URL || process.env.BACKEND_PUBLIC_URL || RENDER_EXTERNAL_URL);
  }
  if (isManagedRuntime && isLocalLikeUrl(process.env.GOOGLE_REDIRECT_URI || "")) {
    process.env.GOOGLE_REDIRECT_URI = process.env.BACKEND_PUBLIC_URL
      ? `${String(process.env.BACKEND_PUBLIC_URL).replace(/\/+$/, "")}/auth/google/callback`
      : "";
  }
  if (isManagedRuntime && splitCsv(process.env.GOOGLE_AUTHORIZED_ORIGINS || "").some((origin) => isLocalLikeUrl(origin))) {
    process.env.GOOGLE_AUTHORIZED_ORIGINS = firstOrigin(process.env.APP_BASE_URL || process.env.CORS_ORIGIN || process.env.BACKEND_PUBLIC_URL || RENDER_EXTERNAL_URL);
  }
  startupPublicConfig = {
    backendPublicUrl: String(process.env.BACKEND_PUBLIC_URL || RENDER_EXTERNAL_URL || "").trim(),
    appBaseUrl: String(process.env.APP_BASE_URL || "").trim(),
    corsOrigin: String(process.env.CORS_ORIGIN || "").trim(),
    googleRedirectUri: String(process.env.GOOGLE_REDIRECT_URI || "").trim(),
    googleAuthorizedOrigins: splitCsv(process.env.GOOGLE_AUTHORIZED_ORIGINS || process.env.CORS_ORIGIN || process.env.APP_BASE_URL || ""),
  };
};

ensureSafeEnvDefaults();

const clearRetryTimer = () => {
  if (!retryTimer) return;
  clearTimeout(retryTimer);
  retryTimer = null;
};

const clearReconnectTimer = () => {
  if (!mongooseReconnectTimer) return;
  clearTimeout(mongooseReconnectTimer);
  mongooseReconnectTimer = null;
};

const scheduleBootstrapRetry = () => {
  if (retryTimer || fullAppReady) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    bootstrapFullApp().catch((error) => {
      log("error", "Deferred bootstrap retry failed", { error: error instanceof Error ? error.message : String(error) });
      scheduleBootstrapRetry();
    });
  }, STARTUP_RETRY_MS);
  log("warn", "Full backend is in degraded mode, retry scheduled", { retryInMs: STARTUP_RETRY_MS });
};

const derivePublicBaseUrl = (req) => {
  const configured =
    startupPublicConfig.backendPublicUrl ||
    String(process.env.PUBLIC_SERVER_URL || "").trim() ||
    RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
  return "";
};

const buildAuthProvidersPayload = (req) => {
  const baseUrl = derivePublicBaseUrl(req);
  const callbackUrl = baseUrl ? `${baseUrl}/auth/google/callback` : "";
  const startUrl = baseUrl ? `${baseUrl}/auth/google` : "";
  const frontendOrigin =
    firstOrigin(startupPublicConfig.appBaseUrl || "") ||
    firstOrigin(startupPublicConfig.corsOrigin || "") ||
    "";
  const authorizedOrigins = startupPublicConfig.googleAuthorizedOrigins;

  return {
    status: "ok",
    degraded: !fullAppReady,
    google: {
      enabled: Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID || ""),
      clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID || ""),
      backendFlow: true,
      startUrl,
      callbackUrl,
      redirectUri: String(startupPublicConfig.googleRedirectUri || callbackUrl),
      frontendOrigin,
      authorizedOrigins,
    },
  };
};

const degradedApp = express();
degradedApp.disable("x-powered-by");
degradedApp.get("/", (_req, res) => {
  res.type("text/plain").send("Backend Running 🚀");
});
degradedApp.get("/health", (_req, res) => {
  res.json({ status: "ok", degraded: !fullAppReady });
});
degradedApp.get("/api/health", (_req, res) => {
  res.json({ status: "ok", degraded: !fullAppReady });
});
degradedApp.get("/api/auth/providers", (req, res) => {
  res.json(buildAuthProvidersPayload(req));
});
degradedApp.get("/auth/providers", (req, res) => {
  res.json(buildAuthProvidersPayload(req));
});
degradedApp.get("/api/auth/csrf", (_req, res) => {
  res.json({ status: "ok", degraded: !fullAppReady, csrfToken: true });
});
degradedApp.use((_req, res) => {
  res.status(503).json({
    status: "degraded",
    code: "backend_starting",
    message: "Backend is starting in safe mode. Please retry shortly.",
  });
});

activeHandler = degradedApp;

const shellApp = express();
shellApp.disable("x-powered-by");
shellApp.get("/", (_req, res) => {
  res.type("text/plain").send("Backend Running 🚀");
});
shellApp.get("/health", (_req, res) => {
  res.json({ status: "ok", degraded: !fullAppReady });
});
shellApp.get("/api/health", (_req, res) => {
  res.json({ status: "ok", degraded: !fullAppReady });
});
shellApp.get("/api/auth/providers", (req, res) => {
  res.json(buildAuthProvidersPayload(req));
});
shellApp.get("/auth/providers", (req, res) => {
  res.json(buildAuthProvidersPayload(req));
});
shellApp.get("/api/auth/csrf", (_req, res) => {
  res.json({ status: "ok", degraded: !fullAppReady, csrfToken: true });
});
shellApp.use((req, res, next) => {
  try {
    return activeHandler(req, res, next);
  } catch (error) {
    log("error", "Request handler crashed", {
      path: req.originalUrl || req.url,
      error: error instanceof Error ? error.message : String(error),
    });
    return degradedApp(req, res, next);
  }
});

const connectMongoBestEffort = async () => {
  if (!MONGO_URI) {
    log("warn", "DATABASE_URL missing, continuing without MongoDB");
    return;
  }
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  try {
    await Promise.race([
      mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
        connectTimeoutMS: MONGO_CONNECT_TIMEOUT_MS,
        family: 4,
        maxPoolSize: 10,
        autoIndex: true,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Mongo connect timeout after ${MONGO_CONNECT_TIMEOUT_MS}ms`)), MONGO_CONNECT_TIMEOUT_MS)
      ),
    ]);
    clearReconnectTimer();
    log("info", "MongoDB connected", {
      host: mongoose.connection.host || "",
      name: mongoose.connection.name || "",
    });
  } catch (error) {
    log("warn", "MongoDB unavailable, continuing without it", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

mongoose.connection.on("connected", () => {
  clearReconnectTimer();
  log("info", "MongoDB connection established", {
    host: mongoose.connection.host || "",
    name: mongoose.connection.name || "",
  });
});

mongoose.connection.on("error", (error) => {
  log("warn", "MongoDB connection error", { error: error.message });
});

mongoose.connection.on("disconnected", () => {
  log("warn", "MongoDB disconnected");
  if (mongooseReconnectTimer || !MONGO_URI) return;
  mongooseReconnectTimer = setTimeout(() => {
    mongooseReconnectTimer = null;
    connectMongoBestEffort().catch((error) => {
      log("warn", "MongoDB reconnect skipped", { error: error instanceof Error ? error.message : String(error) });
    });
  }, 3000);
});

const bootstrapFullApp = async () => {
  if (bootstrapInFlight || fullAppReady) return;
  bootstrapInFlight = true;
  bootstrapAttempts += 1;
  log("info", "Bootstrapping full backend application", { attempt: bootstrapAttempts, port: PORT });

  try {
    const [{ createApp }, dbModule] = await Promise.all([
      import("./backend/src/app.mjs"),
      import("./backend/src/config/db.mjs"),
    ]);

    closeDb = typeof dbModule.closeDb === "function" ? dbModule.closeDb : closeDb;

    await Promise.allSettled([
      connectMongoBestEffort(),
      typeof dbModule.connectDb === "function"
        ? dbModule.connectDb().catch((error) => {
            log("warn", "Native DB unavailable, continuing without it", {
              error: error instanceof Error ? error.message : String(error),
            });
          })
        : Promise.resolve(),
    ]);

    const fullApp = createApp();
    activeHandler = fullApp;
    fullAppReady = true;
    clearRetryTimer();
    log("info", "Full backend application mounted successfully", { attempt: bootstrapAttempts });
  } catch (error) {
    log("error", "Full backend bootstrap failed, staying in degraded mode", {
      attempt: bootstrapAttempts,
      error: error instanceof Error ? error.message : String(error),
    });
    activeHandler = degradedApp;
    fullAppReady = false;
    scheduleBootstrapRetry();
  } finally {
    bootstrapInFlight = false;
  }
};

const startHttpServer = () => {
  if (httpServer) return httpServer;

  httpServer = shellApp.listen(PORT, HOST, () => {
    log("info", "HTTP server listening", { host: HOST, port: PORT });
  });

  httpServer.on("error", (error) => {
    log("error", "HTTP server error", { error: error instanceof Error ? error.message : String(error) });
  });

  return httpServer;
};

process.on("unhandledRejection", (reason) => {
  log("error", "Unhandled promise rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (error) => {
  log("error", "Uncaught exception", { error: error instanceof Error ? error.message : String(error) });
});

const shutdown = async (signal) => {
  log("info", `${signal} received, shutting down gracefully`);
  clearRetryTimer();
  clearReconnectTimer();
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(() => resolve()));
  }
  await mongoose.connection.close().catch(() => undefined);
  await closeDb().catch(() => undefined);
  process.exit(0);
};

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    log("error", "Shutdown failed", { error: error instanceof Error ? error.message : String(error) });
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    log("error", "Shutdown failed", { error: error instanceof Error ? error.message : String(error) });
    process.exit(0);
  });
});

startHttpServer();
bootstrapFullApp().catch((error) => {
  log("error", "Initial bootstrap invocation failed", { error: error instanceof Error ? error.message : String(error) });
  scheduleBootstrapRetry();
});
