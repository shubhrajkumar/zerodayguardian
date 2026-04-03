import { randomUUID } from "node:crypto";
import { trace } from "@opentelemetry/api";
import { incMetric, observeMetric } from "../observability/telemetry.mjs";
import { logWarn } from "../utils/logger.mjs";

export const requestContext = (req, res, next) => {
  const requestId = String(req.headers["x-request-id"] || randomUUID());
  const started = Date.now();
  req.requestId = requestId;
  const activeContext = typeof trace?.active === "function" ? trace.active() : undefined;
  const activeSpan = activeContext ? trace.getSpan(activeContext) : null;
  const traceId = activeSpan?.spanContext()?.traceId || "";
  req.traceId = traceId;
  res.setHeader("X-Request-Id", requestId);
  if (traceId) res.setHeader("X-Trace-Id", traceId);

  res.on("finish", () => {
    const duration = Date.now() - started;
    const path = req.path;
    incMetric("neurobot_http_requests_total", 1, {
      method: req.method,
      path,
      status: res.statusCode,
    });
    observeMetric("neurobot_http_request_duration_ms", duration, {
      method: req.method,
      path,
    });
    if (res.statusCode >= 500 || duration >= 2000) {
      logWarn("HTTP request completed with elevated risk", {
        requestId,
        traceId,
        method: req.method,
        path: req.originalUrl || path,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip,
      });
    }
  });

  next();
};
