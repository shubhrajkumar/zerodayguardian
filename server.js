import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(moduleDir, ".env"),
  path.resolve(moduleDir, "backend", ".env"),
  path.resolve(moduleDir, ".env.local"),
  path.resolve(moduleDir, "backend", ".env.local"),
];
for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, override: true });
}

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
const resolvedNodeEnv = String(process.env.NODE_ENV || (isManagedRuntime ? "production" : "development")).trim().toLowerCase() || "development";
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
const isLocalLikeOrigin = (value = "") => /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(:\d+)?$/i.test(String(value || "").trim());
const normalizeOrigin = (value = "") => {
  try {
    return new URL(String(value || "").trim()).origin.toLowerCase();
  } catch {
    return "";
  }
};
const normalizeCookieDomain = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw.replace(/^\.+/, "").replace(/\/.*$/, "").replace(/:\d+$/, "").toLowerCase();
  }
};
const mergeOrigins = (...items) =>
  [...new Set(
    items
      .flatMap((value) => {
        if (Array.isArray(value)) return value;
        return splitCsv(value);
      })
      .filter(Boolean)
  )];

const ensureSafeEnvDefaults = () => {
  if (isManagedRuntime && String(process.env.NODE_ENV || "").trim().toLowerCase() !== "production") {
    process.env.NODE_ENV = "production";
  }
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = resolvedNodeEnv;
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
    corsOrigin: mergeOrigins(process.env.CORS_ORIGIN || "", process.env.APP_BASE_URL || "").join(","),
    googleRedirectUri: String(process.env.GOOGLE_REDIRECT_URI || "").trim(),
    googleAuthorizedOrigins: mergeOrigins(
      process.env.GOOGLE_AUTHORIZED_ORIGINS || "",
      process.env.CORS_ORIGIN || "",
      process.env.APP_BASE_URL || ""
    ),
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

const buildPublicAuthPath = (req, suffix = "") => {
  const currentPath = String(req.originalUrl || req.url || "");
  const useApiPrefix = currentPath.startsWith("/api/auth");
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${useApiPrefix ? "/api/auth" : "/auth"}${normalizedSuffix}`;
};

const buildAuthProvidersPayload = (req) => {
  const googleClientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
  const frontendOrigin =
    firstOrigin(startupPublicConfig.appBaseUrl || "") ||
    firstOrigin(startupPublicConfig.corsOrigin || "") ||
    "";
  const authorizedOrigins = startupPublicConfig.googleAuthorizedOrigins;

  return {
    status: "ok",
    degraded: !fullAppReady,
    google: {
      enabled: Boolean(googleClientId),
      clientId: googleClientId,
      backendFlow: false,
      popupFlow: true,
      startUrl: "",
      callbackUrl: "",
      redirectUri: "",
      frontendOrigin,
      authorizedOrigins,
    },
  };
};

const appendVaryHeader = (res, value) => {
  const current = String(res.getHeader("Vary") || "").trim();
  if (!current) {
    res.setHeader("Vary", value);
    return;
  }
  const parts = current.split(",").map((entry) => entry.trim().toLowerCase());
  if (!parts.includes(String(value).toLowerCase())) {
    res.setHeader("Vary", `${current}, ${value}`);
  }
};

const allowedShellOrigins = () =>
  mergeOrigins(startupPublicConfig.corsOrigin || "", startupPublicConfig.appBaseUrl || "")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
    .filter((origin) => resolvedNodeEnv === "production" ? !isLocalLikeOrigin(origin) : true);

const applyShellCors = (req, res) => {
  const origin = normalizeOrigin(req.headers.origin || "");
  if (!origin) return true;
  appendVaryHeader(res, "Origin");
  const allowedOrigins = allowedShellOrigins();
  const allowImplicitLocalOrigin =
    resolvedNodeEnv !== "production" &&
    !allowedOrigins.length &&
    isLocalLikeOrigin(origin);
  if (!allowImplicitLocalOrigin && !allowedOrigins.includes(origin)) {
    res.status(403).json({
      status: "error",
      code: "cors_blocked",
      message: "Origin not allowed.",
    });
    return false;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token, X-Request-Id, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  return true;
};

const shellCorsMiddleware = (req, res, next) => {
  if (!applyShellCors(req, res)) return;
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

const shellHttpsMiddleware = (req, res, next) => {
  if (String(process.env.NODE_ENV || resolvedNodeEnv).trim().toLowerCase() !== "production") {
    next();
    return;
  }
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "").trim().toLowerCase();
  if (proto.includes("https")) {
    next();
    return;
  }
  const host = String(req.headers.host || "");
  res.status(426).json({ error: "HTTPS required", target: host ? `https://${host}${req.originalUrl || "/"}` : "" });
};

const readCookieValue = (req, name) => {
  const encodedName = `${String(name || "").trim()}=`;
  const rawCookie = String(req.headers?.cookie || "");
  if (!rawCookie || !encodedName.trim()) return "";
  const match = rawCookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(encodedName));
  if (!match) return "";
  return decodeURIComponent(match.slice(encodedName.length));
};

const buildShellCookieOptions = (req, overrides = {}) => {
  const frontendOrigin = normalizeOrigin(startupPublicConfig.appBaseUrl || firstOrigin(startupPublicConfig.corsOrigin));
  const backendOrigin = normalizeOrigin(startupPublicConfig.backendPublicUrl || derivePublicBaseUrl(req));
  const usesCrossSiteCookies = Boolean(frontendOrigin && backendOrigin && frontendOrigin !== backendOrigin);
  const cookieDomain = normalizeCookieDomain(process.env.COOKIE_DOMAIN || startupPublicConfig.backendPublicUrl || derivePublicBaseUrl(req));
  const isProduction = String(process.env.NODE_ENV || resolvedNodeEnv).trim().toLowerCase() === "production";
  const secure = usesCrossSiteCookies || isProduction;

  return {
    path: "/",
    secure,
    sameSite: usesCrossSiteCookies ? "none" : secure ? "strict" : "lax",
    ...(cookieDomain && !isLocalLikeUrl(cookieDomain) ? { domain: cookieDomain } : {}),
    ...overrides,
  };
};

const issueShellCsrfToken = (req, res) => {
  try {
    const existingToken = readCookieValue(req, "neurobot_csrf");
    const csrfToken = existingToken && existingToken.length > 8 ? existingToken : randomUUID();
    res.cookie("neurobot_csrf", csrfToken, buildShellCookieOptions(req, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    }));
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", degraded: !fullAppReady, csrfToken });
  } catch (error) {
    console.error("Failed to issue shell CSRF token", error);
    res.status(500).json({
      status: "error",
      code: "csrf_issue",
      message: "Unable to issue CSRF token.",
    });
  }
};

const degradedApp = express();
degradedApp.disable("x-powered-by");
degradedApp.use(shellHttpsMiddleware);
degradedApp.use(shellCorsMiddleware);
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
degradedApp.get("/api/auth/csrf", (req, res) => {
  issueShellCsrfToken(req, res);
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
shellApp.use(shellHttpsMiddleware);
shellApp.use(shellCorsMiddleware);
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
shellApp.get("/api/auth/csrf", (req, res) => {
  issueShellCsrfToken(req, res);
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
  if (fullAppReady) return;
  if (bootstrapInFlight) return;
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
