import { Router } from "express";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { env } from "../../src/config/env.mjs";
import { validateBody } from "../../src/middleware/validate.mjs";
import {
  chatSchema,
  chatStreamSchema,
  historyClearSchema,
  historyDeleteSessionSchema,
  labRunSchema,
  preferencesSchema,
  previewSchema,
  topicSchema,
} from "../../src/validators/neurobotSchemas.mjs";
import { sanitizeText } from "../../src/utils/security.mjs";
import { formatAssistantResponse } from "../../src/services/responseFormatterV2.js";
import {
  appendAssistantOnly,
  clearConversationHistory,
  appendMessages,
  deleteConversationSession,
  getOrCreateConversation,
  listConversationSessions,
  updateAssistantProfile,
  updateTopic,
} from "../../src/services/conversationService.mjs";
import { classifyAiError, inspectAiRoute, routeAiRequest, routeAiStreamRequest, verifyAiEngine } from "../../src/ai-engine/index.mjs";
import {
  abortStreamGeneration,
  appendStreamToken,
  completeStreamCheckpoint,
  createStreamCheckpoint,
  failStreamCheckpoint,
  getStreamCheckpoint,
  isStreamGenerating,
  hasStreamStore,
  replayEventsAfter,
  startStreamGenerator,
} from "../../src/services/streamService.mjs";
import { incMetric, observeMetric, withSpan } from "../../src/observability/telemetry.mjs";
import { sendAlert } from "../../src/observability/alerts.mjs";
import { logError, logInfo, logWarn } from "../../src/utils/logger.mjs";
import { executeSandboxCommand, getSandboxLabs } from "../../src/labs/index.mjs";
import { getDockerSandboxStatus } from "../../services/ai-engine/dockerSandboxService.mjs";
import { synthesizeCalmSpeech } from "../../src/services/ttsService.mjs";
import {
  buildMemoryContext,
  getOrCreateUserProfile,
  getMemoryStats,
  getUserMemorySnapshot,
  recordUploadedFile,
  saveUserPreferences,
  updateUserProfile,
} from "../../src/services/memoryService.mjs";
import { ingestKnowledge, searchKnowledge } from "../../src/services/knowledgeBaseService.mjs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FILE_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "text/x-python",
  "text/x-java-source",
  "text/x-c",
  "text/x-c++",
  "text/x-go",
  "text/x-rust",
  "text/x-shellscript",
  "text/x-php",
  "application/x-php",
  "text/x-ruby",
  "text/x-sql",
  "application/x-yaml",
  "text/yaml",
]);

let sharpLoader = null;
const loadSharp = async () => {
  if (sharpLoader) return sharpLoader;
  sharpLoader = import("sharp")
    .then((mod) => mod.default || mod)
    .catch(() => null);
  return sharpLoader;
};

const isImageMime = (mime = "") => ALLOWED_IMAGE_MIME.has(String(mime || "").toLowerCase());
const isAllowedFileMime = (mime = "") => ALLOWED_FILE_MIME.has(String(mime || "").toLowerCase());

const decodeBase64 = (value = "") => {
  try {
    return Buffer.from(String(value || ""), "base64");
  } catch {
    return null;
  }
};

const optimizeImageAttachment = async (file, actualSize = 0) => {
  const buffer = decodeBase64(file.base64);
  if (!buffer || buffer.length === 0) return file;
  const sharp = await loadSharp();
  if (!sharp) return file;

  let pipeline = sharp(buffer).rotate();
  const metadata = await pipeline.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const needsResize = width > 2000 || height > 2000;
  const needsCompress = actualSize > MAX_IMAGE_BYTES;

  if (!needsResize && !needsCompress) return file;

  if (needsResize) {
    pipeline = pipeline.resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
  }
  const output = await pipeline.webp({ quality: 78 }).toBuffer();
  return {
    ...file,
    mimeType: "image/webp",
    size: output.length,
    base64: output.toString("base64"),
  };
};

const normalizeAttachments = async (attachments = []) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const normalized = [];
  for (const file of attachments) {
    const mime = String(file.mimeType || "").toLowerCase();
    if (!mime) {
      const err = new Error("Attachment mimeType is required.");
      err.status = 400;
      err.code = "invalid_attachment";
      throw err;
    }
    if (!isImageMime(mime) && !isAllowedFileMime(mime)) {
      const err = new Error("Unsupported file type. Please upload a PDF, text file, or JPG/PNG/WEBP image.");
      err.status = 400;
      err.code = "unsupported_file_type";
      throw err;
    }
    const buffer = decodeBase64(file.base64);
    const actualSize = buffer ? buffer.length : Number(file.size || 0) || 0;
    if (!actualSize) {
      const err = new Error("Attachment content is empty or invalid.");
      err.status = 400;
      err.code = "invalid_attachment";
      throw err;
    }
    if (actualSize > MAX_UPLOAD_BYTES) {
      const err = new Error("Attachment too large. Max size is 25MB.");
      err.status = 413;
      err.code = "attachment_too_large";
      throw err;
    }
    let next = file;
    if (isImageMime(mime)) {
      next = await optimizeImageAttachment(file, actualSize);
      if (Number(next.size || 0) > MAX_UPLOAD_BYTES) {
        const err = new Error("Attachment too large after compression.");
        err.status = 413;
        err.code = "attachment_too_large";
        throw err;
      }
    }
    normalized.push({ ...next, size: Number(next.size || actualSize) });
  }
  return normalized;
};

const router = Router();
const STREAM_SESSION_TIMEOUT_MS = 30000;
const STREAM_POLL_MS = 120;
const withTimeout = async (promise, timeoutMs, code = "timeout") => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(code);
          error.code = code;
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const resolveUserTier = (req) =>
  req?.user?.tier === "premium" || req?.user?.plan === "premium" || req?.user?.role === "premium"
    ? "premium"
    : "free";
const AUTO_LOCAL_FALLBACK_MIN_MS = 15_000;
const AUTO_LOCAL_FALLBACK_MAX_MS = 5 * 60_000;
let autoLocalFallbackUntil = 0;
let autoFallbackProbeInFlight = null;
let autoFallbackLastProbeAt = 0;
const AUTO_FALLBACK_PROBE_INTERVAL_MS = 5000;
const autoLocalFallbackRetryAfterSec = () => {
  const remainingMs = autoLocalFallbackUntil - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};
const autoLocalFallbackActive = () => env.allowLlmFallback && autoLocalFallbackRetryAfterSec() > 0;
const activateAutoLocalFallback = (error = null) => {
  if (!env.allowLlmFallback || env.forceLocalFallback) return false;
  const failure = classifyAiError(error);
  if (String(failure.code || "") !== "rate_limit") return false;
  const retryAfterSec = Number(error?.retryAfterSec || 0) || 30;
  const cooldownMs = Math.max(
    AUTO_LOCAL_FALLBACK_MIN_MS,
    Math.min(AUTO_LOCAL_FALLBACK_MAX_MS, Math.floor(retryAfterSec * 1000))
  );
  autoLocalFallbackUntil = Math.max(autoLocalFallbackUntil, Date.now() + cooldownMs);
  return true;
};
const maybeRecoverAutoLocalFallback = async (requestId = "") => {
  if (!autoLocalFallbackActive()) return false;
  const now = Date.now();
  if (autoFallbackProbeInFlight) return false;
  if (now - autoFallbackLastProbeAt < AUTO_FALLBACK_PROBE_INTERVAL_MS) return false;

  autoFallbackLastProbeAt = now;
  autoFallbackProbeInFlight = (async () => {
    try {
      await verifyAiEngine({
        timeoutMs: Math.max(2000, Math.min(9000, Number(env.llmHealthProbeTimeoutMs || 5000))),
      });
      autoLocalFallbackUntil = 0;
      logWarn("Recovered from auto local fallback mode", { requestId, source: "rate_limit_recovery_probe" });
      return true;
    } catch {
      return false;
    } finally {
      autoFallbackProbeInFlight = null;
    }
  })();

  return autoFallbackProbeInFlight;
};
const fallbackAllowed = () => env.allowLlmFallback || env.forceLocalFallback || autoLocalFallbackActive();
const forcedLocalFallback = () => env.forceLocalFallback || autoLocalFallbackActive();
const streamRetryHintMs = () => {
  const min = Math.max(500, Number(env.streamRetryMinMs || 1200));
  const max = Math.max(min, Number(env.streamRetryMaxMs || 3800));
  return min + Math.floor(Math.random() * (max - min + 1));
};
const formatRetryAfter = (seconds = 0) => {
  const safe = Math.max(0, Number(seconds || 0));
  if (!safe) return "";
  return `${Math.max(1, Math.ceil(safe))}s`;
};
const extractAttachmentText = (file = {}) => {
  const mime = String(file.mimeType || "").toLowerCase();
  if (!mime) return "";
  const textLike =
    mime.startsWith("text/") ||
    /json|xml|yaml|yml|csv|markdown|md/.test(mime) ||
    mime === "application/json";
  if (!textLike) return "";
  try {
    const raw = Buffer.from(String(file.base64 || ""), "base64").toString("utf8");
    return raw.replace(/\0/g, "").slice(0, 2000);
  } catch {
    return "";
  }
};
const ingestAttachmentKnowledge = async ({ userId = null, sessionId = null, file = {} } = {}) => {
  const text = extractAttachmentText(file);
  if (!text) return;
  await ingestKnowledge({
    userId,
    sessionId,
    source: "upload",
    text,
    metadata: { tags: ["upload", String(file.mimeType || "")] },
  });
};
const buildLlmFailureState = (error = null) => {
  const failure = classifyAiError(error);
  const explicitCode = String(error?.code || "").toLowerCase();
  const hasLocalFallbackText = String(error?.localFallbackText || "").trim().length > 0;
  const preferredCodes = new Set([
    "service_busy",
    "forced_local_fallback",
    "timeout",
    "rate_limit",
    "circuit_open",
    "auth",
    "env",
    "invalid_model",
    "dns",
    "network",
    "firewall",
    "bad_request",
    "invalid_request",
  ]);
  let code = preferredCodes.has(explicitCode) ? explicitCode : String(failure.code || explicitCode || "llm_unavailable");
  if (!code || code === "llm_unavailable" || code === "unknown") {
    code = hasLocalFallbackText ? "service_busy" : "llm_unavailable";
  } else if (hasLocalFallbackText && code === "upstream_unclassified") {
    code = "service_busy";
  }
  const provider = String(error?.provider || failure.provider || "");
  const statusCode = failure.statusCode || Number(error?.statusCode || error?.status || 0) || 0;
  const retryAfterSec = Number(error?.retryAfterSec || 0) || null;
  const retryable = failure.retryable !== false;
  const providerHint = provider ? ` Provider: ${provider}.` : "";
  const retryHint = retryAfterSec
    ? `Retry in about ${formatRetryAfter(retryAfterSec)}.`
    : retryable
      ? "Retry in a moment."
      : "A backend configuration fix is required before live generation can recover.";

  if (code === "forced_local_fallback") {
    const autoRetrySec = Number(retryAfterSec || 0) || 0;
    const autoMode = !env.forceLocalFallback && autoRetrySec > 0;
    return {
      code,
      title: "Local fallback mode active",
      detail: autoMode
        ? "Zorvix temporarily switched to local fallback while the AI provider recovers from rate limiting."
        : "Outbound AI provider calls are bypassed, so Zorvix is responding in local fallback mode.",
      provider: provider || "local",
      retryable: false,
      retryAfterSec: autoMode ? autoRetrySec : null,
      retryHint: autoMode
        ? `Live provider retry in about ${formatRetryAfter(autoRetrySec)}.`
        : "Disable FORCE_LOCAL_FALLBACK to resume live model generation.",
      statusCode: 0,
    };
  }

  if (code === "service_busy") {
    return {
      code,
      title: hasLocalFallbackText ? "Temporary provider issue" : "Temporary provider issue",
      detail: hasLocalFallbackText
        ? "Live AI providers were busy, so ZORVIX answered using local workspace intelligence."
        : "Live providers are busy right now, so ZORVIX switched to stable local mentor intelligence instead of returning unstable output.",
      provider: "local",
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Live provider retry in about ${formatRetryAfter(retryAfterSec)}.` : "Live provider retry will resume automatically.",
      statusCode: statusCode || 503,
    };
  }

  if (code === "timeout") {
    return {
      code,
      title: "Temporary response delay",
      detail: `The live model took longer than expected, so Zorvix paused the reply to keep the result reliable.${providerHint}`.trim(),
      provider,
      retryable,
      retryAfterSec,
      retryHint: retryAfterSec ? `Retry in about ${formatRetryAfter(retryAfterSec)}.` : "Retry in a moment or ask a shorter follow-up.",
      statusCode,
    };
  }
  if (code === "rate_limit") {
    return {
      code,
      title: hasLocalFallbackText ? "Provider quota or rate limit reached" : "Provider temporarily unavailable",
      detail: hasLocalFallbackText
        ? `The AI provider is currently throttling or out of quota, so Zorvix replied using local fallback intelligence.${providerHint}`.trim()
        : `The AI provider is currently throttling requests, so live generation is temporarily limited.${providerHint}`.trim(),
      provider,
      retryable,
      retryAfterSec,
      retryHint,
      statusCode,
    };
  }
  if (code === "circuit_open") {
    return {
      code,
      title: "All providers temporarily unavailable",
      detail: `The configured AI providers are in recovery after recent failures.${providerHint}`.trim(),
      provider,
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Retry in about ${formatRetryAfter(retryAfterSec)}.` : "Retry in a moment while providers recover.",
      statusCode,
    };
  }
  if (code === "auth" || code === "env") {
    return {
      code,
      title: "AI provider configuration issue",
      detail: `The configured API key or provider settings are invalid for live generation.${providerHint}`.trim(),
      provider,
      retryable: false,
      retryAfterSec: null,
      retryHint: "Check the backend API key, endpoint, and provider configuration.",
      statusCode,
    };
  }
  if (code === "invalid_model") {
    return {
      code,
      title: "Invalid AI model configuration",
      detail: `The configured model or endpoint is not valid for the selected provider.${providerHint}`.trim(),
      provider,
      retryable: false,
      retryAfterSec: null,
      retryHint: "Update the configured model or provider endpoint and retry.",
      statusCode,
    };
  }
  if (["dns", "network", "firewall"].includes(code)) {
    return {
      code,
      title: "Provider network issue",
      detail: `Zorvix could not reach the AI provider over the network path.${providerHint}`.trim(),
      provider,
      retryable,
      retryAfterSec,
      retryHint,
      statusCode,
    };
  }
  if (code === "bad_request" || code === "invalid_request") {
    return {
      code,
      title: "Invalid request",
      detail: "The request payload was rejected before generation could begin.",
      provider,
      retryable: false,
      retryAfterSec: null,
      retryHint: "Adjust the request payload and try again.",
      statusCode,
    };
  }
  if (code === "upstream" || code === "upstream_unclassified" || code.startsWith("upstream_") || code === "llm_unavailable") {
    return {
      code,
      title: "Provider temporarily unavailable",
      detail: `The AI provider could not complete this request right now.${providerHint}`.trim(),
      provider,
      retryable: true,
      retryAfterSec,
      retryHint: retryAfterSec ? `Retry in about ${formatRetryAfter(retryAfterSec)}.` : "Retry in a moment.",
      statusCode,
    };
  }
  return {
    code,
    title: "Provider temporarily unavailable",
    detail: `The AI provider could not complete this request right now.${providerHint}`.trim(),
    provider,
    retryable,
    retryAfterSec,
    retryHint,
    statusCode,
  };
};
const buildEmergencyAssistantReply = (message = "", topic = null, llmError = null) => {
  const clean = String(message || "").trim();
  const topicTitle = String(topic?.title || "").trim();
  const topicHint = topicTitle ? `Mission context: ${topicTitle}.` : "";
  if (llmError) {
    return formatAssistantResponse({
      text: [
        llmError.title || "ZORVIX recovery mode",
        clean ? "Your request reached ZORVIX." : "The request reached ZORVIX.",
        topicHint,
        "Next action",
        `- ${llmError.detail || "The live provider is unavailable right now."}`,
        "Validation",
        `- ${llmError.retryHint || "Retry in a moment."}`,
      ]
        .filter(Boolean)
        .join("\n"),
      mode: "general",
    });
  }
  if (!clean) {
    return formatAssistantResponse({
      text: ["Temporary issue", "- Zorvix could not reach the AI service.", "- Please retry in a moment."].join("\n"),
      mode: "general",
    });
  }
  return formatAssistantResponse({
    text: [
      "ZORVIX recovery mode",
      "Your request was received.",
      topicHint,
      "Next action",
      "- The live provider is temporarily unavailable, so a full answer could not be generated.",
      "Validation",
      "- Retry in a moment.",
      "- If this keeps happening, check provider connectivity, API key settings, and quota status.",
    ]
      .filter(Boolean)
      .join("\n"),
    mode: "general",
  });
};
const EXECUTION_STYLE_GUIDANCE = [
  "Respond as ZORVIX AI, an elite cybersecurity operator mentor.",
  "Lead with the highest-value next action.",
  "Then explain the key risk, tradeoff, or reasoning.",
  "Include the clearest validation signal, outcome, or evidence check when relevant.",
  "Avoid generic chatbot filler, repetition, and vague motivational text.",
  "Keep the answer crisp, tactical, and directly useful.",
].join(" ");
const LEARNING_STYLE_GUIDANCE =
  "If the user is learning, explain like a calm senior analyst using plain language, short sections, and concrete examples.";
const EVALUATION_STYLE_GUIDANCE =
  "When analyzing a decision, be precise about strengths, misses, risk level, and the optimal next move.";
const buildExecutionTopic = (topic = null, message = "", assistantProfile = null) => {
  const baseTitle = String(topic?.title || "").trim();
  const baseQuery = String(topic?.query || "").trim();
  const tagSet = new Set((Array.isArray(topic?.tags) ? topic.tags : []).map((tag) => String(tag || "").trim()).filter(Boolean));
  const lower = `${baseTitle} ${baseQuery} ${Array.from(tagSet).join(" ")} ${String(message || "")}`.toLowerCase();
  const audience = String(assistantProfile?.audience || "").toLowerCase();
  const shouldShape =
    Boolean(topic) ||
    ["operator", "security_analyst"].includes(audience) ||
    /mentor|mission|lab|program|day\s*\d+|recon|osint|forensics|incident|threat|vulnerability|exploit|ctf|attack|defen|validation|score|debrief/.test(
      lower
    );

  if (!shouldShape) return topic;

  const guidance = [EXECUTION_STYLE_GUIDANCE];
  if (tagSet.has("mentor") || /mentor|learn|mission|lab|program|day\s*\d+|quiz|validation|guide|track/.test(lower)) {
    guidance.push(LEARNING_STYLE_GUIDANCE);
  }
  if (/decision|risk|score|rank|analysis|debrief|judg/.test(lower)) {
    guidance.push(EVALUATION_STYLE_GUIDANCE);
  }

  const mergedQuery = [baseQuery, guidance.join(" ")].filter(Boolean).join("\n\n");
  if (topic) {
    return {
      ...topic,
      query: mergedQuery,
      tags: Array.from(tagSet),
    };
  }

  return {
    id: "zorvix-operator-session",
    title: "ZORVIX operator session",
    query: mergedQuery,
    tags: Array.from(tagSet),
  };
};
const resolveFallbackAssistantText = (_conversation, message, topic, llmError = null) =>
  buildEmergencyAssistantReply(message, topic, llmError);
const fallbackTextFromError = (error, conversation, message, topic, llmError = null) =>
  String(error?.localFallbackText || "").trim() || resolveFallbackAssistantText(conversation, message, topic, llmError);
const forcedFallbackState = (retryAfterSec = null) =>
  buildLlmFailureState({ code: "forced_local_fallback", provider: "local", retryAfterSec });
const llmHttpStatus = (llmError = null, error = null) => {
  const code = String(llmError?.code || error?.code || "").toLowerCase();
  if (code === "bad_request" || code === "invalid_request") return 400;
  if (code === "rate_limit") return 429;
  if (code === "auth" || code === "env" || code === "invalid_model") return 424;
  const raw = Number(error?.status || error?.statusCode || llmError?.statusCode || 0) || 0;
  if (raw >= 500 || !raw) return 503;
  return raw;
};
let recoveryOpen = false;
const markRecoveryEnter = (source) => {
  if (recoveryOpen) return;
  recoveryOpen = true;
  incMetric("chat_recovery_enter_total", 1, { source });
};
const markRecoveryRestore = (source) => {
  if (!recoveryOpen) return;
  recoveryOpen = false;
  incMetric("chat_recovery_restore_total", 1, { source });
};

const slimConversation = (conversation, fallback = false) => ({
  messages: conversation?.messages ?? [],
  activeTopic: conversation?.activeTopic ?? null,
  assistantProfile: conversation?.assistantProfile ?? null,
  fallback,
});

const attachTts = async ({ payload, assistantText, req }) => {
  try {
    const tts = await synthesizeCalmSpeech(assistantText);
    return { ...payload, tts };
  } catch (error) {
    logWarn("TTS synthesis skipped", {
      requestId: req.requestId,
      traceId: req.traceId || "",
      reason: String(error?.message || "tts_failed"),
      status: Number(error?.status || 0) || 0,
    });
    return payload;
  }
};

const parseLastEventId = (value = "") => {
  const input = String(value || "");
  const [streamId = "", seqRaw = "0"] = input.split(":");
  const seq = Number.parseInt(seqRaw, 10);
  return {
    streamId,
    seq: Number.isFinite(seq) && seq >= 0 ? seq : 0,
  };
};

const logLlmFallback = ({ req, phase, error }) => {
  const failure = classifyAiError(error);
  const rawCode = String(error?.code || error?.cause?.code || "").toLowerCase();
  const rawName = String(error?.name || "").toLowerCase();
  const rootCause = failure.code === "upstream_unclassified" ? rawCode || rawName || failure.code : failure.code;
  const payload = {
    phase,
    requestId: req.requestId,
    traceId: req.traceId || "",
    provider: String(error?.provider || failure.provider || ""),
    rootCause,
    retryable: failure.retryable,
    statusCode: failure.statusCode || Number(error?.statusCode || 0) || 0,
    retryAfterSec: Number(error?.retryAfterSec || 0) || 0,
    errorCode: rawCode || "",
    errorName: rawName || "",
    message: String(error?.message || "").slice(0, 180),
  };
  logWarn("LLM fallback activated", payload);
  logError("LLM fallback stack", error, payload);
  if (env.nodeEnv === "production") {
    sendAlert({
      level: "error",
      key: `llm_fallback:${phase}:${payload.provider || "none"}:${payload.rootCause}`,
      title: "LLM fallback activated",
      message: `Phase=${phase} provider=${payload.provider || "unknown"} rootCause=${payload.rootCause}`,
      meta: payload,
    }).catch(() => undefined);
  }
};

const writeSseEvent = async (res, event, payload, id = null) => {
  if (res.writableEnded || res.destroyed) return false;
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  const chunk = `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${serialized}\n\n`;
  const writable = res.write(chunk);
  if (writable) return true;
  await once(res, "drain");
  return !(res.writableEnded || res.destroyed);
};

const writeTerminalStreamError = async ({
  res,
  streamId,
  seq = 0,
  code = "stream_failed",
  message = "stream generation failed",
  requestId = "",
  traceId = "",
  llmError = null,
}) => {
  await writeSseEvent(res, "error", { code, message, requestId, traceId, llmError }, `${streamId}:${seq}`);
  await writeSseEvent(res, "done", { status: "error", streamId, seq, code }, `${streamId}:${seq}`);
};

const streamReplayLoop = async ({ req, res, streamId, initialSeq }) => {
  const started = Date.now();
  let seq = initialSeq;
  let reconnectCounted = false;
  let lastHeartbeatAt = Date.now();

  while (Date.now() - started < STREAM_SESSION_TIMEOUT_MS && !res.writableEnded && !res.destroyed) {
    const checkpoint = await withSpan(
      "stream.replay.load_checkpoint",
      { request_id: req.requestId, stream_id: streamId },
      () =>
        getStreamCheckpoint({
          streamId,
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
        })
    );

    if (!checkpoint) {
      await writeSseEvent(res, "error", { code: "stream_not_found", message: "Stream checkpoint not found." });
      await writeSseEvent(res, "done", { status: "error" });
      res.end();
      return;
    }

    if (seq > 0 && !reconnectCounted) {
      reconnectCounted = true;
      incMetric("neurobot_stream_reconnect_total", 1, { path: "/api/neurobot/chat/stream" });
    }

    if (seq < Number(checkpoint.minSeq || 1) - 1) {
      await writeSseEvent(
        res,
        "reset",
        {
          message: "Replay window exceeded. Sending latest partial response.",
          minSeq: checkpoint.minSeq || 1,
          partialText: checkpoint.partialText || "",
        },
        `${streamId}:${checkpoint.minSeq || 1}`
      );
      seq = Number(checkpoint.minSeq || 1) - 1;
    }

    const replay = replayEventsAfter(checkpoint, seq);
    for (const event of replay) {
      const ok = await writeSseEvent(
        res,
        "token",
        { token: event.token, streamId, seq: event.seq },
        `${streamId}:${event.seq}`
      );
      if (!ok) return;
      seq = event.seq;
      incMetric("neurobot_stream_tokens_total", 1, { path: "/api/neurobot/chat/stream" });
    }

    if (Date.now() - lastHeartbeatAt >= env.streamHeartbeatMs) {
      const ok = await writeSseEvent(
        res,
        "ping",
        { ts: Date.now(), streamId, seq, reconnectAfterMs: streamRetryHintMs() },
        `${streamId}:${seq}`
      );
      if (!ok) {
        incMetric("neurobot_stream_disconnect_total", 1, { phase: "heartbeat" });
        return;
      }
      lastHeartbeatAt = Date.now();
    }

    if (checkpoint.status === "done") {
      const llmError = checkpoint.degraded ? buildLlmFailureState({ code: checkpoint.errorCode || "llm_unavailable" }) : null;
      if (checkpoint.degraded && llmError) {
        await writeSseEvent(res, "warning", { degraded: true, streamId, seq, llmError }, `${streamId}:${seq}`);
      }
      await writeSseEvent(
        res,
        "done",
        {
          status: checkpoint.degraded ? "fallback" : "done",
          streamId,
          seq,
          degraded: checkpoint.degraded,
          errorCode: checkpoint.errorCode || "",
          llmError,
        },
        `${streamId}:${seq}`
      );
      observeMetric("neurobot_stream_duration_ms", Date.now() - started, { status: "done" });
      res.end();
      return;
    }

    if (checkpoint.status === "error") {
      await writeSseEvent(
        res,
        "error",
        {
          code: checkpoint.errorCode || "stream_failed",
          streamId,
        },
        `${streamId}:${seq}`
      );
      await writeSseEvent(res, "done", { status: "error", streamId }, `${streamId}:${seq}`);
      observeMetric("neurobot_stream_duration_ms", Date.now() - started, { status: "error" });
      res.end();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, STREAM_POLL_MS));
  }

  await writeSseEvent(res, "timeout", { status: "timeout", streamId }, `${streamId}:${seq}`);
  await writeSseEvent(res, "done", { status: "timeout", streamId }, `${streamId}:${seq}`);
  observeMetric("neurobot_stream_duration_ms", Date.now() - started, { status: "timeout" });
  res.end();
};

router.get("/session", async (req, res, next) => {
  try {
    const conversation = await getOrCreateConversation({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
    });
    res.json(slimConversation(conversation));
  } catch (error) {
    logWarn("Session initialization attempt failed", {
      requestId: req.requestId,
      traceId: req.traceId || "",
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub || null,
      reason: String(error?.code || error?.message || "session_init_failed"),
    });
    next(error);
  }
});

router.post("/topic", validateBody(topicSchema), async (req, res, next) => {
  try {
    const conversation = await updateTopic({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
      topic: req.validatedBody.topic,
    });
    res.json(slimConversation(conversation));
  } catch (error) {
    next(error);
  }
});

router.post("/preferences", validateBody(preferencesSchema), async (req, res, next) => {
  try {
    await getOrCreateConversation({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
    });
    const conversation = await updateAssistantProfile({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
      assistantProfile: req.validatedBody.assistantProfile,
    });
    await saveUserPreferences({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
      preferences: { assistantProfile: req.validatedBody.assistantProfile },
    });
    res.json(slimConversation(conversation));
  } catch (error) {
    next(error);
  }
});

router.get("/memory/summary", async (req, res, next) => {
  try {
    const userId = req.user?.sub || null;
    const sessionId = req.neurobotSessionId || null;
    const snapshot = await getUserMemorySnapshot({ userId, sessionId });
    const stats = await getMemoryStats({ userId, sessionId });
    res.json({ status: "ok", snapshot, stats });
  } catch (error) {
    next(error);
  }
});

router.post("/history/clear", validateBody(historyClearSchema), async (req, res, next) => {
  try {
    const requestedScope = req.validatedBody.scope || "session";
    const effectiveScope = requestedScope === "account" && req.user?.sub ? "account" : "session";
    const conversation = await clearConversationHistory({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
      scope: effectiveScope,
    });
    res.json({
      ...slimConversation(conversation),
      historyCleared: true,
      scope: effectiveScope,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history/sessions", async (req, res, next) => {
  try {
    const sessions = await listConversationSessions({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
    });
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

router.post("/history/delete-session", validateBody(historyDeleteSessionSchema), async (req, res, next) => {
  try {
    const deleted = await deleteConversationSession({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
      targetSessionId: req.validatedBody.sessionId,
    });
    res.json({ deleted, sessionId: req.validatedBody.sessionId });
  } catch (error) {
    next(error);
  }
});

router.post("/debug/source-status", async (req, res, next) => {
  if (env.nodeEnv === "production") {
    res.status(404).json({
      status: "error",
      code: "route_not_found",
      message: "Route not found",
      requestId: req.requestId || "",
    });
    return;
  }

  try {
    const prompt = sanitizeText(req.body?.prompt || "");
    const inspection = await inspectAiRoute({
      messages: prompt ? [{ role: "user", content: prompt }] : [],
      topic: null,
      assistantProfile: null,
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
    });
    res.json({ status: "ok", inspection });
  } catch (error) {
    next(error);
  }
});

router.post("/preview", validateBody(previewSchema), async (req, res, next) => {
  try {
    const message = sanitizeText(req.validatedBody.message);
    const attachments = await normalizeAttachments(req.validatedBody.attachments || []);
    const assistantProfile = req.validatedBody.assistantProfile || null;
    const topicOverride = req.validatedBody.topic || null;
    const conversation = await getOrCreateConversation({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
    });
    const userMessage = {
      id: `user-preview-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    const knowledgeHits = await searchKnowledge({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
      query: message,
      limit: 3,
    });
    const memorySnapshot = await getUserMemorySnapshot({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
    });
    const memoryContext = buildMemoryContext({
      memory: memorySnapshot,
      recentMessages: conversation.messages || [],
      activeTopic: conversation.activeTopic,
      knowledgeHits,
    });

    const resolvedTopic = buildExecutionTopic(topicOverride || conversation.activeTopic, message, assistantProfile);
    const aiResult = await routeAiRequest({
      messages: [...conversation.messages.slice(-18), userMessage],
      topic: resolvedTopic,
      assistantProfile,
      correlationId: req.requestId,
      userTier: resolveUserTier(req),
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
      attachments,
      memoryContext,
      knowledgeContext: knowledgeHits.map((hit) => hit.summary || hit.text).join("\n"),
    });

    res.json({
      status: "ok",
      response: aiResult.text,
      source: aiResult.source || "unknown",
      previewOnly: true,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/chat", validateBody(chatSchema), async (req, res, next) => {
  try {
    logInfo("Zorvix chat route hit", {
      path: req.originalUrl || req.path,
      requestId: req.requestId || "",
      hasUser: !!req.user?.sub,
      hasCsrfHeader: !!req.headers["x-csrf-token"],
      sessionId: req.neurobotSessionId || "",
      frontendEndpoint: "/api/neurobot/chat",
    });
    const conversation = await getOrCreateConversation({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
    });
    const message = sanitizeText(req.validatedBody.message);
    const attachments = await normalizeAttachments(req.validatedBody.attachments || []);
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: Date.now(),
    };

    let assistantText;
    let fallback = false;
    let llmError = null;
    const assistantProfile = req.validatedBody.assistantProfile || conversation.assistantProfile || null;
    const privateMode = !!assistantProfile?.privateMode;
    await getOrCreateUserProfile({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
      name: req.user?.name || "",
      email: req.user?.email || "",
    });
    const memorySnapshot = await getUserMemorySnapshot({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
    });
    const knowledgeHits = await searchKnowledge({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
      query: message,
      limit: 3,
    });
    const memoryContext = buildMemoryContext({
      memory: memorySnapshot,
      recentMessages: conversation.messages || [],
      activeTopic: conversation.activeTopic,
      knowledgeHits,
    });
    await maybeRecoverAutoLocalFallback(req.requestId || "");
    if (forcedLocalFallback()) {
      fallback = true;
      llmError = forcedFallbackState(autoLocalFallbackRetryAfterSec() || null);
      markRecoveryEnter("chat_sync_forced_local");
      logInfo("Zorvix AI using forced local fallback", {
        requestId: req.requestId || "",
        reason: llmError.code,
      });
      const resolvedTopic = buildExecutionTopic(conversation.activeTopic, message, assistantProfile);
      const aiResult = await routeAiRequest({
        messages: [...conversation.messages.slice(-18), userMessage],
        topic: resolvedTopic,
        assistantProfile,
        correlationId: req.requestId,
        userTier: resolveUserTier(req),
        sessionId: req.neurobotSessionId,
        userId: req.user?.sub ?? null,
        attachments,
        memoryContext,
        knowledgeContext: knowledgeHits.map((hit) => hit.summary || hit.text).join("\n"),
        forceLocalFallback: true,
      });
      assistantText = aiResult.text;
    } else {
      try {
        logInfo("Zorvix AI request starting", {
          requestId: req.requestId || "",
          messageLength: message.length,
          attachments: attachments.length,
          providerMode: env.llmMode,
          primaryProvider: env.primaryProvider,
          fallbackProvider: env.fallbackProvider,
        });
        const resolvedTopic = buildExecutionTopic(conversation.activeTopic, message, assistantProfile);
        const aiResult = await routeAiRequest({
          messages: [...conversation.messages.slice(-18), userMessage],
          topic: resolvedTopic,
          assistantProfile,
          correlationId: req.requestId,
          userTier: resolveUserTier(req),
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          attachments,
          memoryContext,
          knowledgeContext: knowledgeHits.map((hit) => hit.summary || hit.text).join("\n"),
        });
        assistantText = aiResult.text;
        logInfo("Zorvix AI request completed", {
          requestId: req.requestId || "",
          responseLength: String(assistantText || "").length,
          usedFallback: false,
          responseSource: aiResult.source || "unknown",
        });
        markRecoveryRestore("chat_sync");
        req.aiResponseSource = aiResult.source || "unknown";
      } catch (error) {
        const autoFallback = activateAutoLocalFallback(error);
        llmError = autoFallback ? forcedFallbackState(autoLocalFallbackRetryAfterSec() || null) : buildLlmFailureState(error);
        logLlmFallback({ req, phase: "chat.sync", error });
        if (!fallbackAllowed()) {
          error.status = llmHttpStatus(llmError, error);
          if (llmError?.retryAfterSec) res.setHeader("Retry-After", String(Math.max(1, Math.ceil(llmError.retryAfterSec))));
          throw error;
        }
        fallback = true;
        markRecoveryEnter("chat_sync");
        assistantText = fallbackTextFromError(error, conversation, message, conversation.activeTopic, llmError);
        logInfo("Zorvix AI request fell back", {
          requestId: req.requestId || "",
          code: llmError?.code || "",
          provider: llmError?.provider || "",
          responseLength: String(assistantText || "").length,
        });
      }
    }

    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: assistantText,
      timestamp: Date.now(),
    };

    if (privateMode) {
      const privatePayload = {
        ...slimConversation(
          {
            ...conversation,
            messages: [...conversation.messages.slice(-18), userMessage, assistantMessage].slice(-80),
            activeTopic: conversation.activeTopic ?? null,
          },
          fallback
        ),
        degraded: fallback,
        llmError: fallback ? llmError : null,
        responseSource: req.aiResponseSource || (fallback ? "local_fallback" : "unknown"),
      };
      res.json(await attachTts({ payload: privatePayload, assistantText, req }));
      return;
    }

    const updated = await appendMessages({
      sessionId: req.neurobotSessionId,
      userId: req.user?.sub ?? null,
      userMessage,
      assistantMessage,
      activeTopic: conversation.activeTopic,
    });

    const payload = {
      ...slimConversation(updated, fallback),
      degraded: fallback,
      llmError: fallback ? llmError : null,
      responseSource: req.aiResponseSource || (fallback ? "local_fallback" : "unknown"),
    };
    res.json(await attachTts({ payload, assistantText, req }));
  } catch (error) {
    if (res.headersSent) {
      next(error);
      return;
    }

    logLlmFallback({ req, phase: "chat.sync.final", error });
    markRecoveryEnter("chat_sync_final");

    const message = sanitizeText(req.validatedBody?.message || "");
    const autoFallback = activateAutoLocalFallback(error);
    const llmError = autoFallback ? forcedFallbackState(autoLocalFallbackRetryAfterSec() || null) : buildLlmFailureState(error);
    if (!fallbackAllowed()) {
      if (llmError?.retryAfterSec) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(llmError.retryAfterSec))));
      }
      res.status(llmHttpStatus(llmError, error)).json({
        status: "error",
        error: "Zorvix could not generate a response right now.",
        message: llmError.detail,
        code: llmError.code || "llm_unavailable",
        requestId: req.requestId || "",
        traceId: req.traceId || "",
        retryAfterSec: llmError.retryAfterSec,
        retryable: llmError.retryable,
        fallback: fallbackTextFromError(error, null, message, null, llmError),
        llmError,
      });
      return;
    }

    const timestamp = Date.now();
    const messages = [
      ...(message
        ? [
            {
              id: `user-${timestamp}`,
              role: "user",
              content: message,
              timestamp,
            },
          ]
        : []),
      {
        id: `assistant-${timestamp + 1}`,
        role: "assistant",
        content: fallbackTextFromError(error, null, message, null, llmError),
        timestamp: timestamp + 1,
      },
    ];

    const payload = {
      messages,
      activeTopic: null,
      assistantProfile: req.validatedBody?.assistantProfile || null,
      fallback: true,
      degraded: true,
      llmError,
    };

    res.status(200).json(await attachTts({ payload, assistantText: messages[messages.length - 1].content, req }));
  }
});

router.post("/chat/stream", validateBody(chatStreamSchema), async (req, res) => {
  logInfo("Zorvix chat stream route hit", {
    path: req.originalUrl || req.path,
    requestId: req.requestId || "",
    hasUser: !!req.user?.sub,
    hasCsrfHeader: !!req.headers["x-csrf-token"],
    sessionId: req.neurobotSessionId || "",
  });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`retry: ${streamRetryHintMs()}\n\n`);
  const streamTransport = req.validatedBody.transport || "sse";
  incMetric("neurobot_stream_open_total", 1, { path: "/api/neurobot/chat/stream" });
  req.on("close", () => {
    incMetric("neurobot_stream_disconnect_total", 1, { phase: "client_close" });
  });
  try {
    const headerEvent = parseLastEventId(req.headers["last-event-id"]);
    const reconnectStreamId = req.validatedBody.streamId || headerEvent.streamId;
    const reconnectSeq = reconnectStreamId ? headerEvent.seq : 0;
    const reconnectOnly = !!reconnectStreamId && !req.validatedBody.message;

    if (!reconnectStreamId && !req.validatedBody.message) {
      await writeSseEvent(res, "error", { code: "invalid_request", message: "message or streamId required" });
      await writeSseEvent(res, "done", { status: "error" });
      res.end();
      return;
    }

    if (reconnectOnly) {
      await writeSseEvent(
        res,
        "open",
        { streamId: reconnectStreamId, mode: "reconnect", requestId: req.requestId, traceId: req.traceId || "" },
        `${reconnectStreamId}:${reconnectSeq}`
      );
      await streamReplayLoop({ req, res, streamId: reconnectStreamId, initialSeq: reconnectSeq });
      return;
    }

    const conversation = await withTimeout(
      withSpan("stream.load_conversation", { request_id: req.requestId }, () =>
        getOrCreateConversation({
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
        })
      ),
      env.streamInitTimeoutMs,
      "stream_init_timeout"
    );

    const message = sanitizeText(req.validatedBody.message);
    const attachments = await normalizeAttachments(req.validatedBody.attachments || []);
    const assistantProfile = req.validatedBody.assistantProfile || conversation.assistantProfile || null;
    const privateMode = !!assistantProfile?.privateMode;
    await getOrCreateUserProfile({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
      name: req.user?.name || "",
      email: req.user?.email || "",
    });
    const memorySnapshot = await getUserMemorySnapshot({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
    });
    const knowledgeHits = await searchKnowledge({
      userId: req.user?.sub ?? null,
      sessionId: req.neurobotSessionId,
      query: message,
      limit: 3,
    });
    const memoryContext = buildMemoryContext({
      memory: memorySnapshot,
      recentMessages: conversation.messages || [],
      activeTopic: conversation.activeTopic,
      knowledgeHits,
    });
    const now = Date.now();
    const userMessage = {
      id: `user-${now}`,
      role: "user",
      content: message,
      timestamp: now,
    };
    await maybeRecoverAutoLocalFallback(req.requestId || "");
    if (forcedLocalFallback()) {
      const streamId = randomUUID();
      const llmError = forcedFallbackState(autoLocalFallbackRetryAfterSec() || null);
      logInfo("Zorvix AI stream using forced local fallback", {
        requestId: req.requestId || "",
        reason: llmError.code,
      });
      const resolvedTopic = buildExecutionTopic(conversation.activeTopic, message, assistantProfile);
      const fallbackResult = await routeAiRequest({
        messages: [...conversation.messages.slice(-18), userMessage],
        topic: resolvedTopic,
        assistantProfile,
        correlationId: req.requestId,
        userTier: resolveUserTier(req),
        sessionId: req.neurobotSessionId,
        userId: req.user?.sub ?? null,
        attachments,
        memoryContext,
        knowledgeContext: knowledgeHits.map((hit) => hit.summary || hit.text).join("\n"),
        forceLocalFallback: true,
      });
      const fallbackText = fallbackResult.text;
      markRecoveryEnter("chat_stream_forced_local");

      await writeSseEvent(
        res,
        "open",
        {
          streamId,
          mode: "forced_local_fallback",
          requestId: req.requestId,
          traceId: req.traceId || "",
          reconnectBackoffMs: streamRetryHintMs(),
        },
        `${streamId}:0`
      );
      await writeSseEvent(res, "warning", { degraded: true, streamId, seq: 0, llmError }, `${streamId}:0`);
      let seq = 0;
      if (fallbackText) {
        seq = 1;
        await writeSseEvent(res, "token", { token: fallbackText, streamId, seq }, `${streamId}:1`);
      }
      await writeSseEvent(
        res,
        "done",
        { status: "fallback", streamId, seq, errorCode: llmError.code || "forced_local_fallback", llmError },
        `${streamId}:${seq}`
      );

      if (!privateMode && fallbackText.trim()) {
        await appendMessages({
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          userMessage,
          assistantMessage: {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fallbackText,
            timestamp: Date.now(),
          },
          activeTopic: conversation.activeTopic,
        });
      }
      res.end();
      return;
    }

    if (!env.streamUseCheckpointStore || !hasStreamStore()) {
      const streamId = randomUUID();
      await writeSseEvent(
        res,
        "open",
        {
          streamId,
          mode: env.streamUseCheckpointStore ? "degraded" : "direct",
          requestId: req.requestId,
          traceId: req.traceId || "",
          reconnectBackoffMs: streamRetryHintMs(),
        },
        `${streamId}:0`
      );
      let assistantText = "";
      let degraded = false;
      let terminalError = null;
      let streamFailureState = null;
      let seq = 0;
      const abortController = new AbortController();
      const closeListener = () => abortController.abort();
      req.on("close", closeListener);
      const heartbeat = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          writeSseEvent(
            res,
            "ping",
            { ts: Date.now(), streamId, seq, reconnectAfterMs: streamRetryHintMs() },
            `${streamId}:${seq}`
          ).catch(() => undefined);
        }
      }, env.streamHeartbeatMs);
      try {
        logInfo("Zorvix AI stream starting", {
          requestId: req.requestId || "",
          messageLength: message.length,
          attachments: attachments.length,
          providerMode: env.llmMode,
          primaryProvider: env.primaryProvider,
          fallbackProvider: env.fallbackProvider,
        });
        await routeAiStreamRequest({
          messages: [...conversation.messages.slice(-18), userMessage],
          topic: buildExecutionTopic(conversation.activeTopic, message, assistantProfile),
          assistantProfile,
          correlationId: req.requestId,
          userTier: resolveUserTier(req),
          timeoutMs: env.llmCriticalTimeoutMs,
          signal: abortController.signal,
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          attachments,
          memoryContext,
          knowledgeContext: knowledgeHits.map((hit) => hit.summary || hit.text).join("\n"),
          shouldStop: async () => res.writableEnded || res.destroyed,
          onDelta: async (delta) => {
            seq += 1;
            assistantText += delta;
            await writeSseEvent(res, "token", { token: delta, streamId, seq }, `${streamId}:${seq}`);
            incMetric("neurobot_stream_transport_tokens_total", 1, { transport: streamTransport });
          },
        });
        logInfo("Zorvix AI stream completed", {
          requestId: req.requestId || "",
          responseLength: assistantText.length,
        });
        markRecoveryRestore("chat_stream_direct");
        if (!assistantText.trim()) {
          if (!fallbackAllowed()) {
            const error = new Error("LLM stream completed without content");
            error.code = "empty_response";
            terminalError = error;
            markRecoveryEnter("chat_stream_direct_empty_forced");
          } else {
            degraded = true;
            markRecoveryEnter("chat_stream_direct_empty");
            streamFailureState = buildLlmFailureState({ code: "empty_response" });
            assistantText = fallbackTextFromError(null, conversation, message, conversation.activeTopic, streamFailureState);
          }
        }
      } catch (error) {
        logLlmFallback({ req, phase: "chat.stream.direct", error });
        const autoFallback = activateAutoLocalFallback(error);
        markRecoveryEnter(fallbackAllowed() ? "chat_stream_direct_error" : "chat_stream_direct_error_forced");
        if (!fallbackAllowed()) {
          terminalError = error;
        } else {
          degraded = true;
          streamFailureState = autoFallback
            ? forcedFallbackState(autoLocalFallbackRetryAfterSec() || null)
            : buildLlmFailureState(error);
          assistantText = fallbackTextFromError(error, conversation, message, conversation.activeTopic, streamFailureState);
          logInfo("Zorvix AI stream fell back", {
            requestId: req.requestId || "",
            code: streamFailureState?.code || "",
            provider: streamFailureState?.provider || "",
            responseLength: String(assistantText || "").length,
          });
        }
      }
      clearInterval(heartbeat);
      req.off("close", closeListener);
      if (terminalError) {
        const failure = classifyAiError(terminalError);
        await writeTerminalStreamError({
          res,
          streamId,
          seq,
          code: failure.code || String(terminalError?.code || "llm_unavailable"),
          message: String(terminalError?.message || "stream generation failed"),
          requestId: req.requestId || "",
          traceId: req.traceId || "",
          llmError: buildLlmFailureState(terminalError),
        });
        incMetric("neurobot_stream_error_total", 1, {
          reason: failure.code || String(terminalError?.code || "llm_unavailable"),
        });
        res.end();
        return;
      }
      if (degraded && assistantText) {
        await writeSseEvent(res, "warning", { degraded: true, streamId, seq, llmError: streamFailureState }, `${streamId}:${seq}`);
        seq += 1;
        await writeSseEvent(res, "token", { token: assistantText, streamId, seq }, `${streamId}:${seq}`);
      }
      await writeSseEvent(
        res,
        "done",
        {
          status: degraded ? "fallback" : "done",
          streamId,
          seq,
          mode: env.streamUseCheckpointStore ? "degraded_storeless" : "direct",
          errorCode: streamFailureState?.code || "",
          llmError: streamFailureState,
        },
        `${streamId}:${seq}`
      );
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantText,
        timestamp: Date.now(),
      };
    if (!privateMode) {
      if (assistantText.trim()) {
        await appendMessages({
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          userMessage,
          assistantMessage,
          activeTopic: conversation.activeTopic,
        });
        await updateUserProfile({
          userId: req.user?.sub ?? null,
          sessionId: req.neurobotSessionId,
          updates: { lastInteractionAt: Date.now() },
        });
        await ingestKnowledge({
          userId: req.user?.sub ?? null,
          sessionId: req.neurobotSessionId,
          source: "conversation",
          text: `${message}\n${assistantText}`,
          metadata: { tags: conversation.activeTopic?.tags || [] },
        });
        if (Array.isArray(attachments)) {
          for (const file of attachments) {
             
            await recordUploadedFile({
              userId: req.user?.sub ?? null,
              sessionId: req.neurobotSessionId,
              file,
            });
             
            await ingestAttachmentKnowledge({
              userId: req.user?.sub ?? null,
              sessionId: req.neurobotSessionId,
              file,
            });
          }
        }
      }
    }
      res.end();
      return;
    }

    const checkpoint = await withTimeout(
      createStreamCheckpoint({
        sessionId: req.neurobotSessionId,
        userId: req.user?.sub ?? null,
        requestMessage: message,
        activeTopic: conversation.activeTopic,
      }),
      env.streamInitTimeoutMs,
      "stream_checkpoint_timeout"
    );
    const streamId = checkpoint.streamId;
    await writeSseEvent(
      res,
      "open",
      { streamId, mode: "new", requestId: req.requestId, traceId: req.traceId || "", reconnectBackoffMs: streamRetryHintMs() },
      `${streamId}:0`
    );

    const generation = await startStreamGenerator(streamId, async ({ registerAbortController }) => {
      const llmAbortController = new AbortController();
      registerAbortController(llmAbortController);
      let seq = 0;
      let assistantText = "";
      const finalizeDegradedStream = async (fallbackText, errorCode = "llm_unavailable") => {
        const llmError = buildLlmFailureState({ code: errorCode });
        const visibleFallback = String(fallbackText || "").trim() || buildEmergencyAssistantReply(message, conversation.activeTopic);
        seq += 1;
        await appendStreamToken({
          streamId,
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          seq,
          token: visibleFallback,
          partialText: visibleFallback,
        });
        if (!privateMode) {
          await appendMessages({
            sessionId: req.neurobotSessionId,
            userId: req.user?.sub ?? null,
            userMessage,
            assistantMessage: {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: visibleFallback,
              timestamp: Date.now(),
            },
            activeTopic: conversation.activeTopic,
          });
          await updateUserProfile({
            userId: req.user?.sub ?? null,
            sessionId: req.neurobotSessionId,
            updates: { lastInteractionAt: Date.now() },
          });
          await ingestKnowledge({
            userId: req.user?.sub ?? null,
            sessionId: req.neurobotSessionId,
            source: "conversation",
            text: `${message}\n${visibleFallback}`,
            metadata: { tags: conversation.activeTopic?.tags || [] },
          });
        if (Array.isArray(attachments)) {
          for (const file of attachments) {
             
            await recordUploadedFile({
              userId: req.user?.sub ?? null,
              sessionId: req.neurobotSessionId,
              file,
            });
             
            await ingestAttachmentKnowledge({
              userId: req.user?.sub ?? null,
              sessionId: req.neurobotSessionId,
              file,
            });
          }
        }
        }
        await completeStreamCheckpoint({
          streamId,
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          finalText: visibleFallback,
          degraded: true,
          errorCode: llmError.code || errorCode,
        });
      };
      try {
        await withSpan("llm.stream.request", { stream_id: streamId }, () =>
          routeAiStreamRequest({
            messages: [...conversation.messages.slice(-18), userMessage],
            topic: buildExecutionTopic(conversation.activeTopic, message, assistantProfile),
            assistantProfile,
            signal: llmAbortController.signal,
            timeoutMs: env.llmCriticalTimeoutMs,
            correlationId: req.requestId,
            userTier: resolveUserTier(req),
            sessionId: req.neurobotSessionId,
            userId: req.user?.sub ?? null,
            attachments,
            memoryContext,
            knowledgeContext: knowledgeHits.map((hit) => hit.summary || hit.text).join("\n"),
            shouldStop: async () => {
              const current = await getStreamCheckpoint({
                streamId,
                sessionId: req.neurobotSessionId,
                userId: req.user?.sub ?? null,
              });
              return current?.status === "error";
            },
            onDelta: async (delta) => {
              seq += 1;
              assistantText += delta;
              incMetric("neurobot_stream_transport_tokens_total", 1, { transport: streamTransport });
              await appendStreamToken({
                streamId,
                sessionId: req.neurobotSessionId,
                userId: req.user?.sub ?? null,
                seq,
                token: delta,
                partialText: assistantText,
              });
            },
          })
        );
        markRecoveryRestore("chat_stream_checkpoint");

        if (!assistantText.trim()) {
          if (!fallbackAllowed()) {
            markRecoveryEnter("chat_stream_checkpoint_empty_forced");
            await failStreamCheckpoint({
              streamId,
              sessionId: req.neurobotSessionId,
              userId: req.user?.sub ?? null,
              errorCode: "empty_response",
            });
            incMetric("neurobot_stream_error_total", 1, { reason: "empty_response" });
          } else {
            markRecoveryEnter("chat_stream_checkpoint_empty");
            const llmError = buildLlmFailureState({ code: "empty_response" });
            await finalizeDegradedStream(
              fallbackTextFromError(null, conversation, message, conversation.activeTopic, llmError),
              llmError.code
            );
          }
          return;
        }

        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: assistantText.trim(),
          timestamp: Date.now(),
        };
        if (!privateMode) {
          await appendMessages({
            sessionId: req.neurobotSessionId,
            userId: req.user?.sub ?? null,
            userMessage,
            assistantMessage,
            activeTopic: conversation.activeTopic,
          });
          await updateUserProfile({
            userId: req.user?.sub ?? null,
            sessionId: req.neurobotSessionId,
            updates: { lastInteractionAt: Date.now() },
          });
          await ingestKnowledge({
            userId: req.user?.sub ?? null,
            sessionId: req.neurobotSessionId,
            source: "conversation",
            text: `${message}\n${assistantText.trim()}`,
            metadata: { tags: conversation.activeTopic?.tags || [] },
          });
          if (Array.isArray(attachments)) {
            for (const file of attachments) {
               
              await recordUploadedFile({
                userId: req.user?.sub ?? null,
                sessionId: req.neurobotSessionId,
                file,
              });
               
              await ingestAttachmentKnowledge({
                userId: req.user?.sub ?? null,
                sessionId: req.neurobotSessionId,
                file,
              });
            }
          }
        }
        await completeStreamCheckpoint({
          streamId,
          sessionId: req.neurobotSessionId,
          userId: req.user?.sub ?? null,
          finalText: assistantText.trim(),
        });
      } catch (error) {
        if ((error?.name || "") === "AbortError") {
          await failStreamCheckpoint({
            streamId,
            sessionId: req.neurobotSessionId,
            userId: req.user?.sub ?? null,
            errorCode: "aborted",
          });
          return;
        }
        logLlmFallback({ req, phase: "chat.stream.checkpoint", error });
        const autoFallback = activateAutoLocalFallback(error);
        const failure = classifyAiError(error);
        markRecoveryEnter(fallbackAllowed() ? "chat_stream_checkpoint_error" : "chat_stream_checkpoint_error_forced");
        if (!fallbackAllowed()) {
          await failStreamCheckpoint({
            streamId,
            sessionId: req.neurobotSessionId,
            userId: req.user?.sub ?? null,
            errorCode: failure.code || "llm_unavailable",
          });
        } else {
          const llmError = autoFallback
            ? forcedFallbackState(autoLocalFallbackRetryAfterSec() || null)
            : buildLlmFailureState(error);
          await finalizeDegradedStream(
            fallbackTextFromError(error, conversation, message, conversation.activeTopic, llmError),
            llmError.code || failure.code || "llm_unavailable"
          );
        }
        incMetric("neurobot_stream_error_total", 1, { reason: failure.code || "llm_unavailable" });
      }
    });

    if (!generation.started) {
      incMetric("neurobot_stream_generation_contended_total", 1, { path: "/api/neurobot/chat/stream" });
    }

    await streamReplayLoop({ req, res, streamId, initialSeq: 0 });
  } catch (error) {
    const streamId = randomUUID();
    const code = String(error?.code || "stream_internal");
    await writeSseEvent(
      res,
      "open",
      { streamId, mode: "degraded", requestId: req.requestId, traceId: req.traceId || "" },
      `${streamId}:0`
    );
    await writeSseEvent(
      res,
      "error",
      { code, message: "stream initialization failed", requestId: req.requestId, traceId: req.traceId || "" },
      `${streamId}:0`
    );
    markRecoveryEnter(fallbackAllowed() ? "chat_stream_init_error" : "chat_stream_init_error_forced");
    if (!fallbackAllowed()) {
      await writeSseEvent(res, "done", { status: "error", streamId, seq: 0, code }, `${streamId}:0`);
    } else {
      const autoFallback = activateAutoLocalFallback(error);
      const llmError = autoFallback
        ? forcedFallbackState(autoLocalFallbackRetryAfterSec() || null)
        : buildLlmFailureState(error);
      const fallbackText = String(error?.localFallbackText || "").trim() || buildEmergencyAssistantReply(req.validatedBody.message, null, llmError);
      if (fallbackText) {
        await writeSseEvent(res, "warning", { degraded: true, streamId, seq: 0, llmError }, `${streamId}:0`);
        await writeSseEvent(res, "token", { token: fallbackText, streamId, seq: 1 }, `${streamId}:1`);
        await writeSseEvent(
          res,
          "done",
          { status: "fallback", streamId, seq: 1, errorCode: llmError.code || code, llmError },
          `${streamId}:1`
        );
      } else {
        await writeSseEvent(
          res,
          "done",
          { status: "fallback", streamId, seq: 0, errorCode: llmError.code || code, llmError },
          `${streamId}:0`
        );
      }
    }
    incMetric("neurobot_stream_error_total", 1, { reason: code });
    res.end();
  }
});

router.post("/chat/stream/abort", validateBody(chatStreamSchema), async (req, res) => {
  const streamId = req.validatedBody.streamId;
  if (!streamId) {
    res.status(400).json({ error: "streamId required" });
    return;
  }
  if (await isStreamGenerating(streamId)) {
    incMetric("neurobot_stream_abort_total", 1, { path: "/api/neurobot/chat/stream/abort" });
  }
  abortStreamGeneration(streamId);
  await failStreamCheckpoint({
    streamId,
    sessionId: req.neurobotSessionId,
    userId: req.user?.sub ?? null,
    errorCode: "aborted",
  });
  res.status(202).json({ status: "aborting", streamId });
});

router.get("/labs", async (_req, res) => {
  res.json({ labs: getSandboxLabs() });
});

router.get("/labs/status", async (_req, res) => {
  const status = await getDockerSandboxStatus();
  res.json({ status: "ok", sandbox: status });
});

router.post("/labs/run", validateBody(labRunSchema), async (req, res) => {
  try {
    const labId = String(req.validatedBody.labId || "").trim();
    const command = String(req.validatedBody.command || "").trim();
    if (!labId || !command) {
      res.status(400).json({
        status: "error",
        ok: false,
        code: "invalid_request_body",
        error: "Both `labId` and `command` are required",
        message: "Lab execution requires labId and command",
        details: [
          { path: "labId", message: "labId is required" },
          { path: "command", message: "command is required" },
        ],
        requestId: req.requestId || "",
      });
      return;
    }
    const result = await executeSandboxCommand({
      labId,
      command,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      status: "error",
      ok: false,
      code: "lab_execution_failed",
      error: "Lab execution failed",
      message: String(error?.message || "Unexpected execution failure"),
      requestId: req.requestId || "",
    });
  }
});

export default router;
