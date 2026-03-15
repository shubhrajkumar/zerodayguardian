import { env } from "../../config/env.mjs";
import { buildSystemPrompt } from "../core/prompt.mjs";
import { parseSseBlock } from "../core/sse.mjs";

const buildOpenAiHeaders = (ctx = {}) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.openaiApiKey}`,
  };
  if (ctx.correlationId) headers["X-Request-Id"] = ctx.correlationId;
  return headers;
};

const buildModelsUrl = () => {
  const url = new URL(env.openaiBaseUrl);
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname ? pathname.replace(/\/responses$/i, "/models") : "/v1/models";
  url.search = "";
  return url.toString();
};

const parseOutput = (payload) => {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const fromOutput = payload?.output
    ?.flatMap((o) => o.content ?? [])
    ?.find((item) => item.type === "output_text" && item.text)?.text;
  if (typeof fromOutput === "string" && fromOutput.trim()) return fromOutput.trim();
  if (typeof payload?.text === "string" && payload.text.trim()) return payload.text.trim();
  return null;
};

const extractDelta = (payload) => {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.delta === "string") return payload.delta;
  if (payload.type === "response.output_text.delta" && typeof payload.delta === "string") return payload.delta;
  if (typeof payload.output_text === "string") return payload.output_text;
  const deltaText = payload?.delta?.output_text;
  if (typeof deltaText === "string") return deltaText;
  if (Array.isArray(payload.output)) {
    const joined = payload.output
      .flatMap((item) => item?.content ?? [])
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
    if (joined) return joined;
  }
  return "";
};

const safeUsage = (payload = {}) => {
  const usage = payload?.usage || {};
  return {
    promptTokens: Number(usage.input_tokens || 0),
    completionTokens: Number(usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
  };
};

const buildInput = (messages = [], topic, assistantProfile = null) => [
  {
    role: "system",
    content: [{ type: "input_text", text: buildSystemPrompt(topic, assistantProfile) }],
  },
  ...messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: [{ type: "input_text", text: String(message.content || "") }],
  })),
];

const isQuotaError = (status, body = "") => status === 429 || /quota|rate limit/i.test(body);
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
const openAiBodyMeta = (details = "") => {
  const payload = parseJson(details);
  const message = String(payload?.error?.message || details || "").trim();
  const type = String(payload?.error?.type || "");
  return {
    payload,
    message,
    type,
  };
};
const classifyErrorCode = (statusCode, type = "", message = "") => {
  const text = `${type} ${message}`.toLowerCase();
  if (statusCode === 429 || /quota|rate limit|insufficient_quota/.test(text)) return "rate_limit";
  if (statusCode === 401 || statusCode === 403 || /api key|unauthorized|authentication/.test(text)) return "auth";
  if (statusCode === 400 || statusCode === 404 || /model|not found|unsupported/.test(text)) return "invalid_model";
  if (statusCode === 413 || /payload too large|too many tokens|context length|max_tokens/i.test(text)) return "invalid_request";
  if (statusCode === 408 || statusCode === 504 || /timeout|deadline exceeded/.test(text)) return "timeout";
  if (statusCode >= 500) return "upstream";
  return "";
};
const buildOpenAiHttpError = ({ provider, action, response, details }) => {
  const meta = openAiBodyMeta(details);
  const error = new Error(`OpenAI ${action} failed ${response.status}: ${meta.message || String(details || "").trim()}`);
  error.statusCode = response.status;
  error.provider = provider;
  error.isQuota = isQuotaError(response.status, `${meta.type} ${meta.message}`);
  error.retryAfterSec = parseRetryAfterSec(response.headers?.get?.("retry-after"));
  error.code = classifyErrorCode(response.status, meta.type, meta.message);
  return error;
};

const decorateNetworkError = (error, provider) => {
  error.provider = provider;
  if (error.name === "AbortError") {
    error.code = error.code || "ETIMEDOUT";
  }
  return error;
};

export class OpenAiAdapter {
  constructor() {
    this.provider = "openai";
  }

  async generate(request, ctx = {}) {
    const started = Date.now();
    let response;
    try {
      response = await fetch(env.openaiBaseUrl, {
        method: "POST",
        headers: buildOpenAiHeaders(ctx),
        signal: ctx.signal,
        body: JSON.stringify({
          model: env.openaiModel,
          max_output_tokens: env.openaiMaxOutputTokens,
          input: buildInput(request.messages, request.topic, request.assistantProfile),
        }),
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }
    if (!response.ok) {
      const details = await response.text();
      const error = buildOpenAiHttpError({
        provider: this.provider,
        action: "generate",
        response,
        details,
      });
      throw error;
    }
    const payload = await response.json();
    const text = parseOutput(payload);
    if (!text) {
      const err = new Error("OpenAI response missing output text");
      err.provider = this.provider;
      throw err;
    }
    return {
      provider: this.provider,
      model: env.openaiModel,
      text,
      finishReason: "stop",
      latencyMs: Date.now() - started,
      usage: safeUsage(payload),
    };
  }

  async *stream(request, ctx = {}) {
    let response;
    try {
      response = await fetch(env.openaiBaseUrl, {
        method: "POST",
        headers: buildOpenAiHeaders(ctx),
        signal: ctx.signal,
        body: JSON.stringify({
          model: env.openaiModel,
          stream: true,
          max_output_tokens: env.openaiMaxOutputTokens,
          input: buildInput(request.messages, request.topic, request.assistantProfile),
        }),
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }

    if (!response.ok) {
      const details = await response.text();
      const error = buildOpenAiHttpError({
        provider: this.provider,
        action: "stream",
        response,
        details,
      });
      throw error;
    }
    if (!response.body) throw new Error("OpenAI stream unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let seq = 0;

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
        if (data === "[DONE]") {
          yield { type: "done", provider: this.provider, seq };
          return;
        }
        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = extractDelta(payload);
        if (delta) {
          seq += 1;
          yield { type: "token", provider: this.provider, seq, delta };
        }
        if (payload?.type === "response.completed") {
          yield { type: "done", provider: this.provider, seq, usage: safeUsage(payload) };
          return;
        }
      }
    }
    yield { type: "done", provider: this.provider, seq };
  }

  async healthcheck({ signal } = {}) {
    let response;
    try {
      response = await fetch(buildModelsUrl(), {
        method: "GET",
        headers: { Authorization: `Bearer ${env.openaiApiKey}` },
        signal,
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }
    if (!response.ok) {
      const details = await response.text();
      const error = buildOpenAiHttpError({
        provider: this.provider,
        action: "healthcheck",
        response,
        details,
      });
      throw error;
    }
    return true;
  }
}
