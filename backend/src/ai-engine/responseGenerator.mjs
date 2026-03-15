import { formatAssistantResponse } from "../services/responseFormatter.js";

const RESPONSE_GUIDE_VERSION = "zorvix-response-v2";

const lastUserMessage = (messages = []) =>
  [...messages].reverse().find((message) => message?.role === "user")?.content || "";

const trimText = (value = "", max = 2600) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const listFromSummary = (value = "") =>
  String(value || "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);

const uniqueItems = (items = []) => [...new Set(items.filter(Boolean))];

const buildResponseGuide = ({ payload, modules = [], memoryContext = "", knowledgeContext = "" }) => {
  const request = trimText(lastUserMessage(payload.messages || []), 280);
  const topic = trimText(payload.topic?.title || "", 120);
  const audience = trimText(payload.assistantProfile?.audience || "general", 40);
  const style = trimText(payload.assistantProfile?.style || "balanced", 40);
  const moduleList = modules.map((module) => trimText(module?.title || module?.id || "", 48)).filter(Boolean);
  const memory = trimText(memoryContext || "", 800);
  const knowledge = trimText(knowledgeContext || "", 800);
  const routeMode = trimText(payload.aiRoute?.mode || "general", 40);
  const attachmentContext = trimText(payload.attachmentAnalysis?.promptContext || "", 1200);

  return [
    `Response blueprint version: ${RESPONSE_GUIDE_VERSION}.`,
    "Reply as Zorvix, the Zero Day Guardian assistant.",
    "Always return a visible answer even if parts of the system are degraded.",
    "Keep the response structured, clear, and educational.",
    "Follow the format: Title, short explanation, bullets, optional steps, helpful tip.",
    "Default shape for technical questions: Direct answer, Key findings, Action steps.",
    "Prefer short paragraphs and flat bullets.",
    "Use practical guidance and explain why it matters.",
    `Active mode: ${routeMode}.`,
    topic ? `Active topic: ${topic}.` : "",
    request ? `User request: ${request}.` : "",
    moduleList.length ? `Available workspace modules: ${moduleList.join(", ")}.` : "",
    attachmentContext ? `Attachment context:\n${attachmentContext}` : "",
    memory ? `User memory context:\n${memory}` : "",
    knowledge ? `Knowledge context:\n${knowledge}` : "",
    `Audience: ${audience}. Detail level: ${style}.`,
  ]
    .filter(Boolean)
    .join("\n");
};

const injectGuideIntoMessages = (messages = [], guide = "") => {
  if (!guide.trim()) return messages;
  let patched = false;
  const next = [...messages];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const message = next[index];
    if (message?.role !== "user") continue;
    next[index] = {
      ...message,
      content: `${String(message.content || "").trim()}\n\n[Response guide]\n${guide}\n[/Response guide]`,
    };
    patched = true;
    break;
  }
  return patched ? next : messages;
};

export const prepareResponsePayload = ({ payload, modules = [], memoryContext = "", knowledgeContext = "" }) => {
  const guide = buildResponseGuide({ payload, modules, memoryContext, knowledgeContext });
  return {
    ...payload,
    messages: injectGuideIntoMessages(payload.messages || [], guide),
  };
};

const deriveLocalActionSteps = ({ request = "", modules = [] }) => {
  const text = String(request || "").toLowerCase();
  const nextStepLine =
    modules
      .flatMap((module) => listFromSummary(module?.summary))
      .find((line) => /^next step:/i.test(line))
      ?.replace(/^next step:\s*/i, "")
      .trim() || "";

  if (/header|domain|dns|subdomain|url|server/i.test(text)) {
    return uniqueItems([
      "Confirm the exact target scope and ownership before testing or validating controls.",
      "Run the domain investigation workspace to inspect headers, exposed surface, and defensive gaps.",
      nextStepLine || "Prioritize missing protections first, then re-test after changes are applied.",
    ]).slice(0, 3);
  }

  if (/code|script|source|function|repository|repo|bug/i.test(text)) {
    return uniqueItems([
      "Attach the code snippet or file so Zorvix can analyze it with the local tool pipeline.",
      "State the runtime, entry point, and the behavior or risk you want reviewed.",
      nextStepLine || "Start with the highest-risk flaw first, then verify the fix with a focused test case.",
    ]).slice(0, 3);
  }

  if (/vulnerab|scan|endpoint|soc|security|threat|malware|incident/i.test(text)) {
    return uniqueItems([
      "Name the affected asset, exposure point, and any observed symptoms or alerts.",
      "Separate confirmed evidence from assumptions before deciding on remediation.",
      nextStepLine || "Work from containment, to verification, to hardening in that order.",
    ]).slice(0, 3);
  }

  if (/learn|practice|lab|explain|teach|guide/i.test(text)) {
    return uniqueItems([
      "Pick one narrow concept or skill target so the walkthrough stays actionable.",
      nextStepLine || "Move from concept, to example, to short practice task.",
      "Ask a follow-up question for the next level of depth once the first step is clear.",
    ]).slice(0, 3);
  }

  return uniqueItems([
    "Clarify the exact outcome you want: explanation, analysis, remediation, or investigation.",
    nextStepLine || "Use the strongest evidence already available in the workspace before expanding scope.",
    "Request a narrower follow-up if you want a more precise local fallback answer.",
  ]).slice(0, 3);
};

export const buildLocalFallbackReply = ({ payload = {}, modules = [] } = {}) => {
  const request = trimText(lastUserMessage(payload.messages || []), 320);
  const topic = trimText(payload.topic?.title || "", 120);
  const findings = uniqueItems(
    modules
      .flatMap((module) => listFromSummary(module?.summary))
      .map((line) => trimText(line, 180))
  ).slice(0, 5);
  const actionSteps = deriveLocalActionSteps({ request, modules });

  const intro = request
    ? "I could not use the live provider, but I can still respond using local workspace intelligence."
    : "I could not use the live provider, but I can still respond using local workspace intelligence.";

  const contextLines = [
    topic ? `- Active topic: ${topic}` : "",
    request ? `- Request focus: ${request}` : "",
    !findings.length ? "- Local modules did not return a specialized match, so this response is based on the active prompt context." : "",
  ].filter(Boolean);

  const raw = [
    "Local fallback response",
    "",
    intro,
    "",
    "Current context",
    ...contextLines,
    "",
    findings.length ? "Available findings" : "Available findings",
    ...(findings.length ? findings.map((item) => `- ${item}`) : ["- No structured module findings were available for this request."]),
    "",
    "Recommended next steps",
    ...actionSteps.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
  return formatAssistantResponse({ text: raw, mode: payload.aiRoute?.mode || "general" });
};

export const normalizeAssistantReply = (text = "", fallbackText = "", mode = "general") => {
  const cleaned = String(text || "").replace(/\0/g, "").trim();
  if (cleaned) return formatAssistantResponse({ text: cleaned, mode });
  return formatAssistantResponse({ text: String(fallbackText || "").replace(/\0/g, "").trim(), mode });
};
