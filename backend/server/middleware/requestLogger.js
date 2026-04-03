import { logError, logInfo } from "../../src/utils/logger.mjs";

export const requestLogger = (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    logInfo("HTTP request", {
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs,
      requestId: req.requestId || "",
      traceId: req.traceId || "",
    });
  });
  res.on("error", (error) => {
    logError("HTTP response stream error", error, {
      method: req.method,
      path: req.originalUrl || req.path,
      requestId: req.requestId || "",
    });
  });
  next();
};
