import { getAdaptivePromptRecommendation, getResourceVault } from "../services/intelligenceService.mjs";
import { selectAiRoute } from "../services/aiRouter.js";
import { analyzeAttachments } from "../services/fileAnalyzer.js";
import {
  runToolDorkBuilder,
  runToolHashIdentify,
  runToolHeadersFromUrl,
  runToolMetadataUploadAnalyze,
  runToolSubdomainRecon,
} from "./index.mjs";
import { logWarn } from "../utils/logger.mjs";

const TOOL_ENGINE_META = Object.freeze({
  id: "zorvix-tool-engine",
  version: "2.0.0",
  modules: ["search-module", "research-module", "cyber-analysis-module", "learning-assistant-module", "attachment-module"],
});
const TOOL_MODULE_TIMEOUT_MS = 1800;

const actorKey = ({ userId, sessionId }) => (userId ? `u:${userId}` : `s:${sessionId || "anonymous"}`);

const buildActor = ({ userId = null, sessionId = "anonymous" } = {}) => ({
  userId,
  sessionId,
  key: actorKey({ userId, sessionId }),
});

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const tokenize = (value = "") =>
  normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);

const lastUserMessage = (messages = []) => [...messages].reverse().find((message) => message?.role === "user")?.content || "";

const extractUrl = (value = "") => String(value || "").match(/https?:\/\/[^\s)]+/i)?.[0] || "";

const extractDomain = (value = "") => {
  const direct = String(value || "").match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/i)?.[0] || "";
  return direct.replace(/^www\./i, "");
};

const extractHashCandidate = (value = "") =>
  String(value || "").match(/\b(?:\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}|[A-Fa-f0-9]{32,128})\b/)?.[0] || "";

const scoreResource = (resource, tokens = []) => {
  const haystack = normalizeText([resource.title, resource.kind, resource.source, resource.usage].join(" ")).toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
};

const formatResourceSummary = (resources = []) =>
  resources
    .slice(0, 3)
    .map((resource) => `- ${resource.title} (${resource.source}): ${resource.usage}`)
    .join("\n");

const buildSearchModule = async ({ query }) => {
  const vault = await getResourceVault();
  const tokens = tokenize(query);
  const ranked = [...(vault.resources || [])]
    .map((resource) => ({ resource, score: scoreResource(resource, tokens) }))
    .sort((left, right) => right.score - left.score);
  const resources = ranked.filter((entry) => entry.score > 0).map((entry) => entry.resource);
  const selected = (resources.length ? resources : vault.resources || []).slice(0, 3);
  if (!selected.length) return null;
  return {
    id: "search-module",
    title: "Knowledge search",
    summary: formatResourceSummary(selected),
    data: selected,
  };
};

const buildResearchModule = async ({ query, topicTitle }) => {
  const normalizedQuery = normalizeText(query);
  const brief = [
    topicTitle ? `- Active topic: ${topicTitle}` : "",
    normalizedQuery ? `- Research focus: ${normalizedQuery}` : "",
    "- Objective: identify the safest explanation path, practical steps, and verification checkpoints.",
  ]
    .filter(Boolean)
    .join("\n");
  return {
    id: "research-module",
    title: "Research brief",
    summary: brief,
    data: { topicTitle: topicTitle || "", query: normalizedQuery },
  };
};

const buildLearningModule = async ({ actor, query }) => {
  const recommendation = await getAdaptivePromptRecommendation(actor, { query });
  return {
    id: "learning-assistant-module",
    title: "Learning assistant",
    summary: [`- Recommended prompt: ${recommendation.prompt}`, `- Next step: ${recommendation.nextStep}`].join("\n"),
    data: recommendation,
  };
};

const formatHashResponse = (result) =>
  [
    "Focused cyber analysis",
    "",
    `Likely algorithm: ${result.algorithm}`,
    `Confidence: ${Math.round(Number(result.confidence || 0) * 100)}%`,
    result.bits ? `Strength estimate: ${result.bits}-bit family` : "",
    `Format: ${result.format}`,
    "",
    "Recommended next step",
    "Validate the source system before acting on the hash, then compare it with approved forensic or threat-intelligence workflows.",
  ]
    .filter(Boolean)
    .join("\n");

const formatDorkResponse = (result) =>
  [
    "Focused cyber analysis",
    "",
    `Target: ${result.target}`,
    `Category: ${result.category}`,
    `Query: ${result.query}`,
    "",
    "Why this matters",
    result.explanation,
    "",
    "Defensive follow-up",
    result.defensiveAdvice,
  ].join("\n");

const formatHeadersResponse = (result) =>
  [
    "Focused cyber analysis",
    "",
    `Target: ${result.url}`,
    `Status: ${result.statusCode}`,
    `Risk score: ${result.riskScore}/100`,
    result.missing?.length ? `Missing controls: ${result.missing.join(", ")}` : "Missing controls: none detected",
    "",
    "Recommendations",
    ...(result.recommendations || []).map((item) => `- ${item}`),
  ].join("\n");

const formatSubdomainResponse = (result) =>
  [
    "Focused cyber analysis",
    "",
    `Target: ${result.target}`,
    "Likely external surface",
    ...(result.subdomains || []).slice(0, 8).map((entry) => `- ${entry.hostname} (${entry.exposure}, confidence ${entry.confidence}%)`),
    "",
    "Defensive follow-up",
    ...(result.defensiveAdvice || []).map((item) => `- ${item}`),
  ].join("\n");

const formatAttachmentResponse = (result) =>
  [
    "Attachment analysis",
    "",
    `File: ${result.filename}`,
    `Detected type: ${result.inferredMime || result.mimeType}`,
    `Size: ${Math.round(Number(result.size || 0) / 1024)} KB`,
    result.metadataTags?.length ? `Metadata tags: ${result.metadataTags.join(", ")}` : "Metadata tags: none detected",
    result.privacyRisks?.length ? `Privacy risks: ${result.privacyRisks.join("; ")}` : "Privacy risks: none detected",
    "",
    "Defensive follow-up",
    ...(result.defensiveAdvice || []).map((item) => `- ${item}`),
  ].join("\n");

const buildCyberModule = async ({ actor, query, attachments = [] }) => {
  const lower = normalizeText(query).toLowerCase();
  const attachment = attachments[0] || null;
  if (attachment) {
    const result = await runToolMetadataUploadAnalyze(actor, attachment);
    const module = {
      id: "attachment-module",
      title: "Attachment analysis",
      summary: [
        `- File: ${result.filename}`,
        `- Detected type: ${result.inferredMime || result.mimeType}`,
        `- Risks: ${(result.privacyRisks || []).join("; ") || "none detected"}`,
        "- Attachment processed and available for the reply path.",
      ].join("\n"),
      data: result,
    };

    if (/(attach|attachment|file|document|image|pdf|metadata|upload|analy[sz]e this|summari[sz]e this|review this)/i.test(lower)) {
      return {
        ...module,
        directAnswer: formatAttachmentResponse(result),
      };
    }

    return module;
  }

  if (/google dork|dork/i.test(lower)) {
    const domain = extractDomain(query);
    if (domain) {
      const result = await runToolDorkBuilder(actor, { target: domain, category: "File exposure" });
      return {
        id: "cyber-analysis-module",
        title: "Dork builder",
        summary: `- Generated a defensive dork pattern for ${result.target}\n- Category: ${result.category}`,
        directAnswer: formatDorkResponse(result),
        data: result,
      };
    }
  }

  if (/header|security header|response header/i.test(lower)) {
    const url = extractUrl(query);
    if (url) {
      const result = await runToolHeadersFromUrl(actor, url);
      return {
        id: "cyber-analysis-module",
        title: "Header analysis",
        summary: `- Header scan target: ${result.url}\n- Risk score: ${result.riskScore}/100`,
        directAnswer: formatHeadersResponse(result),
        data: result,
      };
    }
  }

  if (/subdomain|recon|enumeration|attack surface/i.test(lower)) {
    const domain = extractDomain(query);
    if (domain) {
      const result = await runToolSubdomainRecon(actor, domain);
      return {
        id: "cyber-analysis-module",
        title: "Verified recon unavailable",
        summary: `- Target: ${domain}\n- No verified data.`,
        directAnswer: formatSubdomainResponse(result),
        data: result,
      };
    }
  }

  if (/hash|sha|md5|bcrypt|digest/i.test(lower) || extractHashCandidate(query)) {
    const hash = extractHashCandidate(query);
    if (hash) {
      const result = await runToolHashIdentify(actor, hash);
      return {
        id: "cyber-analysis-module",
        title: "Hash identification",
        summary: `- Likely hash type: ${result.algorithm}\n- Confidence: ${Math.round(Number(result.confidence || 0) * 100)}%`,
        directAnswer: formatHashResponse(result),
        data: result,
      };
    }
  }

  return null;
};

const buildToolContext = (modules = []) => {
  const blocks = modules
    .filter((module) => module?.summary)
    .map((module) => `### ${module.title}\n${module.summary}`)
    .join("\n\n")
    .trim();
  if (!blocks) return "";
  return `Workspace intelligence:\n${blocks}`.slice(0, 2600);
};

const buildAttachmentContext = (analysis = null) => {
  if (!analysis?.promptContext) return "";
  return `Attachment context:\n${analysis.promptContext}`.slice(0, 2400);
};

const injectToolContext = (messages = [], toolContext = "") => {
  if (!toolContext.trim()) return messages;
  let patched = false;
  const next = [...messages];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const message = next[index];
    if (message?.role !== "user") continue;
    next[index] = {
      ...message,
      content: `${message.content}\n\n[System context for assistant]\n${toolContext}\n[/System context for assistant]`,
    };
    patched = true;
    break;
  }
  return patched ? next : messages;
};

const injectAttachmentContext = (messages = [], attachmentContext = "") => {
  if (!attachmentContext.trim()) return messages;
  let patched = false;
  const next = [...messages];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const message = next[index];
    if (message?.role !== "user") continue;
    if (String(message.content || "").includes("[Attachment context]")) {
      patched = true;
      break;
    }
    next[index] = {
      ...message,
      content: `${message.content}\n\n[Attachment context]\n${attachmentContext}\n[/Attachment context]`,
    };
    patched = true;
    break;
  }
  return patched ? next : messages;
};

const chunkText = (text = "") =>
  String(text || "")
    .match(/.{1,84}(?:\s+|$)/g)
    ?.map((chunk) => chunk)
    .filter(Boolean) || [String(text || "")];

export const getToolEngineMeta = () => TOOL_ENGINE_META;

export const prepareAiRequest = async (payload = {}) => {
  const query = lastUserMessage(payload.messages || []);
  const actor = buildActor({ userId: payload.userId || null, sessionId: payload.sessionId || "anonymous" });
  const attachments = Array.isArray(payload.attachments) ? payload.attachments.slice(0, 1) : [];
  const topicTitle = String(payload.topic?.title || "").trim();
  const aiRoute = payload.aiRoute || selectAiRoute({ messages: payload.messages || [], attachments, topic: payload.topic });
  const attachmentAnalysis = payload.attachmentAnalysis || (attachments.length ? await analyzeAttachments(attachments) : null);
  const toolScope = new Set(aiRoute?.toolIds || []);

  const moduleTasks = [
    { id: "search-module", run: () => buildSearchModule({ query }) },
    { id: "research-module", run: () => buildResearchModule({ query, topicTitle }) },
    { id: "learning-assistant-module", run: () => buildLearningModule({ actor, query }) },
    { id: "cyber-analysis-module", run: () => buildCyberModule({ actor, query, attachments }) },
  ].filter((task) => toolScope.size === 0 || toolScope.has(task.id));

  const withTimeout = async (task) => {
    let timer = null;
    try {
      return await Promise.race([
        task.run(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error("tool_module_timeout");
            error.code = "tool_module_timeout";
            reject(error);
          }, TOOL_MODULE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  const settled = await Promise.allSettled(
    moduleTasks.map(async (task) => {
      const result = await withTimeout(task);
      return result ? { ...result, taskId: task.id } : null;
    })
  );

  const modules = [];
  for (let index = 0; index < settled.length; index += 1) {
    const outcome = settled[index];
    if (outcome.status === "fulfilled") {
      if (outcome.value) modules.push(outcome.value);
      continue;
    }
    logWarn("Tool engine module failed", {
      module: moduleTasks[index]?.id || "unknown",
      reason: String(outcome.reason?.message || outcome.reason || "tool_failed"),
      requestId: payload.correlationId || "",
    });
  }

  const direct = modules.find((module) => module?.directAnswer)?.directAnswer || "";
  if (direct) {
    return {
      mode: "direct",
      text: direct,
      modules,
      aiRoute,
      attachmentAnalysis,
    };
  }

  const toolContext = buildToolContext(modules);
  const attachmentContext = buildAttachmentContext(attachmentAnalysis);
  const patchedMessages = injectToolContext(
    injectAttachmentContext(payload.messages || [], attachmentContext),
    toolContext
  );
  return {
    mode: "llm",
    payload: {
      ...payload,
      messages: patchedMessages,
      aiRoute,
      attachmentAnalysis,
    },
    modules,
    toolContext,
    attachmentAnalysis,
    aiRoute,
  };
};

export const streamPreparedText = async (text = "", { onDelta, shouldStop } = {}) => {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    if (shouldStop && (await shouldStop())) return;
    if (chunk) await onDelta?.(chunk);
    await new Promise((resolve) => setTimeout(resolve, 18));
  }
};
