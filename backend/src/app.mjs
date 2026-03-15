import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import { env } from "./config/env.mjs";
import { optionalAuth } from "./middleware/auth.mjs";
import {
  chatRateLimit,
  intelligenceRateLimit,
  livezRateLimit,
  neurobotRateLimit,
  readyzRateLimit,
} from "./middleware/rateLimit.mjs";
import { errorHandler } from "./middleware/errorHandler.mjs";
import neurobotRoutes from "../api/ai/neurobotRoutes.mjs";
import authRoutes from "../api/auth/authRoutes.mjs";
import intelligenceRoutes from "../api/tools/intelligenceRoutes.mjs";
import fileRoutes from "../api/files/fileRoutes.mjs";
import { createSessionId, decryptSessionToken, encryptSessionToken } from "./utils/security.mjs";
import { chatAbuseDetection } from "./middleware/abuseDetection.mjs";
import { allowProbeAccess } from "./middleware/probeAccess.mjs";
import { allowOpsAccess } from "./middleware/opsAccess.mjs";
import { getLiveness, getReadiness } from "./services/probeService.mjs";
import { issueCsrfToken, requireCsrf } from "./middleware/csrf.mjs";
import { requestContext } from "./middleware/requestContext.mjs";
import { sanitizeInput } from "./middleware/sanitizeInput.mjs";
import { auditLog } from "./middleware/auditLog.mjs";
import { incMetric, renderPrometheusMetrics } from "./observability/telemetry.mjs";
import { getAiRoutingSnapshot, runAiSelfDiagnosis, validateAiStartupConfig } from "./ai-engine/index.mjs";
import { logWarn } from "./utils/logger.mjs";

const COOKIE_NAME = "neurobot_ss";
const ONE_WEEK = 60 * 60 * 24 * 7;
const setProbeNoStore = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};
const allowCorsOrigin = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }
  if ((env.corsOrigins || []).includes(origin)) {
    callback(null, true);
    return;
  }
  const error = new Error(`CORS blocked for origin ${origin}`);
  error.status = 403;
  error.code = "cors_blocked";
  callback(error);
};
const listRoutes = (app) => {
  const routes = [];
  const stack = app?._router?.stack || [];
  for (const layer of stack) {
    if (layer?.route?.path) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase()),
      });
      continue;
    }
    if (layer?.name === "router" && Array.isArray(layer?.handle?.stack)) {
      for (const subLayer of layer.handle.stack) {
        if (!subLayer?.route?.path) continue;
        routes.push({
          path: subLayer.route.path,
          methods: Object.keys(subLayer.route.methods || {}).map((m) => m.toUpperCase()),
        });
      }
    }
  }
  return routes;
};

const isChatStreamAvailable = (app) => listRoutes(app).some((route) => String(route.path || "").includes("/chat/stream"));
let lastChatbotHealthStatus = "unknown";
const CHATBOT_HEALTH_CACHE_MS = 5000;
const CHATBOT_HEALTH_TIMEOUT_MS = Math.max(
  1500,
  Math.min(5000, Number(env.llmMaxLatencyMs || env.llmCriticalTimeoutMs || 2200))
);
let chatbotHealthProbeInFlight = null;
let chatbotHealthCache = {
  expiresAt: 0,
  payload: {
    ready: false,
    rootCause: "unknown",
    provider: "",
    retryAfterSec: 0,
    generatedAt: null,
  },
};

const readChatbotLlmHealth = async () => {
  const now = Date.now();
  if (chatbotHealthCache.expiresAt > now) return chatbotHealthCache.payload;
  if (chatbotHealthProbeInFlight) return chatbotHealthProbeInFlight;

  chatbotHealthProbeInFlight = (async () => {
    try {
      const diagnostics = await runAiSelfDiagnosis({ timeoutMs: CHATBOT_HEALTH_TIMEOUT_MS });
      const payload = {
        ready: diagnostics.rootCause?.ok === true,
        rootCause: String(diagnostics.rootCause?.code || (diagnostics.rootCause?.ok ? "none" : "unknown")),
        provider: String(diagnostics.rootCause?.provider || ""),
        retryAfterSec: Number(diagnostics.rootCause?.retryAfterSec || 0) || 0,
        generatedAt: String(diagnostics.generatedAt || new Date().toISOString()),
      };
      chatbotHealthCache = {
        expiresAt: Date.now() + CHATBOT_HEALTH_CACHE_MS,
        payload,
      };
      return payload;
    } catch {
      const payload = {
        ready: false,
        rootCause: "health_probe_failed",
        provider: "",
        retryAfterSec: 0,
        generatedAt: new Date().toISOString(),
      };
      chatbotHealthCache = {
        expiresAt: Date.now() + CHATBOT_HEALTH_CACHE_MS,
        payload,
      };
      return payload;
    } finally {
      chatbotHealthProbeInFlight = null;
    }
  })();

  return chatbotHealthProbeInFlight;
};

export const createApp = () => {
  const app = express();

  if (env.trustProxy) app.set("trust proxy", 1);
  if (env.nodeEnv === "production") {
    app.use((req, res, next) => {
      const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "");
      if (proto.includes("https")) return next();
      const host = String(req.headers.host || "");
      const target = `https://${host}${req.originalUrl || "/"}`;
      res.status(426).json({ error: "HTTPS required", target });
    });
  }

  app.use(
    cors({
      origin: allowCorsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "Last-Event-ID", "X-Request-Id"],
      maxAge: 600,
    })
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(cookieParser());
  app.use(requestContext);
  app.use(auditLog);
  app.use(
    compression({
      filter: (req, res) => {
        const contentType = String(res.getHeader("Content-Type") || "");
        if (contentType.includes("text/event-stream")) return false;
        if (req.path.endsWith("/chat/stream")) return false;
        return compression.filter(req, res);
      },
    })
  );
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));
  app.use(issueCsrfToken);
  app.use(sanitizeInput);

  app.use((req, res, next) => {
    const encrypted = req.cookies[COOKIE_NAME];
    const decrypted = encrypted ? decryptSessionToken(encrypted) : null;

    if (decrypted) {
      req.neurobotSessionId = decrypted;
      next();
      return;
    }

    const sessionId = createSessionId();
    const secureToken = encryptSessionToken(sessionId);
    req.neurobotSessionId = sessionId;
    res.cookie(COOKIE_NAME, secureToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: env.nodeEnv === "production",
      maxAge: ONE_WEEK * 1000,
    });
    next();
  });

  app.use(optionalAuth);
  app.get("/", (req, res) => {
    res.json({
      status: "ok",
      service: "neurobot-backend",
      message: "NeuroBot backend online",
      requestId: req.requestId,
      ts: new Date().toISOString(),
      endpoints: {
        health: "/api/health",
        ping: "/api/ping",
        test: "/api/test",
        readyz: "/api/readyz",
        livez: "/api/livez",
      },
    });
  });
  app.get("/health", (req, res) =>
    res.json({ status: "ok", service: "neurobot-backend", requestId: req.requestId, ts: new Date().toISOString() })
  );
  app.get("/healthz", (req, res) =>
    res.json({ status: "ok", service: "neurobot-backend", requestId: req.requestId, ts: new Date().toISOString() })
  );
  app.get("/api", (req, res) => {
    res.json({
      status: "ok",
      message: "API online",
      requestId: req.requestId,
      ts: new Date().toISOString(),
    });
  });
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/health/chatbot", async (req, res) => {
    const startedAt = Date.now();
    const websocket = isChatStreamAvailable(app);
    const llmHealth = await readChatbotLlmHealth();
    const localFallbackActive = env.forceLocalFallback === true;
    const llmReady = llmHealth.ready && !localFallbackActive;
    const latency = Math.max(0, Date.now() - startedAt);
    const status = !websocket ? "down" : llmReady ? "ok" : "degraded";
    const httpStatus = status === "down" ? 503 : 200;
    const model = status === "ok" ? "active" : "down";
    if (status !== "ok" && lastChatbotHealthStatus === "ok") {
      incMetric("chat_recovery_enter_total", 1, { source: "health_transition" });
    }
    if (status === "ok" && lastChatbotHealthStatus !== "ok" && lastChatbotHealthStatus !== "unknown") {
      incMetric("chat_recovery_restore_total", 1, { source: "health_transition" });
    }
    lastChatbotHealthStatus = status;
    if (status !== "ok") {
      logWarn("Chatbot health degraded", {
        requestId: req.requestId,
        websocket,
        llmReady,
        rootCause: localFallbackActive ? "forced_local_fallback" : llmHealth.rootCause,
        provider: localFallbackActive ? "local" : llmHealth.provider,
        latency,
      });
    }
    res.status(httpStatus).json({
      status,
      latency,
      model,
      websocket,
      llm_ready: llmReady,
      reason: localFallbackActive ? "forced_local_fallback" : llmHealth.rootCause,
      provider: localFallbackActive ? "local" : llmHealth.provider,
      retryAfterSec: llmHealth.retryAfterSec,
      generatedAt: llmHealth.generatedAt,
    });
  });
  app.get("/api/ping", (req, res) => {
    res.json({
      status: "ok",
      message: "pong",
      origin: String(req.headers.origin || ""),
      requestId: req.requestId,
      ts: new Date().toISOString(),
    });
  });
  app.options("/api/ping", (_req, res) => {
    res.sendStatus(204);
  });
  app.get("/api/test", (req, res) => {
    res.json({
      status: "ok",
      message: "backend routing and middleware test successful",
      requestId: req.requestId,
      traceId: req.traceId || "",
      cors: {
        origin: String(req.headers.origin || ""),
        allowedOrigins: env.corsOrigins,
      },
      parser: {
        json: true,
        urlencoded: true,
      },
      ts: new Date().toISOString(),
    });
  });
  app.post("/api/test/echo", (req, res) => {
    res.json({
      status: "ok",
      requestId: req.requestId,
      body: req.body ?? null,
      ts: new Date().toISOString(),
    });
  });
  app.get("/api/ai/health", setProbeNoStore, async (req, res, next) => {
    try {
      let configOk = true;
      let configIssues = [];
      try {
        validateAiStartupConfig();
      } catch (error) {
        configOk = false;
        configIssues = Array.isArray(error?.issues) ? error.issues : [{ code: "llm_config_invalid", severity: "error" }];
      }
      const diagnostics = await runAiSelfDiagnosis({
        timeoutMs: Math.max(1500, Math.min(30000, Number(req.query.timeoutMs || env.llmCriticalTimeoutMs))),
      });
      const healthy = configOk && diagnostics.rootCause?.ok === true;
      res.status(healthy ? 200 : 503).json({
        status: healthy ? "ok" : "degraded",
        requestId: req.requestId,
        configOk,
        configIssues,
        diagnostics,
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/routes", setProbeNoStore, allowOpsAccess, (_req, res) => {
    const routes = listRoutes(app);
    res.json({
      status: "ok",
      count: routes.length,
      routes,
    });
  });
  app.get("/api/neurobot/llm/status", setProbeNoStore, allowOpsAccess, async (_req, res, next) => {
    try {
      const snapshot = await getAiRoutingSnapshot();
      const providers = snapshot?.providers || snapshot;
      const queue = snapshot?.queue || null;
      res.json({
        status: "ok",
        generatedAt: new Date().toISOString(),
        routing: {
          mode: env.routingMode,
          llmMode: env.llmMode,
          primary: env.primaryProvider,
          fallback: env.fallbackProvider,
          priority: env.providerPriority,
        },
        providers,
        queue,
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/neurobot/llm/diagnostics", setProbeNoStore, allowOpsAccess, async (req, res, next) => {
    try {
      const timeoutMs = Math.max(800, Math.min(6000, Number(req.query.timeoutMs || 2200)));
      const diagnostics = await runAiSelfDiagnosis({ timeoutMs });
      res.status(diagnostics.rootCause.ok ? 200 : 503).json({
        status: diagnostics.rootCause.ok ? "ok" : "degraded",
        ...diagnostics,
      });
    } catch (error) {
      next(error);
    }
  });
  app.get("/api/metrics", setProbeNoStore, allowProbeAccess({ allowSecret: true }), (_req, res) => {
    res.type("text/plain").send(renderPrometheusMetrics());
  });
  app.get("/api/livez", setProbeNoStore, livezRateLimit, allowProbeAccess({ allowSecret: true }), async (_req, res) => {
    try {
      const { http, payload } = await getLiveness();
      res.status(http).json(payload);
    } catch {
      res.status(500).json({ status: "fatal", uptime: Math.floor(process.uptime()) });
    }
  });
  app.get(
    "/api/readyz",
    setProbeNoStore,
    readyzRateLimit,
    allowProbeAccess({ allowSecret: true }),
    async (_req, res) => {
    try {
      const { http, payload } = await getReadiness();
      res.status(http).json(payload);
    } catch {
      res.status(503).json({ status: "not_ready", db: "down", llm: "down", responseTime: 0 });
    }
    }
  );
  app.use("/api/auth", requireCsrf, authRoutes);
  app.use("/api/neurobot/chat", chatRateLimit, chatAbuseDetection);
  app.use("/api/neurobot", requireCsrf, neurobotRateLimit, neurobotRoutes);
  app.use("/api/files", requireCsrf, fileRoutes);
  app.use("/api/intelligence", requireCsrf, intelligenceRateLimit, intelligenceRoutes);
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: "API route not found",
      code: "api_not_found",
      requestId: req.requestId,
      path: req.originalUrl,
    });
  });
  app.use((req, res) => {
    res.status(404).json({
      error: "Route not found",
      code: "route_not_found",
      requestId: req.requestId,
      path: req.originalUrl,
    });
  });
  app.use(errorHandler);

  return app;
};
