import { Router } from "express";
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
  simulateSubdomainRecon,
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

const router = Router();
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

router.post("/telemetry/event", validateBody(telemetryEventSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await recordTelemetryEvent(actor, req.validatedBody);
    res.status(202).json({ status: "accepted", ...result });
  } catch (error) {
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

router.get("/dashboard", async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const intelligence = await getDashboardIntelligence(actor);
    res.json({ status: "ok", intelligence });
  } catch (error) {
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

router.get("/progression/me", async (req, res, next) => {
  try {
    const actor = resolveTrainingActor({ req });
    const profile = await getProgressionProfile(actor);
    res.json({ status: "ok", profile });
  } catch (error) {
    next(error);
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

router.post("/tools/dork", validateBody(dorkBuilderSchema), async (req, res, next) => {
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

router.post("/tools/subdomain-sim", validateBody(subdomainSimSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await simulateSubdomainRecon(actor, req.validatedBody.target);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/tools/webscan", validateBody(webScanSchema), async (req, res, next) => {
  try {
    const actor = resolveActor({ req });
    const result = await runWebSecurityScan(actor, req.validatedBody.url);
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.get("/news", validateQuery(newsQuerySchema), async (req, res, next) => {
  try {
    const feed = await getNewsFeed({
      category: req.validatedQuery.category,
      limit: req.validatedQuery.limit,
    });
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

router.post("/news/refresh", async (_req, res, next) => {
  try {
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
