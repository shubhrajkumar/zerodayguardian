import { classifyAiError } from "../ai-engine/index.mjs";
import { detectProviderOutage } from "./aiProviders.js";
import { logWarn } from "../utils/logger.mjs";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 120;
const RESPONSE_CACHE = new Map();

const now = () => Date.now();

const trim = (value = "", max = 800) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const buildSignature = (payload = {}) => {
  const lastMessage = [...(payload.messages || [])].reverse().find((message) => message?.role === "user")?.content || "";
  const topicTitle = payload.topic?.title || "";
  const attachments = payload.attachmentAnalysis?.items || [];
  const attachmentKey = attachments.map((item) => item?.fingerprint || item?.filename || "").join("|");
  const mode = payload.aiRoute?.mode || "general";
  const key = [trim(lastMessage, 400), trim(topicTitle, 80), trim(attachmentKey, 120), mode].filter(Boolean).join("::");
  return key || "";
};

const pruneCache = () => {
  if (RESPONSE_CACHE.size <= CACHE_MAX) return;
  const oldest = RESPONSE_CACHE.keys().next().value;
  if (oldest) RESPONSE_CACHE.delete(oldest);
};

export const recordRecoveryResponse = ({ payload, text }) => {
  const key = buildSignature(payload);
  if (!key || !text) return;
  RESPONSE_CACHE.set(key, { text: String(text || "").trim(), createdAt: now() });
  pruneCache();
};

export const getCachedResponse = ({ payload }) => {
  const key = buildSignature(payload);
  if (!key) return "";
  const cached = RESPONSE_CACHE.get(key);
  if (!cached) return "";
  if (now() - cached.createdAt > CACHE_TTL_MS) {
    RESPONSE_CACHE.delete(key);
    return "";
  }
  return cached.text;
};

export const buildFriendlyRecoveryMessage = async (error, fallbackText = "") => {
  const failure = classifyAiError(error);
  const outage = await detectProviderOutage();
  const hint = outage
    ? "Live providers are temporarily unavailable, so Zorvix is using cached context when possible."
    : "Live providers are temporarily busy. Please retry in a moment.";
  const retry = failure.retryable === false ? "A backend configuration fix is required." : "Retry in a moment.";
  return [hint, failure.code ? `Reason: ${failure.code}.` : "", retry].filter(Boolean).join(" ") || fallbackText;
};

export const recoverFromError = async ({ error, payload, fallbackText = "" } = {}) => {
  const cached = getCachedResponse({ payload });
  if (cached) {
    logWarn("System recovery using cached response", { reason: "cache_hit" });
    return { text: cached, source: "cache" };
  }
  const friendly = await buildFriendlyRecoveryMessage(error, fallbackText);
  return { text: friendly, source: "friendly" };
};
