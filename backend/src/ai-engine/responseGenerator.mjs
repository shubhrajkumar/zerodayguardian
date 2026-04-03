import { formatAssistantResponse } from "../services/responseFormatterV2.js";

const RESPONSE_GUIDE_VERSION = "zorvix-response-v5";

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
    "Keep the response structured, clear, concise, human, and high-value.",
    "Analyze intent deeply before drafting the response.",
    "Optimize for mobile readability with short lines and compact sections.",
    "Lead with the clearest answer first, then support it with short useful bullets.",
    "Prefer this structure when relevant: bold title, one short summary, Next Action, Risk, Validation, then 2 to 4 short bullets.",
    "Treat this as a continuing conversation, not a one-off answer.",
    "Use memory and earlier context when they improve continuity, but do not restate them unless needed.",
    "Refine the answer based on what has already been explained. Add net-new value.",
    "Default shape for technical questions: quick answer, next action, risk, validation.",
    "Use flat bullets only. Do not nest bullets.",
    "Use practical guidance and explain why it matters without filler.",
    "Avoid generic OWASP summaries unless explicitly requested.",
    "Avoid repeating previous response structure or phrasing; vary naturally.",
    "If a better answer needs a small caveat, state it briefly instead of hedging excessively.",
    "Avoid repetition and do not restate the same point in different words.",
    "Prefer one smart summary over repeating similar bullets.",
    "For mission or mentor contexts, sound like a calm senior operator rather than a generic chatbot.",
    "If the user is deciding something, explicitly say what is right, what is risky, and what validates the choice.",
    "Use bold only for the most important conclusions or terms.",
    "Use meaningful emojis sparingly when they improve clarity or tone.",
    "Never invent facts or imply verified data when it is unavailable.",
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
    ? "The live provider is unavailable, so this answer uses local workspace context only."
    : "The live provider is unavailable, so this answer uses local workspace context only.";

  const contextLines = [
    topic ? `- Active topic: ${topic}` : "",
    request ? `- Request focus: ${request}` : "",
    !findings.length ? "- Local modules did not return a specialized match, so this response is based on the active prompt context." : "",
  ].filter(Boolean);

  const raw = [
    "ZORVIX Local Fallback",
    "",
    intro,
    "",
    "Current context",
    ...contextLines,
    "",
    "Operational signals",
    ...(findings.length ? findings.map((item) => `- ${item}`) : ["- No verified module findings were available for this request."]),
    "",
    "Next Action",
    actionSteps[0] ? `- ${actionSteps[0]}` : "- Clarify the exact outcome you want before acting.",
    "",
    "Validation",
    actionSteps[1] ? `- ${actionSteps[1]}` : "- Confirm the decision against the strongest available evidence.",
    "",
    "Follow-through",
    ...(actionSteps.slice(2).length ? actionSteps.slice(2).map((item) => `- ${item}`) : ["- Ask for a narrower follow-up if you want a more precise fallback answer."]),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
  return formatAssistantResponse({ text: raw, mode: payload.aiRoute?.mode || "operator" });
};

export const normalizeAssistantReply = (text = "", fallbackText = "", mode = "general") => {
  const cleaned = String(text || "").replace(/\0/g, "").trim();
  if (cleaned) return formatAssistantResponse({ text: cleaned, mode, variantSeed: cleaned.slice(0, 120) });
  return formatAssistantResponse({
    text: String(fallbackText || "").replace(/\0/g, "").trim(),
    mode,
    variantSeed: "fallback",
  });
};
