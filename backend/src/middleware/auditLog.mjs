import { recordSecurityEvent } from "../services/memoryService.mjs";

const safe = (value = "", max = 200) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

export const auditLog = (req, _res, next) => {
  const started = Date.now();
  const { method } = req;
  const path = String(req.originalUrl || req.path || "").slice(0, 240);
  const actor = {
    userId: req.user?.sub ?? null,
    sessionId: req.neurobotSessionId,
  };

  const after = async () => {
    const durationMs = Math.max(0, Date.now() - started);
    await recordSecurityEvent({
      ...actor,
      action: "api_request",
      detail: `${safe(method)} ${safe(path)} ${durationMs}ms`,
      metadata: {
        method,
        path,
        status: _res.statusCode,
        durationMs,
        ip: req.ip,
      },
    });
  };

  _res.on("finish", () => {
    after().catch(() => undefined);
  });

  next();
};
