import { env } from "../config/env.mjs";
import { requestLlm, requestLlmStream } from "../services/llmService.mjs";
import { recordAiRequest } from "../services/monitoringService.mjs";
import { recordRecoveryResponse, recoverFromError } from "../services/systemRecovery.js";
import { prepareAiRequest, streamPreparedText } from "../tools/engine.mjs";
import { buildLocalFallbackReply, normalizeAssistantReply, prepareResponsePayload } from "./responseGenerator.mjs";
import { resolveJsonKnowledgeReply } from "../services/jsonKnowledgeBase.mjs";
import { getHybridCachedResponse, setHybridCachedResponse, withHybridInFlightResponse } from "../services/hybridResponseCache.mjs";

const buildEmergencyText = (payload = {}) => {
  const prompt = [...(payload.messages || [])].reverse().find((message) => message?.role === "user")?.content || "";
  if (!prompt.trim()) {
    return "Zorvix is ready. Ask a cybersecurity, debugging, or learning question and I will respond clearly.";
  }
  return [
    "Your request was received.",
    "The live model is temporarily unavailable, so I could not generate a full answer.",
    "Retry in a moment. If this persists, verify provider connectivity, credentials, and quota limits.",
  ].join(" ");
};
const lastUserPrompt = (payload = {}) =>
  [...(payload.messages || [])].reverse().find((message) => message?.role === "user")?.content || "";

export const inspectAiPipeline = async (payload = {}) => {
  const prepared = await prepareAiRequest(payload);
  const query = lastUserPrompt(prepared.payload || payload);
  const knowledgeReply = resolveJsonKnowledgeReply({ query });
  const cachedText = getHybridCachedResponse({ payload: prepared.payload || payload });
  return {
    mode: prepared.mode,
    query,
    source: knowledgeReply?.text ? "knowledge_db" : cachedText ? "cache" : env.forceLocalFallback || payload.forceLocalFallback ? "local_fallback" : "ollama",
    knowledgeMatched: Boolean(knowledgeReply?.text),
    cacheHit: Boolean(cachedText),
    directPrepared: prepared.mode === "direct",
    routeMode: prepared?.aiRoute?.mode || payload?.aiRoute?.mode || "general",
  };
};

export const executeAiPipeline = async (payload = {}) => {
  const prepared = await prepareAiRequest(payload);
  const fallbackText = buildEmergencyText(payload);
  const responseMode = prepared?.aiRoute?.mode || payload?.aiRoute?.mode || "general";
  const localFallbackText = buildLocalFallbackReply({
    payload: prepared.payload || payload,
    modules: prepared.modules || [],
  });
  const startedAt = Date.now();
  const query = lastUserPrompt(prepared.payload || payload);
  const knowledgeReply = resolveJsonKnowledgeReply({ query });

  if (prepared.mode === "direct") {
    return {
      text: normalizeAssistantReply(prepared.text, fallbackText, responseMode),
      source: "tool_direct",
    };
  }
  if (knowledgeReply?.text) {
    setHybridCachedResponse({ payload: prepared.payload || payload, text: knowledgeReply.text });
    return {
      text: normalizeAssistantReply(knowledgeReply.text, fallbackText, responseMode),
      source: "knowledge_db",
    };
  }
  const cachedText = getHybridCachedResponse({ payload: prepared.payload || payload });
  if (cachedText) {
    return {
      text: normalizeAssistantReply(cachedText, fallbackText, responseMode),
      source: "cache",
    };
  }
  if (env.forceLocalFallback || payload.forceLocalFallback) {
    return {
      text: normalizeAssistantReply(localFallbackText, fallbackText, responseMode),
      source: "local_fallback",
    };
  }

  const responsePayload = prepareResponsePayload({
    payload: prepared.payload,
    modules: prepared.modules,
    memoryContext: payload.memoryContext || "",
    knowledgeContext: payload.knowledgeContext || "",
  });
  try {
    const text = await withHybridInFlightResponse({
      payload: responsePayload,
      factory: () => requestLlm(responsePayload),
    });
    recordRecoveryResponse({ payload: responsePayload, text });
    setHybridCachedResponse({ payload: responsePayload, text });
    await recordAiRequest({
      requestId: responsePayload.correlationId || "",
      userId: responsePayload.userId || null,
      sessionId: responsePayload.sessionId || null,
      mode: responseMode,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      promptSummary: responsePayload.messages?.slice(-1)?.[0]?.content || "",
    });
    return {
      text: normalizeAssistantReply(text, fallbackText, responseMode),
      source: "ollama",
    };
  } catch (error) {
    const recovery = await recoverFromError({ error, payload: responsePayload, fallbackText: localFallbackText });
    if (recovery?.text) {
      await recordAiRequest({
        requestId: responsePayload.correlationId || "",
        userId: responsePayload.userId || null,
        sessionId: responsePayload.sessionId || null,
        mode: responseMode,
        status: recovery.source || "recovered",
        latencyMs: Date.now() - startedAt,
        promptSummary: responsePayload.messages?.slice(-1)?.[0]?.content || "",
      });
      return {
        text: normalizeAssistantReply(recovery.text, fallbackText, responseMode),
        source: recovery.source || "local_fallback",
      };
    }
    error.localFallbackText = normalizeAssistantReply(localFallbackText, fallbackText, responseMode);
    throw error;
  }
};

export const streamAiPipeline = async (payload = {}) => {
  const prepared = await prepareAiRequest(payload);
  const fallbackText = buildEmergencyText(payload);
  const responseMode = prepared?.aiRoute?.mode || payload?.aiRoute?.mode || "general";
  const localFallbackText = buildLocalFallbackReply({
    payload: prepared.payload || payload,
    modules: prepared.modules || [],
  });
  const query = lastUserPrompt(prepared.payload || payload);
  const knowledgeReply = resolveJsonKnowledgeReply({ query });

  if (prepared.mode === "direct") {
    await streamPreparedText(normalizeAssistantReply(prepared.text, fallbackText, responseMode), payload);
    return;
  }
  if (knowledgeReply?.text) {
    setHybridCachedResponse({ payload: prepared.payload || payload, text: knowledgeReply.text });
    await streamPreparedText(normalizeAssistantReply(knowledgeReply.text, fallbackText, responseMode), payload);
    return;
  }
  const cachedText = getHybridCachedResponse({ payload: prepared.payload || payload });
  if (cachedText) {
    await streamPreparedText(normalizeAssistantReply(cachedText, fallbackText, responseMode), payload);
    return;
  }
  if (env.forceLocalFallback || payload.forceLocalFallback) {
    await streamPreparedText(normalizeAssistantReply(localFallbackText, fallbackText, responseMode), payload);
    return;
  }

  const responsePayload = prepareResponsePayload({
    payload: prepared.payload,
    modules: prepared.modules,
    memoryContext: payload.memoryContext || "",
    knowledgeContext: payload.knowledgeContext || "",
  });
  try {
    return await requestLlmStream(responsePayload);
  } catch (error) {
    const recovery = await recoverFromError({ error, payload: responsePayload, fallbackText: localFallbackText });
    error.localFallbackText = normalizeAssistantReply(recovery?.text || localFallbackText, fallbackText, responseMode);
    throw error;
  }
};
