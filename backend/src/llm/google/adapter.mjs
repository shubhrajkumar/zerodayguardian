import { env } from "../../config/env.mjs";
import { buildSystemPrompt } from "../core/prompt.mjs";
import { parseSseBlock } from "../core/sse.mjs";

const partsToText = (parts = []) =>
  parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("");

const parseText = (payload = {}) => {
  const first = payload?.candidates?.[0];
  return partsToText(first?.content?.parts || []).trim();
};

const parseUsage = (payload = {}) => {
  const usage = payload?.usageMetadata || {};
  return {
    promptTokens: Number(usage.promptTokenCount || 0),
    completionTokens: Number(usage.candidatesTokenCount || 0),
    totalTokens: Number(usage.totalTokenCount || 0),
  };
};

const normalizeModelName = (value = "") => String(value || "").trim().replace(/^models\//, "");
const modelEndpoint = (model, action) =>
  `${env.googleBaseUrl}/${encodeURIComponent(normalizeModelName(model))}:${action}?key=${encodeURIComponent(env.googleApiKey)}`;
const resolveCandidateModels = () =>
  [
    ...new Set(
      [env.googleModel, ...(env.googleFallbackModels || [])]
        .map((v) => normalizeModelName(v))
        .filter(Boolean)
    ),
  ];

const buildBody = (messages = [], topic, assistantProfile = null) => {
  const system = buildSystemPrompt(topic, assistantProfile);
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }],
    })),
  };
};

const isQuotaError = (status, body = "") => status === 429 || /quota|rate limit|resource_exhausted/i.test(body);
const parseRetryAfterSec = (value) => {
  const seconds = Number(value || 0);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  return null;
};
const parseJson = (value = "") => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const parseDurationSeconds = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  if (match) {
    const seconds = Number.parseFloat(match[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return null;
};
const googleBodyMeta = (details = "") => {
  const payload = parseJson(details);
  const message = String(payload?.error?.message || details || "").trim();
  const status = String(payload?.error?.status || "");
  const retryDetail = Array.isArray(payload?.error?.details)
    ? payload.error.details.find((entry) => String(entry?.["@type"] || "").includes("RetryInfo"))
    : null;
  const retryFromDetail = parseDurationSeconds(retryDetail?.retryDelay);
  const retryFromMessage = parseDurationSeconds(message.match(/retry in ([0-9.]+)s/i)?.[1] || "");
  return {
    payload,
    message,
    status,
    retryAfterSec: retryFromDetail || retryFromMessage || null,
  };
};
const classifyErrorCode = (statusCode, statusText = "", message = "") => {
  const text = `${statusText} ${message}`.toLowerCase();
  if (statusCode === 429 || /resource_exhausted|quota|rate limit/.test(text)) return "rate_limit";
  if (statusCode === 401 || statusCode === 403 || /permission denied|unauthorized|api key/.test(text)) return "auth";
  if (statusCode === 400 || statusCode === 404 || /model|not found|unsupported|invalid argument/.test(text)) {
    return "invalid_model";
  }
  if (statusCode === 408 || statusCode === 504 || /deadline exceeded|timeout/.test(text)) return "timeout";
  if (statusCode >= 500) return "upstream";
  return "";
};
const buildGoogleHttpError = ({ provider, model, action, response, details }) => {
  const meta = googleBodyMeta(details);
  const error = new Error(`Google ${action} failed ${response.status}: ${meta.message || String(details || "").trim()}`);
  error.statusCode = response.status;
  error.provider = provider;
  error.model = model;
  error.isQuota = isQuotaError(response.status, `${meta.status} ${meta.message}`);
  error.retryAfterSec = meta.retryAfterSec || parseRetryAfterSec(response.headers?.get?.("retry-after"));
  error.code = classifyErrorCode(response.status, meta.status, meta.message);
  return error;
};

const decorateNetworkError = (error, provider) => {
  error.provider = provider;
  if (error.name === "AbortError") {
    error.code = error.code || "ETIMEDOUT";
  }
  return error;
};

export class GoogleAdapter {
  constructor() {
    this.provider = "google";
  }

  async generate(request, ctx = {}) {
    const started = Date.now();
    let lastError = null;
    for (const model of resolveCandidateModels()) {
      let response;
      try {
        response = await fetch(modelEndpoint(model, "generateContent"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": ctx.correlationId || "",
          },
          signal: ctx.signal,
          body: JSON.stringify(buildBody(request.messages, request.topic, request.assistantProfile)),
        });
      } catch (error) {
        throw decorateNetworkError(error, this.provider);
      }

      if (!response.ok) {
        const details = await response.text();
        const error = buildGoogleHttpError({
          provider: this.provider,
          model,
          action: "generate",
          response,
          details,
        });
        lastError = error;
        const shouldTryNextModel = (error.isQuota || response.status === 400 || response.status === 404) && model !== resolveCandidateModels().at(-1);
        if (shouldTryNextModel) continue;
        throw error;
      }
      const payload = await response.json();
      const text = parseText(payload);
      if (!text) {
        const err = new Error("Google response missing output text");
        err.provider = this.provider;
        throw err;
      }
      return {
        provider: this.provider,
        model,
        text,
        finishReason: payload?.candidates?.[0]?.finishReason || "stop",
        latencyMs: Date.now() - started,
        usage: parseUsage(payload),
      };
    }
    throw lastError || new Error("Google provider unavailable");
  }

  async *stream(request, ctx = {}) {
    let lastError = null;
    const models = resolveCandidateModels();
    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex];
      let response;
      try {
        response = await fetch(`${modelEndpoint(model, "streamGenerateContent")}&alt=sse`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Request-Id": ctx.correlationId || "",
          },
          signal: ctx.signal,
          body: JSON.stringify(buildBody(request.messages, request.topic, request.assistantProfile)),
        });
      } catch (error) {
        throw decorateNetworkError(error, this.provider);
      }

      if (!response.ok) {
        const details = await response.text();
        const error = buildGoogleHttpError({
          provider: this.provider,
          model,
          action: "stream",
          response,
          details,
        });
        lastError = error;
        const shouldTryNextModel = (error.isQuota || response.status === 400 || response.status === 404) && modelIndex < models.length - 1;
        if (shouldTryNextModel) continue;
        throw error;
      }
      if (!response.body) throw new Error("Google stream unavailable");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let seq = 0;
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n\n")) {
          const boundary = buffer.indexOf("\n\n");
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const { data } = parseSseBlock(block);
          if (!data) continue;

          let payload;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          const text = parseText(payload);
          if (text) {
            const delta = text.startsWith(assembled) ? text.slice(assembled.length) : text;
            if (delta) {
              assembled += delta;
              seq += 1;
              yield { type: "token", provider: this.provider, model, seq, delta };
            }
          }
          const finishReason = payload?.candidates?.[0]?.finishReason;
          if (finishReason && finishReason !== "FINISH_REASON_UNSPECIFIED") {
            yield { type: "done", provider: this.provider, model, seq, usage: parseUsage(payload) };
            return;
          }
        }
      }
      yield { type: "done", provider: this.provider, model, seq };
      return;
    }
    throw lastError || new Error("Google stream unavailable");
  }

  async healthcheck({ signal } = {}) {
    let response;
    try {
      response = await fetch(`${env.googleBaseUrl}?key=${encodeURIComponent(env.googleApiKey)}`, {
        method: "GET",
        signal,
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }
    if (!response.ok) {
      const details = await response.text();
      const error = buildGoogleHttpError({
        provider: this.provider,
        model: normalizeModelName(env.googleModel),
        action: "healthcheck",
        response,
        details,
      });
      throw error;
    }
    return true;
  }
}
