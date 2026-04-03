import { env } from "../config/env.mjs";
import { incMetric, observeMetric, withSpan } from "../observability/telemetry.mjs";
import { CircuitBreakerRegistry } from "./core/circuitBreaker.mjs";
import { ProviderHealthStore } from "./core/providerHealthStore.mjs";
import { ProviderRouter } from "./core/router.mjs";
import { LlmRequestQueue } from "./core/requestQueue.mjs";
import { GeminiAdapter } from "./gemini/adapter.mjs";
import { OpenAiCompatibleAdapter } from "./openaiCompatible/adapter.mjs";
import { OllamaAdapter } from "./ollama/adapter.mjs";
import { logError, logInfo, logWarn } from "../utils/logger.mjs";
import {
  classifyLlmError,
  runLlmSelfDiagnosis as runLlmSelfDiagnosisInternal,
  validateLlmStartupConfig as validateLlmStartupConfigInternal,
} from "./diagnostics.mjs";

const PROVIDERS = {
  ...(env.hasOpenRouter
    ? {
        openrouter: new OpenAiCompatibleAdapter({
          provider: "openrouter",
          baseUrl: env.openrouterBaseUrl,
          model: env.openrouterModel,
          apiKey: env.openrouterApiKey,
          maxTokens: env.openrouterMaxOutputTokens,
        }),
      }
    : {}),
  ...(env.hasOpenAi
    ? {
        openai: new OpenAiCompatibleAdapter({
          provider: "openai",
          baseUrl: env.openaiBaseUrl,
          model: env.openaiModel,
          apiKey: env.openaiApiKey,
          maxTokens: env.openaiMaxOutputTokens,
        }),
      }
    : {}),
  ...(env.hasDeepSeek
    ? {
        deepseek: new OpenAiCompatibleAdapter({
          provider: "deepseek",
          baseUrl: env.deepseekBaseUrl,
          model: env.deepseekModel,
          apiKey: env.deepseekApiKey,
          maxTokens: env.deepseekMaxOutputTokens,
        }),
      }
    : {}),
  ...(env.hasGoogle
    ? {
        google: new GeminiAdapter(),
      }
    : {}),
  ollama: new OllamaAdapter({
    provider: "ollama",
    baseUrl: env.ollamaBaseUrl,
    model: env.ollamaModel,
    numPredict: env.ollamaNumPredict,
  }),
  ...(env.hasOllamaBackup
    ? {
        ollama_backup: new OllamaAdapter({
          provider: "ollama_backup",
          baseUrl: env.ollamaBackupBaseUrl,
          model: env.ollamaBackupModel,
          numPredict: env.ollamaBackupNumPredict,
        }),
      }
    : {}),
};

const COSTS = {
  ...(env.hasOpenRouter ? { openrouter: 0.4 } : {}),
  ...(env.hasOpenAi ? { openai: 1 } : {}),
  ...(env.hasDeepSeek ? { deepseek: 0.25 } : {}),
  ...(env.hasGoogle ? { google: 0.35 } : {}),
  ollama: 0,
  ...(env.hasOllamaBackup ? { ollama_backup: 0.15 } : {}),
};

const healthStore = new ProviderHealthStore(Object.keys(PROVIDERS));
const circuitBreaker = new CircuitBreakerRegistry({
  failureThreshold: env.llmCbFailureThreshold,
  openMs: env.llmCbOpenMs,
  halfOpenProbeCount: env.llmCbHalfOpenProbeCount,
});

const router = new ProviderRouter({
  healthStore,
  circuitBreaker,
  providers: PROVIDERS,
  costs: COSTS,
});
const requestQueue = new LlmRequestQueue({
  concurrency: env.llmQueueConcurrency,
  maxQueueSize: env.llmQueueMaxSize,
  maxWaitMs: env.llmQueueMaxWaitMs,
});
const providerFailures = new Map();
const LAST_FAILURE_TTL_MS = 5 * 60 * 1000;
let healthMonitorTimer = null;
let healthMonitorInFlight = false;
const HEALTHCHECK_REQUEST = Object.freeze({
  messages: [{ role: "user", content: "Healthcheck ping. Reply with OK." }],
  topic: null,
  assistantProfile: {
    tone: "friendly",
    style: "concise",
    audience: "general",
  },
});

const isAbort = (error) => (error?.name || "") === "AbortError";
const isTimeout = (error) =>
  isAbort(error) || /timeout|timed out|aborted/i.test(String(error?.message || "")) || error?.code === "ETIMEDOUT";

const mergeSignals = (...signals) => {
  const active = signals.filter(Boolean);
  if (!active.length) return null;
  if (AbortSignal.any) return AbortSignal.any(active);
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
};

const withTimeoutSignal = (timeoutMs, externalSignal = null) => {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const merged = mergeSignals(externalSignal, timeoutController.signal) || timeoutController.signal;
  return {
    signal: merged,
    clear: () => clearTimeout(timer),
  };
};

const withRefreshableTimeoutSignal = (timeoutMs, externalSignal = null) => {
  const timeoutController = new AbortController();
  let timer = null;

  const start = () => {
    clearTimeout(timer);
    timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  };

  start();

  const merged = mergeSignals(externalSignal, timeoutController.signal) || timeoutController.signal;
  return {
    signal: merged,
    bump: () => start(),
    clear: () => clearTimeout(timer),
  };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (error) => {
  const seconds = Number(error?.retryAfterSec || 0);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(30_000, Math.floor(seconds * 1000));
  return 0;
};

const backoffMs = (attempt, failure = null, error = null) => {
  const exp = Math.min(5, attempt);
  const retryAfterMs = parseRetryAfterMs(error);
  const isRateLimit = failure?.code === "rate_limit";
  const base = isRateLimit
    ? Math.min(env.llmRetryMaxMs, env.llmRateLimitBackoffMs * 2 ** exp)
    : Math.min(env.llmRetryMaxMs, env.llmRetryBaseMs * 2 ** exp);
  if (retryAfterMs > 0) return Math.max(retryAfterMs, base);
  return base;
};
const shouldFailoverImmediately = (failure = null) => {
  const code = String(failure?.code || "").toLowerCase();
  return ["timeout", "rate_limit", "auth", "env", "invalid_model", "invalid_request", "bad_request"].includes(code);
};

const normalizeRequest = (request = {}) => {
  const MAX_MESSAGES = 20;
  const PER_MESSAGE_LIMIT = 6_000;
  const TOTAL_CHAR_BUDGET = 24_000;

  const trimmed = Array.isArray(request.messages)
    ? request.messages.slice(-MAX_MESSAGES).map((m) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content || "").slice(0, PER_MESSAGE_LIMIT),
      }))
    : [];

  // Enforce a total character budget from newest to oldest to prevent 413 payloads.
  const budgeted = [];
  let remaining = TOTAL_CHAR_BUDGET;
  for (let i = trimmed.length - 1; i >= 0; i -= 1) {
    const message = trimmed[i];
    if (remaining <= 0) break;
    const content = message.content.slice(0, remaining);
    remaining -= content.length;
    budgeted.unshift({ ...message, content });
  }

  return {
    messages: budgeted,
    topic: request.topic || null,
    assistantProfile: request.assistantProfile || null,
    timeoutMs: Math.max(1500, Math.min(15_000, Number(request.timeoutMs || env.llmCriticalTimeoutMs))),
    userTier: request.userTier || "free",
    correlationId: request.correlationId || request.requestId || "",
    maxOutputTokens: Math.max(
      96,
      Math.min(4096, Number(request.maxOutputTokens || request.maxTokens || env.openrouterMaxOutputTokens || 768))
    ),
    responseFormat:
      request.responseFormat && typeof request.responseFormat === "object" ? request.responseFormat : null,
    routeStrategy: request.routeStrategy && typeof request.routeStrategy === "object" ? request.routeStrategy : null,
    providerOptions:
      request.providerOptions && typeof request.providerOptions === "object" ? request.providerOptions : null,
    endUserId: String(request.endUserId || request.userId || "").trim().slice(0, 120),
  };
};

const buildBudgetTimeoutError = (requestId = "") => {
  const error = new Error("The live model did not respond within the request time budget.");
  error.code = "timeout";
  error.statusCode = 503;
  error.requestId = requestId;
  return error;
};

const remainingBudgetMs = (deadlineMs) => Math.max(0, Number(deadlineMs || 0) - Date.now());

const attemptTimeoutMs = ({ deadlineMs, stream = false } = {}) => {
  const remaining = remainingBudgetMs(deadlineMs);
  if (remaining <= 0) return 0;
  const maxPerAttempt = stream ? 3000 : 2500;
  const minPerAttempt = stream ? 1200 : 900;
  return Math.max(minPerAttempt, Math.min(maxPerAttempt, remaining));
};
const queueSnapshot = () => requestQueue.snapshot();
const queueGuard = async (request, label, task) => {
  try {
    return await requestQueue.enqueue(task, {
      correlationId: request.correlationId,
      label,
      waitMs: env.llmQueueMaxWaitMs,
    });
  } catch (error) {
    const snapshot = queueSnapshot();
    const code = String(error?.code || "");
    if (code === "queue_overflow") {
      incMetric("neurobot_llm_queue_overflow_total", 1, { label });
      logWarn("LLM queue overflow", {
        label,
        requestId: request.correlationId,
        active: snapshot.active,
        queued: snapshot.queued,
        concurrency: snapshot.concurrency,
        maxQueueSize: snapshot.maxQueueSize,
      });
    } else if (code === "queue_timeout") {
      incMetric("neurobot_llm_queue_timeout_total", 1, { label });
      logWarn("LLM queue wait timeout", {
        label,
        requestId: request.correlationId,
        active: snapshot.active,
        queued: snapshot.queued,
        maxWaitMs: snapshot.maxWaitMs,
      });
    }
    throw error;
  }
};

const rememberFailure = (provider, rawError) => {
  const error = rawError instanceof Error ? rawError : new Error(String(rawError || "unknown error"));
  error.provider = error.provider || provider;
  const failure = classifyLlmError(error);
  error.rootCause = failure.code;
  error.retryable = failure.retryable;
  const retryAfterSec = Number(error?.retryAfterSec || 0) || 0;
  providerFailures.set(provider, {
    code: failure.code,
    statusCode: failure.statusCode || Number(error?.statusCode || 0) || null,
    retryAfterSec,
    model: String(error?.model || ""),
    message: String(error?.message || "").slice(0, 180),
    at: Date.now(),
  });
  return { error, failure };
};

const clearFailure = (provider) => {
  providerFailures.delete(provider);
};

const compactFailure = (provider, error, failure, attempt) => ({
  provider,
  code: String(failure?.code || error?.code || "unknown"),
  statusCode: failure?.statusCode || Number(error?.statusCode || error?.status || 0) || 0,
  retryAfterSec: Number(error?.retryAfterSec || 0) || 0,
  retryable: failure?.retryable !== false,
  attempt: Number(attempt || 0) || 0,
  message: String(error?.message || "").slice(0, 180),
});

const aggregateFailureCode = (failures = []) => {
  const codes = [...new Set(failures.map((failure) => String(failure?.code || "")).filter(Boolean))];
  if (!codes.length) return "service_busy";
  if (codes.every((code) => ["bad_request", "invalid_request"].includes(code))) return "invalid_request";
  if (codes.every((code) => ["auth", "env", "invalid_model"].includes(code))) return codes[0];
  if (codes.every((code) => ["circuit_open", "rate_limit", "timeout", "dns", "network", "firewall", "upstream", "upstream_unclassified"].includes(code) || code.startsWith("upstream_"))) {
    return "service_busy";
  }
  return "service_busy";
};

const buildProviderExhaustedError = ({ failures = [], requestId = "", phase = "generate" } = {}) => {
  const code = aggregateFailureCode(failures);
  const error =
    code === "invalid_request"
      ? new Error("The AI request payload could not be processed.")
      : code === "auth" || code === "env" || code === "invalid_model"
        ? new Error("AI provider configuration is preventing live generation.")
        : new Error("The live model is temporarily unavailable, so the reply was paused for stability.");
  error.code = code;
  error.provider = "";
  error.statusCode = code === "invalid_request" ? 400 : code === "auth" || code === "env" || code === "invalid_model" ? 424 : 503;
  error.retryAfterSec = failures.reduce((max, failure) => Math.max(max, Number(failure?.retryAfterSec || 0) || 0), 0) || null;
  error.failures = failures;
  error.requestId = requestId;
  error.phase = phase;
  return error;
};

const collectRecentFailures = () =>
  Object.fromEntries(
    [...providerFailures.entries()]
      .filter(([provider]) => (env.activeProviderOrder || []).includes(provider) || env.llmMode === provider)
      .filter(([, failure]) => Date.now() - Number(failure?.at || 0) <= LAST_FAILURE_TTL_MS)
      .map(([provider, failure]) => [
        provider,
        {
          ...failure,
          retryAfterSec: (() => {
            const retryAfter = Number(failure?.retryAfterSec || 0) || 0;
            if (!retryAfter) return null;
            const remaining = retryAfter - (Date.now() - Number(failure?.at || 0)) / 1000;
            return remaining > 0 ? Math.ceil(remaining) : 0;
          })(),
          at: new Date(failure.at).toISOString(),
        },
      ])
  );
const latestRecentFailure = () =>
  Object.entries(collectRecentFailures())
    .map(([provider, failure]) => ({ provider, ...failure }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0] || null;

const markFailure = async (provider, error) => {
  const quotaExceeded = !!error?.isQuota;
  const retryAfterSec = Number(error?.retryAfterSec || 0) || 0;
  healthStore.recordFailure(provider, { timeout: isTimeout(error), quotaExceeded, retryAfterSec });
  await circuitBreaker.markFailure(provider, {
    immediateOpen: quotaExceeded || retryAfterSec > 0,
    openMs: retryAfterSec > 0 ? Math.floor(retryAfterSec * 1000) : 0,
  });
  incMetric("neurobot_llm_failures_total", 1, { provider, quota: quotaExceeded });
};

const markSuccess = async (provider, latencyMs, usage = null) => {
  healthStore.recordSuccess(provider, { latencyMs, usage });
  await circuitBreaker.markSuccess(provider);
  clearFailure(provider);
  observeMetric("neurobot_llm_latency_ms", latencyMs, { provider });
  if (usage && Number(usage.totalTokens || 0) > 0) {
    observeMetric("neurobot_llm_tokens_total", Number(usage.totalTokens || 0), { provider, type: "total" });
    observeMetric("neurobot_llm_tokens_total", Number(usage.promptTokens || 0), { provider, type: "prompt" });
    observeMetric("neurobot_llm_tokens_total", Number(usage.completionTokens || 0), {
      provider,
      type: "completion",
    });
  }
};

export const requestLlm = async (rawRequest = {}) => {
  const request = normalizeRequest(rawRequest);
  return queueGuard(request, "generate", () => withSpan("llm.request", { user_tier: request.userTier }, async () => {
    const orderedProviders = await router.choose(request);
    const deadlineMs = Date.now() + request.timeoutMs;
    logInfo("LLM request dispatch", {
      requestId: request.correlationId,
      providers: orderedProviders,
      mode: env.llmMode,
      routingMode: env.routingMode,
      messageCount: request.messages.length,
    });
    if (!orderedProviders.length) {
      const latestFailure = latestRecentFailure();
      const error = new Error(
        latestFailure
          ? `No healthy LLM providers available after recent ${latestFailure.code} failures`
          : "No healthy LLM providers available"
      );
      error.code = latestFailure?.code || "circuit_open";
      error.provider = latestFailure?.provider || "";
      error.statusCode = latestFailure?.statusCode || 0;
      error.retryAfterSec = Number(latestFailure?.retryAfterSec || 0) || 0;
      throw error;
    }

    let lastError = null;
    const exhaustedFailures = [];
    for (const provider of orderedProviders) {
      if (remainingBudgetMs(deadlineMs) <= 0) {
        lastError = buildBudgetTimeoutError(request.correlationId);
        break;
      }
      const adapter = PROVIDERS[provider];
      if (!adapter) continue;

      for (let attempt = 0; attempt <= env.llmMaxRetries; attempt += 1) {
        const timeoutMs = attemptTimeoutMs({ deadlineMs, stream: false });
        if (timeoutMs <= 0) {
          lastError = buildBudgetTimeoutError(request.correlationId);
          break;
        }
        const started = Date.now();
        const timeout = withTimeoutSignal(timeoutMs, rawRequest.signal);
        try {
          logInfo("LLM provider generate attempt", {
            requestId: request.correlationId,
            provider,
            attempt: attempt + 1,
          });
          const result = await adapter.generate(request, {
            signal: timeout.signal,
            correlationId: request.correlationId,
          });
          timeout.clear();
          await markSuccess(provider, Date.now() - started, result.usage);
          logInfo("LLM provider generate success", {
            requestId: request.correlationId,
            provider,
            model: result.model,
            latencyMs: Date.now() - started,
          });
          incMetric("neurobot_llm_provider_selected_total", 1, { provider, mode: env.routingMode });
          return result.text;
        } catch (error) {
          timeout.clear();
          const tracked = rememberFailure(provider, error);
          const failure = tracked.failure;
          lastError = tracked.error;
          exhaustedFailures.push(compactFailure(provider, tracked.error, failure, attempt + 1));
          const failoverNow = shouldFailoverImmediately(failure);
          const canRetry = !failoverNow && failure.retryable && attempt < env.llmMaxRetries;
          const retryDelayMs = canRetry ? backoffMs(attempt, failure, tracked.error) : 0;
          logWarn("LLM generate attempt failed", {
            provider,
            attempt: attempt + 1,
            maxAttempts: env.llmMaxRetries + 1,
            rootCause: failure.code,
            retryable: failure.retryable,
            failoverNow,
            statusCode: failure.statusCode || Number(tracked.error?.statusCode || 0) || 0,
            requestId: request.correlationId,
            retryDelayMs,
          });
          await markFailure(provider, tracked.error);
          if (isAbort(tracked.error) && failure.code !== "timeout") throw tracked.error;
          if (!canRetry) break;
          if (remainingBudgetMs(deadlineMs) <= retryDelayMs) break;
          incMetric("neurobot_llm_retries_total", 1, { provider, reason: failure.code, phase: "generate" });
          await delay(retryDelayMs);
        }
      }

      const currentIndex = orderedProviders.indexOf(provider);
      const nextProvider = orderedProviders[currentIndex + 1] || "";
      if (nextProvider) {
        incMetric("neurobot_llm_failover_total", 1, { from: provider, to: nextProvider, phase: "generate" });
        logWarn("LLM failover activated", {
          from: provider,
          to: nextProvider,
          requestId: request.correlationId,
          phase: "generate",
        });
      }
    }
    if (lastError) {
      const aggregateError = buildProviderExhaustedError({
        failures: exhaustedFailures,
        requestId: request.correlationId,
        phase: "generate",
      });
      logError("LLM request failed after all provider attempts", aggregateError, {
        rootCause: aggregateError.code,
        provider: "",
        requestId: request.correlationId,
        failures: exhaustedFailures,
      });
      throw aggregateError;
    }
    throw buildProviderExhaustedError({ failures: exhaustedFailures, requestId: request.correlationId, phase: "generate" });
  }));
};

export const requestLlmStream = async (rawRequest = {}) => {
  const request = normalizeRequest(rawRequest);
  return queueGuard(request, "stream", () => withSpan("llm.stream.request", { user_tier: request.userTier }, async () => {
    const orderedProviders = await router.choose(request);
    const deadlineMs = Date.now() + request.timeoutMs;
    logInfo("LLM stream dispatch", {
      requestId: request.correlationId,
      providers: orderedProviders,
      mode: env.llmMode,
      routingMode: env.routingMode,
      messageCount: request.messages.length,
    });
    if (!orderedProviders.length) {
      const latestFailure = latestRecentFailure();
      const error = new Error(
        latestFailure
          ? `No healthy LLM providers available after recent ${latestFailure.code} failures`
          : "No healthy LLM providers available"
      );
      error.code = latestFailure?.code || "circuit_open";
      error.provider = latestFailure?.provider || "";
      error.statusCode = latestFailure?.statusCode || 0;
      error.retryAfterSec = Number(latestFailure?.retryAfterSec || 0) || 0;
      throw error;
    }

    let lastError = null;
    const exhaustedFailures = [];
    for (const provider of orderedProviders) {
      if (remainingBudgetMs(deadlineMs) <= 0) {
        lastError = buildBudgetTimeoutError(request.correlationId);
        break;
      }
      const adapter = PROVIDERS[provider];
      if (!adapter) continue;

      for (let attempt = 0; attempt <= env.llmMaxRetries; attempt += 1) {
        const timeoutMs = attemptTimeoutMs({ deadlineMs, stream: true });
        if (timeoutMs <= 0) {
          lastError = buildBudgetTimeoutError(request.correlationId);
          break;
        }
        const started = Date.now();
        const timeout = withRefreshableTimeoutSignal(timeoutMs, rawRequest.signal);
        let emittedAnyToken = false;
        let usage = null;

        try {
          logInfo("LLM provider stream attempt", {
            requestId: request.correlationId,
            provider,
            attempt: attempt + 1,
          });
          for await (const event of adapter.stream(request, {
            signal: timeout.signal,
            correlationId: request.correlationId,
          })) {
            timeout.bump();
            if (rawRequest.shouldStop && (await rawRequest.shouldStop())) {
              const abortError = new Error("Stream aborted");
              abortError.name = "AbortError";
              throw abortError;
            }
            if (event.type === "token" && event.delta) {
              emittedAnyToken = true;
              await rawRequest.onDelta(event.delta);
            }
            if (event.type === "done" && event.usage) usage = event.usage;
          }
          if (!emittedAnyToken) {
            const recovery = await adapter.generate(request, {
              signal: timeout.signal,
              correlationId: request.correlationId,
            });
            const recoveredText = String(recovery?.text || "");
            if (recoveredText) {
              emittedAnyToken = true;
              await rawRequest.onDelta(recoveredText);
            }
            usage = usage || recovery?.usage || null;
          }
          if (!emittedAnyToken) {
            const error = new Error("LLM stream completed without content");
            error.provider = provider;
            error.code = "empty_stream_completion";
            throw error;
          }
          timeout.clear();
          await markSuccess(provider, Date.now() - started, usage);
          logInfo("LLM provider stream success", {
            requestId: request.correlationId,
            provider,
            latencyMs: Date.now() - started,
            emittedAnyToken,
          });
          incMetric("neurobot_llm_provider_selected_total", 1, { provider, mode: `${env.routingMode}_stream` });
          return;
        } catch (error) {
          timeout.clear();
          const tracked = rememberFailure(provider, error);
          const failure = tracked.failure;
          lastError = tracked.error;
          exhaustedFailures.push(compactFailure(provider, tracked.error, failure, attempt + 1));
          const failoverNow = shouldFailoverImmediately(failure);
          const canRetry = !emittedAnyToken && !failoverNow && failure.retryable && attempt < env.llmMaxRetries;
          const retryDelayMs = canRetry ? backoffMs(attempt, failure, tracked.error) : 0;
          logWarn("LLM stream attempt failed", {
            provider,
            attempt: attempt + 1,
            maxAttempts: env.llmMaxRetries + 1,
            rootCause: failure.code,
            retryable: failure.retryable,
            failoverNow,
            emittedAnyToken,
            statusCode: failure.statusCode || Number(tracked.error?.statusCode || 0) || 0,
            requestId: request.correlationId,
            retryDelayMs,
          });
          await markFailure(provider, tracked.error);
          if (isAbort(tracked.error) && failure.code !== "timeout") throw tracked.error;
          if (emittedAnyToken) throw tracked.error;
          if (!canRetry) break;
          if (remainingBudgetMs(deadlineMs) <= retryDelayMs) break;
          incMetric("neurobot_llm_retries_total", 1, { provider, reason: failure.code, phase: "stream" });
          await delay(retryDelayMs);
        }
      }

      const currentIndex = orderedProviders.indexOf(provider);
      const nextProvider = orderedProviders[currentIndex + 1] || "";
      if (nextProvider) {
        incMetric("neurobot_llm_failover_total", 1, { from: provider, to: nextProvider, phase: "stream" });
        logWarn("LLM failover activated", {
          from: provider,
          to: nextProvider,
          requestId: request.correlationId,
          phase: "stream",
        });
      }
    }
    if (lastError) {
      const aggregateError = buildProviderExhaustedError({
        failures: exhaustedFailures,
        requestId: request.correlationId,
        phase: "stream",
      });
      logError("LLM stream failed after all provider attempts", aggregateError, {
        rootCause: aggregateError.code,
        provider: "",
        requestId: request.correlationId,
        failures: exhaustedFailures,
      });
      throw aggregateError;
    }
    throw buildProviderExhaustedError({ failures: exhaustedFailures, requestId: request.correlationId, phase: "stream" });
  }));
};

export const verifyLlmConnection = async ({ timeoutMs = 6000 } = {}) => {
  const providers = await router.choose({ timeoutMs, userTier: "free" });
  const deadlineMs = Date.now() + Math.max(1500, Math.min(10_000, timeoutMs));
  if (!providers.length) {
    const latestFailure = latestRecentFailure();
    const error = new Error(
      latestFailure
        ? `No providers available for healthcheck after recent ${latestFailure.code} failures`
        : "No providers available for healthcheck"
    );
    error.code = latestFailure?.code || "circuit_open";
    error.provider = latestFailure?.provider || "";
    error.statusCode = latestFailure?.statusCode || 0;
    error.retryAfterSec = Number(latestFailure?.retryAfterSec || 0) || 0;
    throw error;
  }

  let lastError = null;
  for (const provider of providers) {
    if (remainingBudgetMs(deadlineMs) <= 0) {
      throw buildBudgetTimeoutError("llm-health");
    }
    const adapter = PROVIDERS[provider];
    if (!adapter) continue;
    for (let attempt = 0; attempt <= env.llmMaxRetries; attempt += 1) {
      const perAttemptTimeoutMs = attemptTimeoutMs({ deadlineMs, stream: false });
      if (perAttemptTimeoutMs <= 0) break;
      const started = Date.now();
      const timeout = withTimeoutSignal(perAttemptTimeoutMs);
      try {
        const result = await adapter.generate(HEALTHCHECK_REQUEST, {
          signal: timeout.signal,
          correlationId: `llm-health-${Date.now()}`,
        });
        timeout.clear();
        const latencyMs = Number(result?.latencyMs || Date.now() - started) || Date.now() - started;
        return {
          ok: true,
          provider,
          model: String(result?.model || ""),
          latencyMs,
          latencyExceeded: latencyMs > env.llmMaxLatencyMs,
          attempts: attempt + 1,
          preview: String(result?.text || "").slice(0, 80),
        };
      } catch (error) {
        timeout.clear();
        const tracked = rememberFailure(provider, error);
        const failure = tracked.failure;
        lastError = tracked.error;
        const canRetry = failure.retryable && failure.code !== "timeout" && attempt < env.llmMaxRetries;
        const retryDelayMs = canRetry ? backoffMs(attempt, failure, tracked.error) : 0;
        logWarn("LLM healthcheck attempt failed", {
          provider,
          attempt: attempt + 1,
          maxAttempts: env.llmMaxRetries + 1,
          rootCause: failure.code,
          retryable: failure.retryable,
          statusCode: failure.statusCode || Number(tracked.error?.statusCode || 0) || 0,
          retryDelayMs,
        });
        await markFailure(provider, tracked.error);
        if (!canRetry) break;
        incMetric("neurobot_llm_retries_total", 1, { provider, reason: failure.code, phase: "healthcheck" });
        await delay(retryDelayMs);
      }
    }
  }
  throw lastError || new Error("LLM healthcheck failed");
};

const monitoredProviders = () => {
  return env.activeProviderOrder?.length ? env.activeProviderOrder : Object.keys(PROVIDERS);
};

const runProviderProbe = async (provider) => {
  const adapter = PROVIDERS[provider];
  if (!adapter) return null;
  const timeout = withTimeoutSignal(env.llmHealthProbeTimeoutMs);
  const started = Date.now();
  try {
    await adapter.healthcheck({ signal: timeout.signal });
    timeout.clear();
    const latencyMs = Date.now() - started;
    await markSuccess(provider, latencyMs, null);
    incMetric("neurobot_llm_health_probe_total", 1, { provider, status: "ok" });
    return { ok: true, provider, latencyMs };
  } catch (error) {
    timeout.clear();
    const tracked = rememberFailure(provider, error);
    const failure = tracked.failure;
    await markFailure(provider, tracked.error);
    incMetric("neurobot_llm_health_probe_total", 1, { provider, status: "error", reason: failure.code });
    return {
      ok: false,
      provider,
      reason: failure.code,
      statusCode: failure.statusCode || Number(tracked.error?.statusCode || 0) || 0,
    };
  }
};

const runHealthMonitorTick = async () => {
  if (healthMonitorInFlight) return;
  healthMonitorInFlight = true;
  try {
    const providers = monitoredProviders();
    for (const provider of providers) {
       
      const probe = await runProviderProbe(provider);
      if (!probe?.ok) {
        logWarn("LLM health monitor probe failed", {
          provider,
          reason: probe?.reason || "unknown",
          statusCode: Number(probe?.statusCode || 0) || 0,
        });
      }
    }
  } catch (error) {
    logError("LLM health monitor tick failed", error);
  } finally {
    healthMonitorInFlight = false;
  }
};

export const startLlmHealthMonitor = () => {
  if (healthMonitorTimer) return;
  healthMonitorTimer = setInterval(() => {
    runHealthMonitorTick().catch(() => undefined);
  }, env.llmHealthProbeIntervalMs);
  healthMonitorTimer?.unref?.();
  runHealthMonitorTick().catch(() => undefined);
};

export const stopLlmHealthMonitor = () => {
  if (!healthMonitorTimer) return;
  clearInterval(healthMonitorTimer);
  healthMonitorTimer = null;
  healthMonitorInFlight = false;
};

export const runLlmSelfDiagnosis = async ({ timeoutMs = 2200 } = {}) => {
  const diagnostics = await runLlmSelfDiagnosisInternal({ timeoutMs });
  const recentFailures = collectRecentFailures();

  const runtime = {};
  for (const provider of Object.keys(PROVIDERS)) {
    runtime[provider] = {
      health: healthStore.snapshot(provider),
      circuit: await circuitBreaker.getState(provider),
      lastFailure: recentFailures[provider] || null,
    };
  }

  if (diagnostics.rootCause?.ok) {
    const latestFailure = Object.entries(recentFailures)
      .map(([provider, failure]) => ({ provider, ...failure }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
    if (latestFailure) {
      diagnostics.rootCause = {
        code: latestFailure.code,
        ok: false,
        provider: latestFailure.provider,
        source: "recent_runtime_failure",
        retryAfterSec: Number(latestFailure.retryAfterSec || 0) || 0,
      };
    }
  }

  return {
    ...diagnostics,
    runtime,
  };
};

export { classifyLlmError };
export const validateLlmStartupConfig = () => validateLlmStartupConfigInternal();

export const getLlmRoutingSnapshot = async () => {
  const response = {};
  for (const provider of Object.keys(PROVIDERS)) {
    response[provider] = {
      health: healthStore.snapshot(provider),
      circuit: await circuitBreaker.getState(provider),
      costPer1k: COSTS[provider],
    };
  }
  return {
    providers: response,
    queue: queueSnapshot(),
  };
};

export const getLlmQueueSnapshot = () => queueSnapshot();
