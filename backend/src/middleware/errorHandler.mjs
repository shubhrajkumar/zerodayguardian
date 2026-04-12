import { env } from "../config/env.mjs";
import { classifyAiError } from "../ai-engine/index.mjs";
import { logError } from "../utils/logger.mjs";

const isZodError = (err) => err?.name === "ZodError" && Array.isArray(err?.issues);

const sanitizeStatus = (value) => {
  const status = Number(value || 0);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
};

const errorCode = (err, status) => {
  if (err?.code) return String(err.code).toLowerCase();
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "internal_error";
};

const AI_ERROR_CODES = new Set([
  "timeout",
  "service_busy",
  "rate_limit",
  "circuit_open",
  "auth",
  "env",
  "invalid_model",
  "dns",
  "network",
  "firewall",
  "bad_request",
  "invalid_request",
  "forced_local_fallback",
  "llm_unavailable",
  "upstream",
  "upstream_unclassified",
]);

const aiRequestPath = (req) =>
  /\/api\/(ai|ollama\/chat|neurobot\/chat|neurobot\/llm)/.test(String(req?.originalUrl || req?.path || ""));

const aiHttpStatus = (code, fallbackStatus = 503) => {
  if (code === "bad_request" || code === "invalid_request") return 400;
  if (code === "rate_limit") return 429;
  if (code === "auth" || code === "env" || code === "invalid_model") return 424;
  if (code === "forced_local_fallback") return 200;
  return sanitizeStatus(fallbackStatus >= 500 ? 503 : fallbackStatus || 503);
};

const classifyServerFault = (err) => {
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();
  if (["validationerror", "casterror"].includes(String(err?.name || "").toLowerCase()) || code.includes("validation")) {
    return "validation";
  }
  if (code === "mongodb" || code.startsWith("mongo") || code === "11000" || message.includes("mongo") || message.includes("database")) {
    return "data_access";
  }
  if (code === "fetch_failed" || code.startsWith("upstream") || code === "network" || code === "dns" || message.includes("fetch") || message.includes("upstream")) {
    return "upstream_integration";
  }
  if (message.includes("middleware") || message.includes("csrf") || message.includes("cors")) {
    return "middleware";
  }
  return "application";
};

const buildServerErrorMeta = (req, err, statusCode) => ({
  requestId: req.requestId || "",
  traceId: req.traceId || "",
  route: req.originalUrl || req.path || "",
  method: req.method || "",
  statusCode,
  category: classifyServerFault(err),
});

const buildAiErrorState = (err) => {
  const failure = classifyAiError(err);
  const explicitCode = String(err?.code || "").toLowerCase();
  const code = explicitCode || String(failure.code || "llm_unavailable").toLowerCase();
  const retryAfterSec = Number(err?.retryAfterSec || 0) || null;
  const provider = String(err?.provider || failure.provider || "");
  const providerHint = provider ? ` Provider: ${provider}.` : "";

  if (code === "timeout") {
    return {
      code,
      title: "Temporary response delay",
      detail: `The live model took longer than expected, so Zorvix paused the reply to keep the result reliable.${providerHint}`.trim(),
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Retry in a moment or ask a shorter follow-up.",
      provider,
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 503),
    };
  }
  if (code === "service_busy") {
    return {
      code,
      title: "Live model is syncing",
      detail: "Live providers are syncing right now, so ZORVIX switched to stable local mentor intelligence instead of returning unstable output.",
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Live provider retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Stable mode is active and live mode will resume automatically.",
      provider: "local",
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 503),
    };
  }
  if (code === "rate_limit") {
    return {
      code,
      title: "Provider temporarily unavailable",
      detail: `The AI provider is currently throttling requests, so live generation is temporarily limited.${providerHint}`.trim(),
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Retry in a moment.",
      provider,
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 429),
    };
  }
  if (code === "circuit_open" || code === "forced_local_fallback") {
    return {
      code,
      title: code === "forced_local_fallback" ? "Local fallback mode active" : "All providers temporarily unavailable",
      detail:
        code === "forced_local_fallback"
          ? "Zorvix switched to local fallback mode while the live providers recover."
          : `The configured AI providers are in recovery after recent failures.${providerHint}`.trim(),
      retryable: code !== "forced_local_fallback",
      retryAfterSec,
      retryHint:
        code === "forced_local_fallback"
          ? (retryAfterSec ? `Live provider retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Stable mode is active and live mode will resume automatically.")
          : retryAfterSec
            ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.`
            : "Retry in a moment while providers recover.",
      provider: provider || (code === "forced_local_fallback" ? "local" : ""),
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 503),
    };
  }
  if (code === "auth" || code === "env" || code === "invalid_model") {
    return {
      code,
      title: "AI provider configuration issue",
      detail: `The configured API key, model, or provider endpoint is invalid for live generation.${providerHint}`.trim(),
      retryable: false,
      retryAfterSec: null,
      retryHint: "Check the backend API key, model, and provider configuration.",
      provider,
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 424),
    };
  }
  if (["dns", "network", "firewall"].includes(code)) {
    return {
      code,
      title: "Provider network issue",
      detail: `Zorvix could not reach the AI provider over the network path.${providerHint}`.trim(),
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Retry in a moment.",
      provider,
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 503),
    };
  }
  if (code === "bad_request" || code === "invalid_request") {
    return {
      code,
      title: "Invalid request",
      detail: "The request payload was rejected before generation could begin.",
      retryable: false,
      retryAfterSec: null,
      retryHint: "Adjust the request payload and try again.",
      provider,
      statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 400),
    };
  }
  return {
    code,
    title: "Provider temporarily unavailable",
    detail: `The AI provider could not complete this request right now.${providerHint}`.trim(),
    retryable: true,
    retryAfterSec,
    retryHint: retryAfterSec ? `Retry in about ${Math.max(1, Math.ceil(retryAfterSec))}s.` : "Retry in a moment.",
    provider,
    statusCode: aiHttpStatus(code, failure.statusCode || err?.statusCode || err?.status || 503),
  };
};

export const errorHandler = (err, req, res, _next) => {
  void _next;
  if (res.headersSent) return;
  if (isZodError(err)) {
    res.status(400).json({
      status: "error",
      error: "Invalid request",
      message: "Request validation failed",
      code: "invalid_request",
      details: err.issues.map((issue) => ({
        path: issue.path?.join?.(".") || "request",
        message: issue.message,
        code: issue.code,
      })),
      requestId: req.requestId || "",
      traceId: req.traceId || "",
    });
    return;
  }

  if (Number(err?.code) === 11000) {
    res.status(400).json({
      status: "error",
      error: "Duplicate value",
      message: "A record with the provided unique field already exists.",
      code: "duplicate_key",
      requestId: req.requestId || "",
      traceId: req.traceId || "",
    });
    return;
  }

  const malformedJson = err?.type === "entity.parse.failed" || /json/i.test(String(err?.message || ""));
  const fileTooLarge = String(err?.code || "").toUpperCase() === "LIMIT_FILE_SIZE";
  const payloadTooLarge =
    fileTooLarge || err?.type === "entity.too.large" || Number(err?.status || err?.statusCode || 0) === 413;
  const safeStatus = payloadTooLarge ? 413 : malformedJson ? 400 : sanitizeStatus(err?.status || err?.statusCode || 500);
  const code = payloadTooLarge ? "payload_too_large" : malformedJson ? "invalid_json" : errorCode(err, safeStatus);
  const corsBlocked = String(err?.code || "").toLowerCase() === "cors_blocked";
  const requestId = req.requestId || "";
  const traceId = req.traceId || "";
  const classifiedAiFailure = classifyAiError(err);
  const explicitCode = String(err?.code || "").toLowerCase();
  const aiLike =
    !malformedJson &&
    !corsBlocked &&
    (Boolean(err?.provider) ||
      AI_ERROR_CODES.has(explicitCode) ||
      (aiRequestPath(req) &&
        classifiedAiFailure.code &&
        (AI_ERROR_CODES.has(String(classifiedAiFailure.code).toLowerCase()) ||
          String(classifiedAiFailure.code || "").startsWith("upstream_"))));

  logError("Request failed", err, {
    requestId,
    traceId,
    method: req.method,
    path: req.originalUrl || req.path,
    status: safeStatus,
    code,
    ip: req.ip,
  });

  if (payloadTooLarge) {
    res.status(413).json({
      status: "error",
      error: "Payload too large",
      message: "Attachment too large. Max size is 25MB.",
      code: "payload_too_large",
      requestId,
      traceId,
    });
    return;
  }

  if (corsBlocked) {
    res.status(403).json({
      status: "error",
      error: "CORS blocked",
      message: "Origin not allowed. Add this origin to CORS_ORIGIN in the backend .env and restart the server.",
      code: "cors_blocked",
      requestId,
      traceId,
    });
    return;
  }

  if (aiLike) {
    const llmError = buildAiErrorState(err);
    if (llmError.retryAfterSec) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil(llmError.retryAfterSec))));
    }
    res.status(llmError.statusCode || 503).json({
      status: "error",
      error: llmError.title,
      message: llmError.detail,
      code: llmError.code,
      requestId,
      traceId,
      retryAfterSec: llmError.retryAfterSec,
      retryable: llmError.retryable,
      llmError,
      fallback: "Zorvix is in resilient reply mode while the live AI providers recover.",
    });
    return;
  }

  const retryAfterSec = Number(err?.retryAfterSec || 0) || null;
  if (retryAfterSec) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterSec))));
  }
  const meta = buildServerErrorMeta(req, err, safeStatus);
  const message =
    safeStatus >= 500
      ? "Internal server error"
      : payloadTooLarge
        ? "Payload too large. Please upload a smaller file (max 25MB)."
        : malformedJson
          ? "Invalid JSON payload"
          : String(err?.message || "Request failed");

  res.status(safeStatus).json({
    status: "error",
    error: message,
    code,
    message,
    ...meta,
    retryAfterSec: retryAfterSec || undefined,
    fallback:
      "### Temporary Service Issue\n\nZorvix is experiencing a temporary issue. Please retry shortly.",
    ...(env.nodeEnv !== "production"
      ? {
          debug: {
            message: String(err?.message || err),
            stack: String(err?.stack || "")
              .split("\n")
              .slice(0, 8),
          },
        }
      : {}),
  });
};
