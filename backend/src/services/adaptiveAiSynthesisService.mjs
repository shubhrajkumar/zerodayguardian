import { env } from "../config/env.mjs";
import { requestLlm } from "./llmService.mjs";
import { TtlCache } from "../utils/ttlCache.mjs";
import { logWarn } from "../utils/logger.mjs";

const synthesisCache = new TtlCache({ ttlMs: 45_000, maxEntries: 400 });

const normalize = (value = "", max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const clipArray = (items = [], max = 4, clip = 120) =>
  [...new Set((Array.isArray(items) ? items : []).map((item) => normalize(item, clip)).filter(Boolean))].slice(0, max);

const safeJsonParse = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const buildCacheKey = ({ userId = "", type = "", adaptive = {}, context = {} } = {}) =>
  JSON.stringify({
    userId: String(userId || "").slice(0, 64),
    type: String(type || "adaptive").slice(0, 32),
    intents: (adaptive?.profile?.dominantIntents || []).map((item) => [item.intent, item.score]).slice(0, 3),
    interests: clipArray(adaptive?.profile?.interestSignals || [], 4, 60),
    predictedNeeds: clipArray(adaptive?.predictedNeeds || [], 3, 96),
    recommendations: (adaptive?.recommendations || [])
      .map((item) => [normalize(item.title, 72), normalize(item.action, 120)])
      .slice(0, 3),
    scanCount: Number(adaptive?.usage?.scans || 0),
    osintCount: Number(adaptive?.usage?.osintLookups || 0),
    riskCount: Number(adaptive?.usage?.highRiskFindings || 0),
    extra: context,
  });

const buildAdaptivePrompt = ({ adaptive = {}, context = {}, type = "dashboard" } = {}) => {
  const role = normalize(adaptive?.profile?.role || "learner", 24);
  const intents = (adaptive?.profile?.dominantIntents || [])
    .map((item) => `${normalize(item.intent, 40)}:${Number(item.score || 0).toFixed(2)}`)
    .slice(0, 3)
    .join(", ");
  const interests = clipArray(adaptive?.profile?.interestSignals || [], 4, 40).join(", ");
  const pattern = adaptive?.profile?.learningPattern || {};
  const recommendations = (adaptive?.recommendations || [])
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${normalize(item.title, 72)} | ${normalize(item.reason, 120)} | ${normalize(item.action, 120)}`)
    .join("\n");
  const predictedNeeds = clipArray(adaptive?.predictedNeeds || [], 3, 120).join("\n");
  const smartActions = (adaptive?.smartActions || [])
    .slice(0, 4)
    .map((item) => `${normalize(item.label, 60)} => ${normalize(item.description, 120)}`)
    .join("\n");
  const recentActions = (adaptive?.usage?.recentActions || [])
    .slice(0, 4)
    .map((item) => `${normalize(item.type, 32)} on ${normalize(item.surface, 32)} ${normalize(item.target, 48)}`.trim())
    .join("\n");

  return [
    `Context type: ${type}.`,
    `Role: ${role || "learner"}.`,
    `Dominant intents: ${intents || "none"}.`,
    `Interest signals: ${interests || "none"}.`,
    `Pattern: cadence=${normalize(pattern.cadence || "unknown", 24)}, style=${normalize(pattern.sessionStyle || "unknown", 24)}, recommendationStyle=${normalize(pattern.recommendationStyle || "unknown", 24)}.`,
    `Usage: scans=${Number(adaptive?.usage?.scans || 0)}, osint=${Number(adaptive?.usage?.osintLookups || 0)}, highRisk=${Number(adaptive?.usage?.highRiskFindings || 0)}.`,
    predictedNeeds ? `Predicted needs:\n${predictedNeeds}` : "",
    recommendations ? `Existing recommendations:\n${recommendations}` : "",
    smartActions ? `Existing smart actions:\n${smartActions}` : "",
    recentActions ? `Recent actions:\n${recentActions}` : "",
    context?.mindset ? `Mindset: ${normalize(context.mindset, 24)}.` : "",
    context?.stage ? `Mentor stage: ${normalize(context.stage, 24)}.` : "",
    "Return strict JSON only with this shape:",
    '{"summary":"string","mentorBrief":"string","recommendations":[{"title":"string","reason":"string","action":"string"}],"nextPrompts":["string","string"]}',
    "Rules:",
    "Keep summary <= 140 chars.",
    "Keep mentorBrief <= 220 chars.",
    "Recommendations max 3, short and practical, no filler.",
    "Next prompts max 2 and each <= 100 chars.",
    "Use only the provided context. Do not invent alerts, breaches, or unseen evidence.",
  ]
    .filter(Boolean)
    .join("\n");
};

const normalizeSynthesis = (parsed = null) => {
  if (!parsed || typeof parsed !== "object") return null;
  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations
        .map((item) => ({
          title: normalize(item?.title, 72),
          reason: normalize(item?.reason, 140),
          action: normalize(item?.action, 140),
        }))
        .filter((item) => item.title && item.action)
        .slice(0, 3)
    : [];

  const nextPrompts = clipArray(parsed.nextPrompts || [], 2, 100);
  const summary = normalize(parsed.summary, 140);
  const mentorBrief = normalize(parsed.mentorBrief, 220);
  if (!summary && !mentorBrief && !recommendations.length) return null;

  return {
    summary,
    mentorBrief,
    recommendations,
    nextPrompts,
    source: "openrouter",
    generatedAt: Date.now(),
  };
};

export const getAdaptiveAiSynthesis = async ({ userId = "", adaptive = {}, context = {}, type = "dashboard" } = {}) => {
  if (!env.hasOpenRouter) return null;

  const cacheKey = buildCacheKey({ userId, type, adaptive, context });
  return synthesisCache.getOrCreate(cacheKey, async () => {
    try {
      const response = await requestLlm({
        messages: [
          {
            role: "user",
            content: buildAdaptivePrompt({ adaptive, context, type }),
          },
        ],
        topic: {
          title: type === "mentor" ? "Adaptive AI Mentor" : "Adaptive Recommendations",
          tags: ["adaptive", "mentor", "openrouter", "recommendations"],
        },
        assistantProfile: {
          tone: "friendly",
          style: "concise",
          audience: "security operator",
        },
        timeoutMs: 3200,
        maxOutputTokens: 320,
        responseFormat: { type: "json_object" },
        routeStrategy: { order: ["openrouter", "ollama", "ollama_backup"], allow_fallbacks: true },
        providerOptions: {
          allow_fallbacks: true,
          data_collection: "deny",
          require_parameters: true,
        },
        userId: String(userId || "").slice(0, 120),
        correlationId: `adaptive-${type}-${String(userId || "anon").slice(0, 40)}`,
      });

      return normalizeSynthesis(safeJsonParse(response)) || null;
    } catch (error) {
      logWarn("Adaptive AI synthesis skipped", {
        userId: String(userId || "").slice(0, 32),
        type,
        code: String(error?.code || ""),
        provider: String(error?.provider || ""),
      });
      return null;
    }
  });
};
