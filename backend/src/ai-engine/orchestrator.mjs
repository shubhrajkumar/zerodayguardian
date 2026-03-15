import { env } from "../config/env.mjs";
import { requestLlm, requestLlmStream } from "../services/llmService.mjs";
import { recordAiRequest } from "../services/monitoringService.mjs";
import { recordRecoveryResponse, recoverFromError } from "../services/systemRecovery.js";
import { prepareAiRequest, streamPreparedText } from "../tools/engine.mjs";
import { buildLocalFallbackReply, normalizeAssistantReply, prepareResponsePayload } from "./responseGenerator.mjs";

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

export const executeAiPipeline = async (payload = {}) => {
  const prepared = await prepareAiRequest(payload);
  const fallbackText = buildEmergencyText(payload);
  const responseMode = prepared?.aiRoute?.mode || payload?.aiRoute?.mode || "general";
  const localFallbackText = buildLocalFallbackReply({
    payload: prepared.payload || payload,
    modules: prepared.modules || [],
  });
  const startedAt = Date.now();

  if (prepared.mode === "direct") {
    return normalizeAssistantReply(prepared.text, fallbackText, responseMode);
  }
  if (env.forceLocalFallback || payload.forceLocalFallback) {
    return normalizeAssistantReply(localFallbackText, fallbackText, responseMode);
  }

  const responsePayload = prepareResponsePayload({
    payload: prepared.payload,
    modules: prepared.modules,
    memoryContext: payload.memoryContext || "",
    knowledgeContext: payload.knowledgeContext || "",
  });
  try {
    const text = await requestLlm(responsePayload);
    recordRecoveryResponse({ payload: responsePayload, text });
    await recordAiRequest({
      requestId: responsePayload.correlationId || "",
      userId: responsePayload.userId || null,
      sessionId: responsePayload.sessionId || null,
      mode: responseMode,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      promptSummary: responsePayload.messages?.slice(-1)?.[0]?.content || "",
    });
    return normalizeAssistantReply(text, fallbackText, responseMode);
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
      return normalizeAssistantReply(recovery.text, fallbackText, responseMode);
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

  if (prepared.mode === "direct") {
    await streamPreparedText(normalizeAssistantReply(prepared.text, fallbackText, responseMode), payload);
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
