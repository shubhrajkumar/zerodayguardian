import mongoose from "mongoose";
import { Scan } from "../src/models/Scan.mjs";
import { logError, logInfo } from "../src/utils/logger.mjs";
import { TtlCache } from "../src/utils/ttlCache.mjs";
import { getAdaptiveExperience, recordAdaptiveEvent } from "../src/services/adaptiveExperienceService.mjs";
import { getPlatformCockpit } from "../src/services/platformCockpitService.mjs";

const dashboardStatsCache = new TtlCache({ ttlMs: 12_000, maxEntries: 500 });
const adaptiveCache = new TtlCache({ ttlMs: 10_000, maxEntries: 500 });
const cockpitCache = new TtlCache({ ttlMs: 10_000, maxEntries: 500 });

const normalizeUserId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { raw: "", dbValue: null };
  return {
    raw,
    dbValue: mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : raw,
  };
};

const buildUserFilter = (userId) => ({ userId: userId.dbValue });

const normalizeRisk = (value = "") => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high" || normalized === "medium") return normalized;
  return "low";
};

const scoreForScan = (row = {}) => {
  const resultScore = Number(row?.result?.riskScore);
  if (Number.isFinite(resultScore) && resultScore > 0) return Math.max(0, Math.min(100, resultScore));
  const level = normalizeRisk(row?.riskLevel || row?.risk || "low");
  if (level === "high") return 25;
  if (level === "medium") return 60;
  return 88;
};

const loadCachedDashboardStats = async (userId) =>
  dashboardStatsCache.getOrCreate(`dashboard:${userId.raw}`, async () => {
    if (!(userId.dbValue instanceof mongoose.Types.ObjectId)) {
      return {
        totalScans: 0,
        averageScore: 0,
        riskCounts: { low: 0, medium: 0, high: 0 },
        latestScan: null,
        recentScans: [],
        scoreTrend: [],
      };
    }
    const [scans, totalScans] = await Promise.all([
      Scan.find(buildUserFilter(userId))
        .select({
          _id: 1,
          url: 1,
          riskLevel: 1,
          risk: 1,
          createdAt: 1,
          "result.summary": 1,
          "result.notes": 1,
          "result.riskScore": 1,
          "result.target.normalizedUrl": 1,
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Scan.countDocuments(buildUserFilter(userId)),
    ]);
    const riskCounts = scans.reduce(
      (acc, row) => {
        const level = normalizeRisk(row?.riskLevel || row?.risk || "low");
        acc[level] += 1;
        return acc;
      },
      { low: 0, medium: 0, high: 0 }
    );
    const recentScans = scans.slice(0, 8).map((row) => ({
      id: String(row._id),
      target_url: String(row.url || row.result?.target?.normalizedUrl || ""),
      score: scoreForScan(row),
      riskLevel: normalizeRisk(row?.riskLevel || row?.risk || "low"),
      summary: String(row?.result?.summary || row?.result?.notes || "Scan completed."),
      created_at: new Date(row.createdAt || Date.now()).toISOString(),
    }));
    const scoreTrend = [...recentScans]
      .reverse()
      .map((row) => ({ name: new Date(row.created_at).toLocaleDateString("en-US"), score: Math.round(row.score) }));
    const averageScore = recentScans.length
      ? Math.round(recentScans.reduce((sum, row) => sum + Number(row.score || 0), 0) / recentScans.length)
      : 0;
    return {
      totalScans,
      averageScore,
      riskCounts,
      latestScan: recentScans[0] || null,
      recentScans,
      scoreTrend,
    };
  });

export const getDashboardStats = async (req, res) => {
  try {
    logInfo("Dashboard stats requested", { requestId: req.requestId || "", userId: req.user?.sub || "" });
    const userId = normalizeUserId(req.user?.sub);
    if (!userId.raw) {
      res.status(400).json({
        status: "error",
        code: "invalid_user_id",
        message: "Authenticated user id is not valid for dashboard stats.",
        requestId: req.requestId || "",
      });
      return;
    }

    const stats = await loadCachedDashboardStats(userId);

    res.json({
      status: "ok",
      stats,
    });
  } catch (error) {
    logError("Dashboard stats failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

export const getAdaptiveDashboard = async (req, res) => {
  try {
    logInfo("Adaptive dashboard requested", { requestId: req.requestId || "", userId: req.user?.sub || "" });
    const userId = normalizeUserId(req.user?.sub);
    if (!userId.raw) {
      res.status(400).json({
        status: "error",
        code: "invalid_user_id",
        message: "Authenticated user id is not valid for adaptive dashboard.",
        requestId: req.requestId || "",
      });
      return;
    }

    const cacheKey = `adaptive:${userId.raw}`;
    const payload = await adaptiveCache.getOrCreate(cacheKey, async () => {
      const stats = await loadCachedDashboardStats(userId);
      return getAdaptiveExperience({ userId: userId.raw, dashboardStats: stats });
    });

    res.json({ status: "ok", adaptive: payload });
  } catch (error) {
    logError("Adaptive dashboard failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

export const getPlatformCockpitDashboard = async (req, res) => {
  try {
    logInfo("Platform cockpit requested", { requestId: req.requestId || "", userId: req.user?.sub || "" });
    const userId = normalizeUserId(req.user?.sub);
    if (!userId.raw) {
      res.status(400).json({
        status: "error",
        code: "invalid_user_id",
        message: "Authenticated user id is not valid for platform cockpit.",
        requestId: req.requestId || "",
      });
      return;
    }

    const payload = await cockpitCache.getOrCreate(`cockpit:${userId.raw}`, async () => {
      const stats = await loadCachedDashboardStats(userId);
      return getPlatformCockpit({
        actor: {
          userId: userId.raw,
          sessionId: req.neurobotSessionId,
          key: `u:${userId.raw}`,
        },
        dashboardStats: stats,
      });
    });

    res.json({ status: "ok", cockpit: payload });
  } catch (error) {
    logError("Platform cockpit failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

export const postAdaptiveEvent = async (req, res) => {
  try {
    logInfo("Adaptive event recorded", {
      requestId: req.requestId || "",
      userId: req.user?.sub || "",
      type: req.validatedBody?.type || "",
    });
    const event = await recordAdaptiveEvent({
      userId: req.user?.sub || "",
      event: req.validatedBody,
    });
    const userId = normalizeUserId(req.user?.sub);
    adaptiveCache.delete(`adaptive:${userId.raw}`);
    cockpitCache.delete(`cockpit:${userId.raw}`);
    let adaptive = null;
    if (userId.raw) {
      try {
        const stats = await loadCachedDashboardStats(userId);
        adaptive = await getAdaptiveExperience({ userId: userId.raw, dashboardStats: stats });
        adaptiveCache.set(`adaptive:${userId.raw}`, adaptive);
        cockpitCache.delete(`cockpit:${userId.raw}`);
      } catch (adaptiveError) {
        logError("Adaptive refresh after event failed", adaptiveError, {
          requestId: req.requestId || "",
          userId: req.user?.sub || "",
        });
      }
    }
    res.status(202).json({ status: "ok", accepted: true, event, adaptive });
  } catch (error) {
    logError("Adaptive event record failed", error, { requestId: req.requestId || "", userId: req.user?.sub || "" });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};
