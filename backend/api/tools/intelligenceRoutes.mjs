import { Router } from "express";
import PDFDocument from "pdfkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth, requireRole } from "../../src/middleware/auth.mjs";
import { validateBody, validateQuery } from "../../src/middleware/validate.mjs";
import {
  blogQuerySchema,
  dorkBuilderSchema,
  hashIdentifySchema,
  headersAnalyzeSchema,
  headersUrlAnalyzeSchema,
  labProgressSchema,
  metadataFileAnalyzeSchema,
  metadataAnalyzeSchema,
  newsQuerySchema,
  passwordStrengthSchema,
  promptRecommendationQuerySchema,
  subdomainSimSchema,
  telemetryEventSchema,
  trainingLabCompleteSchema,
  trainingLabRunSchema,
  threadCreateSchema,
  leaderboardQuerySchema,
  threadListQuerySchema,
  threadReplySchema,
  threadVoteSchema,
  webScanSchema,
} from "../../src/validators/intelligenceSchemas.mjs";
import {
  analyzeHeaders,
  analyzeHeadersFromUrl,
  analyzeMetadata,
  analyzeMetadataFile,
  analyzePasswordStrength,
  createCommunityReply,
  createCommunityThread,
  getCommunityIntelligence,
  getDorkTemplates,
  getAdaptivePromptRecommendation,
  getDashboardIntelligence,
  getResourceVault,
  identifyHash,
  listCommunityThreads,
  recordTelemetryEvent,
  resolveActor,
  runDorkBuilder,
  runWebSecurityScan,
  saveLabProgress,
  upvoteCommunityThread,
} from "../../src/services/intelligenceService.mjs";
import {
  completeBeginnerLab,
  getProgressionLeaderboard,
  getProgressionProfile,
  getWeeklyChallenges,
  listBeginnerLabs,
  resolveTrainingActor,
  runBeginnerLab,
} from "../../src/services/trainingService.mjs";
import { getNewsFeed, refreshNewsFeed, subscribeNewsUpdates } from "../../src/services/newsService.mjs";
import { logError } from "../../src/utils/logger.mjs";
import { createNotification } from "../../src/services/notificationService.mjs";
import { Scan } from "../../src/models/Scan.mjs";
import { getCyberBrainSummary } from "../../src/services/cyberBrainService.mjs";
import { buildAttackSurface } from "../../src/services/attackSurfaceService.mjs";
import { TtlCache } from "../../src/utils/ttlCache.mjs";
import { getAdaptiveExperience } from "../../src/services/adaptiveExperienceService.mjs";
import { getAdaptiveAiSynthesis } from "../../src/services/adaptiveAiSynthesisService.mjs";

const router = Router();
const dashboardCache = new TtlCache({ ttlMs: 5000, maxEntries: 200 });
const newsCache = new TtlCache({ ttlMs: 30000, maxEntries: 32 });
const webscanCache = new TtlCache({ ttlMs: 60000, maxEntries: 100 });
const mentorAdaptiveCache = new TtlCache({ ttlMs: 15000, maxEntries: 200 });
const toolsCatalogCache = new TtlCache({ ttlMs: 300000, maxEntries: 4 });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isTelemetryEventRoute = (req) => {
  const path = String(req.path || "").trim();
  const originalUrl = String(req.originalUrl || "").trim();
  return path === "/telemetry/event" || path.endsWith("/telemetry/event") || originalUrl.endsWith("/telemetry/event");
};
const requireAuthenticatedMutation = (req, res, next) => {
  const method = String(req.method || "").toUpperCase();
  if (isTelemetryEventRoute(req)) {
    next();
    return;
  }
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }
  requireAuth(req, res, next);
};
const simplifyHeadline = (title = "") => {
  const compact = String(title || "").replace(/\s+/g, " ").trim();
  const words = compact.split(" ").filter(Boolean);
  return words.slice(0, 11).join(" ");
};
const simplifySummary = (description = "", title = "") => {
  const source = String(description || title || "").replace(/\s+/g, " ").trim();
  if (!source) return "No summary available.";
  const parts = source.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ").slice(0, 340);
};
const whyItMatters = (category = "") => {
  if (category === "zero-day") return "New vulnerabilities can be exploited quickly. Patch and monitor immediately.";
  if (category === "breaches") return "Breaches show active attacker behavior. Review exposure and incident response readiness.";
  if (category === "ai-security") return "AI attack patterns evolve fast. Strengthen model guardrails and data controls.";
  if (category === "malware") return "Malware campaigns spread through common user actions. Improve endpoint and email defenses.";
  return "Threat activity is changing. Keep controls updated and validate detection coverage.";
};
const dashboardCacheKey = (actor) => `${actor.userId || "anon"}:${actor.sessionId || "session"}`;
const newsCacheKey = ({ category, limit }) => `${category}:${limit}`;
const webscanCacheKey = (url) => String(url || "").trim().toLowerCase();

const normalizeHex = (value = "", fallback = "#22d3ee") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.startsWith("#") ? raw : `#${raw}`;
};

const webscanTemplateStyles = (template = "classic", accent = "#22d3ee") => {
  const safeAccent = normalizeHex(accent);
  switch (template) {
    case "dark":
      return {
        headerFill: "#0f172a",
        headerText: "#e2e8f0",
        accent: safeAccent,
        sectionTitle: "#0f172a",
        bodyText: "#0f172a",
      };
    case "neon":
      return {
        headerFill: "#05060a",
        headerText: "#e2e8f0",
        accent: safeAccent,
        sectionTitle: "#0ea5e9",
        bodyText: "#0f172a",
      };
    case "classic":
    default:
      return {
        headerFill: "#e2e8f0",
        headerText: "#0f172a",
        accent: safeAccent,
        sectionTitle: "#0f172a",
        bodyText: "#0f172a",
      };
  }
};

const buildWebscanReportPdf = ({ res, result, report }) => {
  const template = report?.template || "classic";
  const accent = report?.accent || "#22d3ee";
  const brandName = report?.brandName || "ZeroDay Guardian";
  const brandTagline = report?.brandTagline || "Security posture snapshot";
  const styles = webscanTemplateStyles(template, accent);
  const doc = new PDFDocument({ margin: 48 });
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 90).fill(styles.headerFill);
  doc.fillColor(styles.headerText).fontSize(18).text(brandName, 50, 32);
  doc.fontSize(10).text(brandTagline, 50, 54);
  doc.fillColor(styles.bodyText);
  doc.moveDown(2.4);

  doc.fontSize(14).text("Web Scan Report");
  doc.fontSize(11).text(`Target: ${result.target.normalizedUrl}`);
  doc.text(`Hostname: ${result.target.hostname}`);
  doc.text(`Risk score: ${result.riskScore ?? "n/a"} (${result.riskLevel || "n/a"})`);
  doc.text(`HTTPS enforced: ${result.httpsEnforced ? "Yes" : "No"}`);
  doc.text(`SSL status: ${result.sslStatus}`);
  doc.moveDown();

  doc.fontSize(13).fillColor(styles.sectionTitle).text("Security Headers");
  doc.fontSize(11).fillColor(styles.bodyText);
  Object.entries(result.headers || {}).forEach(([key, value]) => {
    doc.text(`${key}: ${value || "missing"}`);
  });
  if (result.missingHeaders?.length) {
    doc.moveDown(0.5);
    doc.text(`Missing: ${result.missingHeaders.join(", ")}`);
  }
  doc.moveDown();

  doc.fontSize(13).fillColor(styles.sectionTitle).text("Open Ports (basic)");
  doc.fontSize(11).fillColor(styles.bodyText);
  (result.openPorts || []).forEach((entry) => {
    doc.text(`${entry.port}: ${entry.status}`);
  });
  if (!(result.openPorts || []).length) doc.text("No common ports responded.");
  doc.moveDown();

  doc.fontSize(13).fillColor(styles.sectionTitle).text("TLS Certificate");
  doc.fontSize(11).fillColor(styles.bodyText);
  doc.text(`Issuer: ${result.ssl?.issuer || "n/a"}`);
  doc.text(`Valid from: ${result.ssl?.validFrom || "n/a"}`);
  doc.text(`Valid to: ${result.ssl?.validTo || "n/a"}`);
  doc.text(`Days remaining: ${result.ssl?.daysRemaining ?? "n/a"}`);
  doc.moveDown();

  doc.fontSize(13).fillColor(styles.sectionTitle).text("Technology Hints");
  doc.fontSize(11).fillColor(styles.bodyText).text((result.technologies || []).join(", ") || "n/a");
  if (result.notes) {
    doc.moveDown();
    doc.fontSize(11).text(`Notes: ${result.notes}`);
  }
  doc.end();
};

router.get("/prompts/recommendation", validateQuery(promptRecommendationQuerySchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const rec = await getAdaptivePromptRecommendation(actor, {
      query: req.validatedQuery.q,
      regenerate: req.validatedQuery.regenerate,
    });
    res.json({ status: "ok", recommendation: rec });
  } catch (error) {
    next(error);
  }
});

router.post("/telemetry/event", validateBody(telemetryEventSchema), async (req, res) => {
  try {
    const actor = resolveActor({ req });
    const result = await recordTelemetryEvent(actor, req.validatedBody);
    res.status(202).json({ status: "accepted", ...result });
  } catch {
    res.status(202).json({
      status: "accepted",
      degraded: true,
      message: "Telemetry captured in degraded mode.",
      result: {
        intent: "learning",
        complexity: 0,
        xpGain: 0,
      },
    });
  }
});

router.get("/tools/catalog", async (_req, res, next) => {
  try {
    const cached = toolsCatalogCache.get("tools:catalog");
    if (cached) {
      res.json({ status: "ok", tools: cached, source: "catalog-cache" });
      return;
    }

    const candidatePaths = [
      path.resolve(__dirname, "../../data/tools.catalog.json"),
      path.resolve(__dirname, "../../../src/data/tools.json"),
    ];

    let tools = [];
    let source = "catalog-live";

    for (const catalogPath of candidatePaths) {
      try {
        const raw = await readFile(catalogPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          tools = parsed;
          source = catalogPath.endsWith("tools.catalog.json") ? "backend-catalog" : "frontend-catalog-fallback";
          break;
        }
      } catch {
        // try the next candidate path
      }
    }

    const normalized = Array.isArray(tools) ? tools : [];
    toolsCatalogCache.set("tools:catalog", normalized);
    res.json({ status: "ok", tools: normalized, source });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuthenticatedMutation);

router.get("/dashboard", async (req, res) => {
  try {
    const actor = resolveActor({ req });
    const cacheKey = dashboardCacheKey(actor);
    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      res.json({ status: "ok", intelligence: cached, cacheHit: true });
      return;
    }
    const intelligence = await getDashboardIntelligence(actor);
    dashboardCache.set(cacheKey, intelligence);
    res.json({ status: "ok", intelligence });
  } catch (error) {
    logError("Progression profile failed", error, {
      path: req.originalUrl || req.path,
      userId: req.user?.sub || null,
      sessionId: req.neurobotSessionId || req.requestId,
    });
    res.json({
      status: "ok",
      degraded: true,
      intelligence: {
        xp: 0,
        streak: 1,
        rank: "Rookie",
        proficiency: 0.2,
        completedLabs: 0,
        totalLabsTouched: 0,
        heatmap: {},
        continueLearning: { intent: "learning", action: "Start with one focused beginner lab." },
        telemetry: { events: 0, toolsUsed: 0, successRate: 0, averageDurationMs: 0 },
        achievements: [],
        recentToolUsage: [],
      },
    });
  }
});

router.get("/resources", async (_req, res, next) => {
  try {
    const vault = await getResourceVault();
    res.json({ status: "ok", ...vault });
  } catch (error) {
    next(error);
  }
});

router.post("/labs/progress", validateBody(labProgressSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const row = await saveLabProgress(actor, req.validatedBody);
    res.json({ status: "ok", progress: row });
  } catch (error) {
    next(error);
  }
});

router.get("/training/labs/beginner", async (_req, res, next) => {
  try {
    const labs = await listBeginnerLabs();
    res.json({ status: "ok", labs });
  } catch (error) {
    next(error);
  }
});

router.post("/training/labs/beginner/run", validateBody(trainingLabRunSchema), async (req, res, next) => {
  try {
    const actor = resolveTrainingActor({ req });
    const result = await runBeginnerLab(actor, req.validatedBody);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/training/labs/beginner/complete", validateBody(trainingLabCompleteSchema), async (req, res, next) => {
  try {
    const actor = resolveTrainingActor({ req });
    const result = await completeBeginnerLab(actor, req.validatedBody);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.get("/progression/me", async (req, res) => {
  try {
    const actor = resolveTrainingActor({ req });
    const profile = await getProgressionProfile(actor);
    res.json({ status: "ok", profile });
  } catch {
    res.json({
      status: "ok",
      degraded: true,
      profile: {
        role: "student",
        permissions: ["labs:run", "labs:complete", "leaderboard:view", "weekly:view"],
        points: 0,
        rank: "Recruit",
        level: 1,
        streak: 1,
        completedLabs: 0,
        weeklyPoints: 0,
        rankLadder: [
          { name: "Recruit", minPoints: 0 },
          { name: "Analyst", minPoints: 300 },
          { name: "Hunter", minPoints: 800 },
          { name: "Guardian", minPoints: 1600 },
          { name: "Elite", minPoints: 3000 },
        ],
      },
    });
  }
});

router.get("/progression/leaderboard", validateQuery(leaderboardQuerySchema), async (req, res, next) => {
  try {
    const leaderboard = await getProgressionLeaderboard({
      period: req.validatedQuery.period,
      limit: req.validatedQuery.limit,
    });
    res.json({ status: "ok", period: req.validatedQuery.period, leaderboard });
  } catch (error) {
    next(error);
  }
});

router.get("/progression/weekly-challenges", async (_req, res, next) => {
  try {
    const data = await getWeeklyChallenges();
    res.json({ status: "ok", ...data });
  } catch (error) {
    next(error);
  }
});

router.get("/mentor/adaptive", async (req, res, next) => {
  try {
    const actor = resolveTrainingActor({ req });
    const mindset = String(req.query?.mindset || "defense").trim().toLowerCase() === "offense" ? "offense" : "defense";
    const cacheKey = `${actor.key}:adaptive-mentor:${mindset}`;
    const cached = mentorAdaptiveCache.get(cacheKey);
    if (cached) {
      res.json({ status: "ok", mentor: cached, cacheHit: true });
      return;
    }

    const [profile, intelligence, labs, adaptive] = await Promise.all([
      getProgressionProfile(actor),
      getDashboardIntelligence(actor).catch(() => null),
      listBeginnerLabs(),
      actor.userId ? getAdaptiveExperience({ userId: actor.userId }).catch(() => null) : Promise.resolve(null),
    ]);

    const level = Number(profile?.level || 1);
    const stage = level >= 8 ? "Advanced" : level >= 4 ? "Intermediate" : "Beginner";
    const dominantIntent = adaptive?.profile?.dominantIntents?.[0]?.intent || intelligence?.continueLearning?.intent || "learning";
    const focus =
      mindset === "offense"
        ? dominantIntent === "investigation"
          ? "Attack-path analysis and exploit reasoning"
          : dominantIntent === "threat_hunting"
            ? "Adversary simulation and signal chaining"
            : "Offensive technique mastery with legal scope"
        : dominantIntent === "investigation"
          ? "Investigation and evidence validation"
          : dominantIntent === "hardening"
            ? "Hardening and remediation follow-through"
            : dominantIntent === "threat_hunting"
              ? "Threat hunting and signal correlation"
              : "Guided security fundamentals";

    const suggestedLabs = labs
      .map((lab) => {
        const score =
          (stage === "Beginner" && lab.level === "beginner" ? 16 : 0) +
          (stage === "Intermediate" && ["beginner", "intermediate"].includes(String(lab.level || "").toLowerCase()) ? 12 : 0) +
          (stage === "Advanced" ? 10 : 0) +
          (dominantIntent === "investigation" && /xss|sqli|port|sandbox/i.test(`${lab.id} ${lab.title}`) ? 8 : 0) +
          (dominantIntent === "hardening" && /password|port/i.test(`${lab.id} ${lab.title}`) ? 8 : 0) +
          (mindset === "offense" && /offensive|xss|sqli|bypass|token|recon|exploit|auth/i.test(`${lab.id} ${lab.title} ${lab.objective}`) ? 18 : 0) +
          (mindset === "defense" && /defensive|hardening|phishing|password|detect|contain|api|email/i.test(`${lab.id} ${lab.title} ${lab.objective}`) ? 18 : 0);
        return {
          id: lab.id,
          title: lab.title,
          objective: lab.objective,
          explanation: lab.explanation,
          level: lab.level,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const nextSteps = [
      adaptive?.recommendations?.[0]?.action ||
        intelligence?.continueLearning?.action ||
        (mindset === "offense"
          ? "Trace one realistic attack path, then explain the defensive takeaway."
          : "Complete one guided hardening lab and review the outcome."),
      suggestedLabs[0] ? `Open ${suggestedLabs[0].title} and finish the first focused step.` : null,
      adaptive?.predictedNeeds?.[0] ||
        (mindset === "offense"
          ? "Capture one exploit insight and one legal-scope boundary before the next pivot."
          : "Capture one remediation insight before asking the mentor for the next pivot."),
    ].filter(Boolean);

    const adaptiveSnapshot = {
      profile: {
        dominantIntents: adaptive?.profile?.dominantIntents || [],
        interestSignals: adaptive?.profile?.interestSignals || [],
        learningPattern: adaptive?.profile?.learningPattern || null,
        assistant: adaptive?.profile?.assistant || null,
        role: adaptive?.profile?.role || "learner",
      },
      usage: adaptive?.usage || {
        scans: Number(intelligence?.telemetry?.events || 0),
        osintLookups: 0,
        highRiskFindings: 0,
        recentActions: [],
      },
      predictedNeeds: adaptive?.predictedNeeds || [],
      recommendations: adaptive?.recommendations || [],
      smartActions: adaptive?.smartActions || [],
    };

    const ai = await getAdaptiveAiSynthesis({
      userId: actor.userId || actor.key,
      adaptive: adaptiveSnapshot,
      context: {
        mindset,
        stage,
        focus,
      },
      type: "mentor",
    });

    const mentor = {
      generatedAt: Date.now(),
      stage,
      focus,
      rationale:
        ai?.summary ||
        adaptive?.predictedNeeds?.[0] ||
        `Current profile indicates ${stage.toLowerCase()} momentum with a ${mindset} mindset and ${dominantIntent.replace(/_/g, " ")} intent.`,
      profile: {
        level: Number(profile?.level || 1),
        rank: String(profile?.rank || "Recruit"),
        points: Number(profile?.points || 0),
        streak: Number(profile?.streak || 1),
        completedLabs: Number(profile?.completedLabs || 0),
      },
      suggestedLabs,
      nextSteps: [...(ai?.recommendations || []).map((item) => item.action), ...nextSteps].slice(0, 4),
      dynamicPrompt:
        ai?.nextPrompts?.[0] ||
        `Act as my adaptive cybersecurity mentor in ${mindset} mode. My current stage is ${stage}. My main focus is ${focus}. Guide my next step using this context: ${nextSteps.join(" ")}`,
      aiBrief: ai?.mentorBrief || "",
      aiEnabled: Boolean(ai),
      adaptiveSignals: {
        dominantIntent,
        mindset,
        achievements: intelligence?.achievements || [],
        recentToolUsage: intelligence?.recentToolUsage?.slice(0, 3) || [],
        predictedNeeds: adaptive?.predictedNeeds || [],
      },
    };

    mentorAdaptiveCache.set(cacheKey, mentor);
    res.json({ status: "ok", mentor });
  } catch (error) {
    next(error);
  }
});

router.get("/brain/summary", requireAuth, async (req, res, next) => {
  try {
    const summary = await getCyberBrainSummary({ userId: req.user?.sub });
    res.json({ status: "ok", summary });
  } catch (error) {
    next(error);
  }
});

router.get("/attack-surface", requireAuth, async (req, res, next) => {
  try {
    const target = String(req.query?.target || "").trim();
    const surface = await buildAttackSurface(target);
    res.json({ status: "ok", surface });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/dork", requireRole("analyst", "admin"), validateBody(dorkBuilderSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await runDorkBuilder(actor, req.validatedBody);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.get("/tools/dork/templates", async (_req, res, next) => {
  try {
    res.json({ status: "ok", templates: getDorkTemplates() });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/hash-identify", validateBody(hashIdentifySchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await identifyHash(actor, req.validatedBody.hash);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/password-strength", validateBody(passwordStrengthSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await analyzePasswordStrength(actor, req.validatedBody.password);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/headers-analyze", validateBody(headersAnalyzeSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await analyzeHeaders(actor, req.validatedBody.headers);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/headers-url", validateBody(headersUrlAnalyzeSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await analyzeHeadersFromUrl(actor, req.validatedBody.url);
    res.json({ status: "ok", result });
  } catch (error) {
    const status = Number(error?.status || 0);
    if (status >= 400 && status < 600) {
      res.status(status).json({
        status: "error",
        code: String(error?.code || "headers_url_failed"),
        error: String(error?.message || "Failed to analyze headers"),
        details: error?.details || {},
      });
      return;
    }
    next(error);
  }
});

router.post("/tools/metadata-analyze", validateBody(metadataAnalyzeSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await analyzeMetadata(actor, req.validatedBody.input);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/metadata-upload", validateBody(metadataFileAnalyzeSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await analyzeMetadataFile(actor, req.validatedBody);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/tools/subdomain-sim",
  requireRole("analyst", "admin"),
  validateBody(subdomainSimSchema),
  async (req, res, next) => {
  try {
    void req;
    void next;
    res.status(503).json({
      status: "error",
      code: "no_verified_data",
      error: "No verified data.",
      message: "No verified data.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/webscan", requireAuth, validateBody(webScanSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const cacheKey = webscanCacheKey(req.validatedBody.url);
    const cached = webscanCache.get(cacheKey);
    const result = cached || (await runWebSecurityScan(actor, req.validatedBody.url));
    if (!cached) webscanCache.set(cacheKey, result);

    res.json({ status: "ok", result, cacheHit: Boolean(cached) });

    if (!cached) {
      Promise.allSettled([
        req.user?.sub
          ? Scan.create({
            userId: req.user.sub,
            url: result.target?.normalizedUrl || req.validatedBody.url,
            result,
            riskLevel: result.riskLevel || "low",
          })
          : Promise.resolve(null),
        createNotification({
          userId: req.user?.sub,
          title: "Web scan completed",
          message: `Scan finished for ${result.target?.normalizedUrl || req.validatedBody.url}. Risk score: ${result.riskScore ?? "n/a"}.`,
          severity: result.riskLevel === "high" ? "high" : result.riskLevel === "medium" ? "medium" : "low",
          type: "webscan",
        }),
      ]).catch(() => undefined);
    }
  } catch (error) {
    next(error);
  }
});

router.post("/tools/webscan/report", requireAuth, validateBody(webScanSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const cacheKey = webscanCacheKey(req.validatedBody.url);
    const result = webscanCache.get(cacheKey) || (await runWebSecurityScan(actor, req.validatedBody.url));
    webscanCache.set(cacheKey, result);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="webscan-report-${Date.now()}.pdf"`);
    buildWebscanReportPdf({ res, result, report: req.validatedBody.report || {} });
  } catch (error) {
    next(error);
  }
});

router.get("/news", validateQuery(newsQuerySchema), async (req, res, next) => {
  try {
    if (req.validatedQuery.refresh) {
      newsCache.clear();
      await refreshNewsFeed({ trigger: "dashboard_manual" });
    }
    const cacheKey = newsCacheKey({ category: req.validatedQuery.category, limit: req.validatedQuery.limit });
    const cached = newsCache.get(cacheKey);
    if (cached && !req.validatedQuery.refresh) {
      res.json({ status: "ok", ...cached, cacheHit: true });
      return;
    }
    const feed = await getNewsFeed({
      category: req.validatedQuery.category,
      limit: req.validatedQuery.limit,
    });
    newsCache.set(cacheKey, feed);
    res.json({ status: "ok", ...feed });
  } catch (error) {
    next(error);
  }
});

router.get("/blog/posts", validateQuery(blogQuerySchema), async (req, res, next) => {
  try {
    const feed = await getNewsFeed({
      category: req.validatedQuery.category,
      limit: req.validatedQuery.limit,
    });
    const q = String(req.validatedQuery.q || "").toLowerCase();
    const posts = (feed.items || [])
      .filter((item) => {
        if (!q) return true;
        return `${item.title} ${item.description}`.toLowerCase().includes(q);
      })
      .map((item) => {
        const words = String(item.description || item.title || "").split(/\s+/).filter(Boolean).length;
        const readTimeMin = Math.max(2, Math.ceil(words / 190));
        const summary = simplifySummary(item.description, item.title);
        const category = item.category;
        return {
          id: item.id,
          title: simplifyHeadline(item.title),
          category,
          date: new Date(item.publishedTs || Date.now()).toISOString().slice(0, 10),
          excerpt: summary,
          whyMatters: whyItMatters(category),
          source: item.source,
          credibility: item.credibility || "trusted",
          readTime: `${readTimeMin} min read`,
          url: item.link,
        };
      });
    res.json({ status: "ok", posts, updatedAt: feed.updatedAt || null });
  } catch (error) {
    next(error);
  }
});

router.post("/news/refresh", requireRole("admin"), async (_req, res, next) => {
  try {
    newsCache.clear();
    const result = await refreshNewsFeed({ trigger: "manual" });
    res.json({ status: "ok", ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/news/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const write = (event, payload) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  write("ready", { ts: Date.now() });
  const unsub = subscribeNewsUpdates((payload) => {
    write("news:update", payload);
  });
  const ping = setInterval(() => write("ping", { ts: Date.now() }), 20_000);
  req.on("close", () => {
    clearInterval(ping);
    unsub();
  });
});

router.get("/community/leaderboard", async (req, res, next) => {
  try {
    const data = await getCommunityIntelligence();
    res.json({ status: "ok", ...data });
  } catch (error) {
    next(error);
  }
});

router.get("/community/threads", validateQuery(threadListQuerySchema), async (req, res, next) => {
  try {
    const threads = await listCommunityThreads({ limit: req.validatedQuery.limit, sort: req.validatedQuery.sort });
    res.json({ status: "ok", threads });
  } catch (error) {
    next(error);
  }
});

router.post("/community/threads", validateBody(threadCreateSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const thread = await createCommunityThread(actor, req.validatedBody);
    res.status(201).json({ status: "ok", thread });
  } catch (error) {
    next(error);
  }
});

router.post("/community/replies", validateBody(threadReplySchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const reply = await createCommunityReply(actor, req.validatedBody);
    res.status(201).json({ status: "ok", reply });
  } catch (error) {
    next(error);
  }
});

router.post("/community/vote", validateBody(threadVoteSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await upvoteCommunityThread(actor, req.validatedBody);
    res.json({ status: "ok", ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
