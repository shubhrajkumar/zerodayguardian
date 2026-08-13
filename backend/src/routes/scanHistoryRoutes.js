import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  DEFAULT_PORTS,
  PORT_GROUPS,
  isBlockedHost,
  isPrivateIp,
  resolveHost,
  scanWithConcurrency,
} from "./portScanRoutes.js";
import { getDb } from "../config/db.mjs";

const router = Router();

const SCANS_COLLECTION = "scans";

// Per-user rate limit: max 5 port scans per minute
const portScanRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?.sub || req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      code: "portscan_rate_limited",
      error: "Too many port scans. Please wait and retry.",
    });
  },
});

const cleanTarget = (target) =>
  String(target || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\s/g, "");

const buildPortList = (body = {}) => {
  const { group, ports } = body;
  if (group && PORT_GROUPS[group]) return PORT_GROUPS[group];
  if (Array.isArray(ports) && ports.length > 0) {
    return ports.map(Number).filter((p) => !Number.isNaN(p) && p > 0 && p <= 65535);
  }
  return DEFAULT_PORTS.map((p) => p.port);
};

/**
 * POST /api/scan/port — scan a target, persist the result for the user.
 * Body: { target: string, group?: string, ports?: number[] }
 */
router.post("/port", portScanRateLimit, async (req, res) => {
  try {
    const { target } = req.body || {};
    if (!target || typeof target !== "string") {
      return res.status(400).json({
        status: "error",
        code: "missing_target",
        error: "Target is required.",
      });
    }

    const clean = cleanTarget(target);
    if (!clean) {
      return res.status(400).json({
        status: "error",
        code: "invalid_target",
        error: "Target must be a valid hostname or IP address.",
      });
    }

    // SSRF protection: block private/internal hosts
    if (isBlockedHost(clean)) {
      return res.status(400).json({
        status: "error",
        code: "blocked_host",
        error: "Internal and private hosts are not allowed.",
      });
    }

    // Verify hostname resolves before scanning
    let resolvedIp;
    try {
      resolvedIp = await resolveHost(clean);
    } catch {
      return res.status(400).json({
        status: "error",
        code: "dns_resolution_failed",
        error: "Hostname could not be resolved. Check the target and try again.",
      });
    }

    // SSRF protection: verify resolved IP is not in a private range
    if (resolvedIp && isPrivateIp(resolvedIp)) {
      return res.status(400).json({
        status: "error",
        code: "blocked_resolved_ip",
        error: "Target resolved to an internal/private IP address.",
      });
    }

    const portList = buildPortList(req.body).slice(0, 25);
    const scanStart = Date.now();
    const scanResults = await scanWithConcurrency(clean, portList, 5);
    const scanDurationMs = Date.now() - scanStart;

    const serviceMap = new Map(DEFAULT_PORTS.map((p) => [p.port, p.service]));
    const enrichedResults = scanResults.map((r) => ({
      ...r,
      service: serviceMap.get(r.port) || `PORT${r.port}`,
    }));

    // Persist to MongoDB (best-effort — a storage failure must never fail the scan)
    try {
      const db = getDb();
      await db.collection(SCANS_COLLECTION).insertOne({
        userId: String(req.user?.sub || ""),
        target: clean,
        openPorts: enrichedResults.filter((r) => r.state === "open").map((r) => r.port),
        scanDurationMs,
        scannedAt: new Date(),
      });
    } catch (error) {
      console.warn("[Scan] History persistence failed:", error?.message || error);
    }

    res.json({
      status: "ok",
      target: clean,
      scanned: enrichedResults.length,
      open: enrichedResults.filter((r) => r.state === "open").length,
      filtered: enrichedResults.filter((r) => r.state === "filtered").length,
      closed: enrichedResults.filter((r) => r.state === "closed").length,
      results: enrichedResults,
      scanDurationMs,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "scan_failed",
      error: "Port scan failed. Check the target and try again.",
    });
  }
});

/**
 * GET /api/scan/history — recent scans for the authenticated user.
 */
router.get("/history", async (req, res) => {
  try {
    const userId = String(req.user?.sub || "");
    const db = getDb();
    const scans = await db
      .collection(SCANS_COLLECTION)
      .find({ userId })
      .sort({ scannedAt: -1 })
      .limit(50)
      .toArray()
      .catch(() => []);
    res.json({ status: "ok", scans });
  } catch {
    res.json({ status: "ok", scans: [] });
  }
});

export default router;
