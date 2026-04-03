import { env } from "../config/env.mjs";

const normalizeIp = (ip = "") => ip.replace("::ffff:", "");

const isInternalIp = (ip = "") => {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  if (normalized === "::1" || normalized === "localhost") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("10.") || normalized.startsWith("127.") || normalized.startsWith("192.168.")) {
    return true;
  }
  const parts = normalized.split(".");
  if (parts.length === 4) {
    const first = Number(parts[0]);
    const second = Number(parts[1]);
    if (first === 172 && second >= 16 && second <= 31) return true;
  }
  return false;
};

export const allowProbeAccess =
  ({ allowSecret = false } = {}) =>
  (req, res, next) => {
    const ipAllowed = isInternalIp(req.ip);
    const secret = req.headers["x-healthcheck-secret"];
    const secretAllowed =
      allowSecret &&
      typeof secret === "string" &&
      !!env.healthcheckSecret &&
      secret.length > 0 &&
      secret === env.healthcheckSecret;

    if (ipAllowed || secretAllowed) {
      next();
      return;
    }

    res.status(403).json({ error: "Forbidden" });
  };

