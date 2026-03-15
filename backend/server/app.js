import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import routes from "./routes/index.js";
import { env } from "../src/config/env.mjs";
import { optionalAuth } from "../src/middleware/auth.mjs";
import {
  authRateLimit,
  chatRateLimit,
  intelligenceRateLimit,
  livezRateLimit,
  neurobotRateLimit,
  readyzRateLimit,
} from "../src/middleware/rateLimit.mjs";
import { errorHandler } from "../src/middleware/errorHandler.mjs";
import neurobotRoutes from "../src/routes/neurobotRoutes.mjs";
import authRoutes from "../src/routes/authRoutes.mjs";
import intelligenceRoutes from "../src/routes/intelligenceRoutes.mjs";
import { createSessionId, decryptSessionToken, encryptSessionToken } from "../src/utils/security.mjs";
import { chatAbuseDetection } from "../src/middleware/abuseDetection.mjs";
import { allowProbeAccess } from "../src/middleware/probeAccess.mjs";
import { allowOpsAccess } from "../src/middleware/opsAccess.mjs";
import { getLiveness, getReadiness } from "../src/services/probeService.mjs";
import { issueCsrfToken, requireCsrf } from "../src/middleware/csrf.mjs";
import { requestContext } from "../src/middleware/requestContext.mjs";
import { auditLog } from "../src/middleware/auditLog.mjs";
import { incMetric, renderPrometheusMetrics } from "../src/observability/telemetry.mjs";
import { getLlmRoutingSnapshot, runLlmSelfDiagnosis, validateLlmStartupConfig } from "../src/services/llmService.mjs";
import { logWarn } from "../src/utils/logger.mjs";
import { requestLogger } from "./middleware/requestLogger.js";

const COOKIE_NAME = "neurobot_ss";
const ONE_WEEK = 60 * 60 * 24 * 7;
let lastChatbotHealthStatus = "unknown";

const setProbeNoStore = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

const allowCorsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if ((env.corsOrigins || []).includes(origin)) return callback(null, true);
  const error = new Error(`CORS blocked for origin ${origin}`);
  error.status = 403;
  error.code = "cors_blocked";
  callback(error);
};

const listRoutes = (app) => {
  const result = [];
  const stack = app?._router?.stack || [];
  for (const layer of stack) {
    if (layer?.route?.path) {
      result.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase()),
      });
      continue;
    }
    if (layer?.name === "router" && Array.isArray(layer?.handle?.stack)) {
      for (const subLayer of layer.handle.stack) {
        if (!subLayer?.route?.path) continue;
        result.push({
          path: subLayer.route.path,
          methods: Object.keys(subLayer.route.methods || {}).map((m) => m.toUpperCase()),
        });
      }
    }
  }
  return result;
};

const isChatStreamAvailable = (app) => listRoutes(app).some((route) => String(route.path || "").includes("/chat/stream"));

const deriveLlmReady = async () => {
  try {
    const snapshot = await getLlmRoutingSnapshot();
    return Object.values(snapshot || {}).some((entry) => String(entry?.circuit?.state || "").toLowerCase() !== "open");
  } catch {
    return false;
  }
};

export const createServerApp = () => {
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
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(auditLog);
  app.use(requestLogger);
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
  app.use(express.urlencoded({ extended: false, limit: "25mb" }));
  app.use(issueCsrfToken);

  app.use((req, res, next) => {
    const encrypted = req.cookies[COOKIE_NAME];
    const decrypted = encrypted ? decryptSessionToken(encrypted) : null;
    if (decrypted) {
      req.neurobotSessionId = decrypted;
      return next();
    }
    const sessionId = createSessionId();
    req.neurobotSessionId = sessionId;
    res.cookie(COOKIE_NAME, encryptSessionToken(sessionId), {
      httpOnly: true,
      sameSite: env.nodeEnv === "production" ? "strict" : "lax",
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

  app.get("/api", (req, res) => {
    res.json({
      status: "ok",
      message: "API online",
      requestId: req.requestId,
      ts: new Date().toISOString(),
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

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
  });

  app.get("/api/health/chatbot", async (req, res) => {
    const startedAt = Date.now();
    const websocket = isChatStreamAvailable(app);
    const llmReady = await deriveLlmReady();
    const latency = Math.max(0, Date.now() - startedAt);
    const status = websocket ? "ok" : "down";
    const model = status === "ok" ? "active" : "down";

    if (status === "down" && lastChatbotHealthStatus !== "down") {
      incMetric("chat_recovery_enter_total", 1, { source: "health_transition" });
    }
    if (status === "ok" && lastChatbotHealthStatus === "down") {
      incMetric("chat_recovery_restore_total", 1, { source: "health_transition" });
    }
    lastChatbotHealthStatus = status;

    if (status !== "ok") {
      logWarn("Chatbot health degraded", {
        requestId: req.requestId,
        websocket,
        llmReady,
        latency,
      });
    }

    res.status(status === "ok" ? 200 : 503).json({
      status,
      latency,
      model,
      websocket,
      llm_ready: llmReady,
    });
  });

  app.get("/api/ai/health", setProbeNoStore, async (req, res, next) => {
    try {
      let configOk = true;
      let configIssues = [];
      try {
        validateLlmStartupConfig();
      } catch (error) {
        configOk = false;
        configIssues = Array.isArray(error?.issues) ? error.issues : [{ code: "llm_config_invalid", severity: "error" }];
      }
      const diagnostics = await runLlmSelfDiagnosis({
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
    const routeList = listRoutes(app);
    res.json({ status: "ok", count: routeList.length, routes: routeList });
  });

  app.get("/api/neurobot/llm/status", setProbeNoStore, allowOpsAccess, async (_req, res, next) => {
    try {
      const snapshot = await getLlmRoutingSnapshot();
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
        providers: snapshot,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/neurobot/llm/diagnostics", setProbeNoStore, allowOpsAccess, async (req, res, next) => {
    try {
      const timeoutMs = Math.max(800, Math.min(6000, Number(req.query.timeoutMs || 2200)));
      const diagnostics = await runLlmSelfDiagnosis({ timeoutMs });
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

  app.get("/api/readyz", setProbeNoStore, readyzRateLimit, allowProbeAccess({ allowSecret: true }), async (_req, res) => {
    try {
      const { http, payload } = await getReadiness();
      res.status(http).json(payload);
    } catch {
      res.status(503).json({ status: "not_ready", db: "down", llm: "down", responseTime: 0 });
    }
  });

  app.use(routes);

  app.use("/api/auth", requireCsrf, authRateLimit, authRoutes);
  app.use("/api/neurobot/chat", chatRateLimit, chatAbuseDetection);
  app.use("/api/neurobot", requireCsrf, neurobotRateLimit, neurobotRoutes);
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
