import { Scan } from "../models/Scan.mjs";
import { OsintQuery } from "../models/OsintQuery.mjs";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const riskScoreForLevel = (level = "low") => {
  if (level === "high") return 85;
  if (level === "medium") return 55;
  return 25;
};

const computeUnifiedRisk = (scans = []) => {
  if (!scans.length) return { score: 0, level: "low" };
  const avg = scans.reduce((acc, scan) => acc + riskScoreForLevel(scan.riskLevel), 0) / scans.length;
  const score = clamp(Math.round(avg));
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return { score, level };
};

const buildPatterns = (scans = [], osint = []) => {
  const byDomain = new Map();
  for (const scan of scans) {
    const url = String(scan.url || "");
    if (!url) continue;
    byDomain.set(url, (byDomain.get(url) || 0) + 1);
  }
  const topTargets = [...byDomain.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([target, count]) => ({ target, count }));

  const osintHits = osint.length;
  return { topTargets, osintHits };
};

const computeBugBounty = (scans = []) => {
  const high = scans.filter((s) => s.riskLevel === "high").length;
  const medium = scans.filter((s) => s.riskLevel === "medium").length;
  const low = scans.filter((s) => s.riskLevel === "low").length;
  const xp = scans.length * 10 + high * 20 + medium * 10 + low * 5;
  const level = Math.max(1, Math.floor(xp / 100) + 1);
  const badges = [
    scans.length >= 1 ? "First Scan" : null,
    high >= 1 ? "High Risk Hunter" : null,
    scans.length >= 10 ? "Consistent Operator" : null,
  ].filter(Boolean);
  return { xp, level, badges };
};

export const getCyberBrainSummary = async ({ userId }) => {
  const scanRows = await Scan.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  const osintRows = await OsintQuery.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  const unified = computeUnifiedRisk(scanRows);
  const patterns = buildPatterns(scanRows, osintRows);
  const bugBounty = computeBugBounty(scanRows);
  const timeline = scanRows.slice(0, 12).map((scan) => ({
    id: scan._id,
    target: scan.url,
    riskLevel: scan.riskLevel || "low",
    createdAt: scan.createdAt,
  }));

  return {
    unifiedRisk: unified,
    patterns,
    bugBounty,
    timeline,
    totals: {
      scans: scanRows.length,
      osint: osintRows.length,
    },
  };
};
