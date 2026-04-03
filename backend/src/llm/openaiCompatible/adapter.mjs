import { env } from "../../config/env.mjs";
import { buildSystemPrompt } from "../core/prompt.mjs";

const normalizeBaseUrl = (raw = "") => String(raw || "").replace(/\/+$/, "");

const toMessages = (messages = [], topic, assistantProfile = null) => {
  const system = buildSystemPrompt(topic, assistantProfile);
  const next = [{ role: "system", content: system }];
  for (const message of messages) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const content = String(message?.content || "").trim();
    if (!content) continue;
    next.push({ role, content });
  }
  return next;
};

const parseUsage = (payload = {}) => ({
  promptTokens: Number(payload?.usage?.prompt_tokens || 0),
  completionTokens: Number(payload?.usage?.completion_tokens || 0),
  totalTokens: Number(payload?.usage?.total_tokens || 0),
});

const classifyHttpErrorCode = (statusCode, message = "") => {
  const text = String(message || "").toLowerCase();
  if (statusCode === 400) return "invalid_request";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode === 404 || /model.+not found|unknown model/.test(text)) return "invalid_model";
  if (statusCode === 408 || statusCode === 504 || /timeout|timed out/.test(text)) return "timeout";
  if (statusCode === 429) return "rate_limit";
  if (statusCode >= 500) return "upstream";
  return "";
};

const buildHttpError = ({ provider, model, action, response, details }) => {
  const error = new Error(`${provider} ${action} failed ${response.status}: ${String(details || "").trim()}`);
  error.statusCode = response.status;
  error.provider = provider;
  error.model = model;
  error.code = classifyHttpErrorCode(response.status, details);
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const retryAfterSec = Number(retryAfter);
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) error.retryAfterSec = retryAfterSec;
  }
  return error;
};

const decorateNetworkError = (error, provider) => {
  const wrapped = error instanceof Error ? new Error(error.message) : new Error(String(error || "Network error"));
  wrapped.name = error?.name || wrapped.name;
  wrapped.provider = provider;
  wrapped.cause = error;
  wrapped.code = error?.name === "AbortError" ? "ETIMEDOUT" : error?.code || "";
  return wrapped;
};

const extractText = (payload = {}) => {
  const direct = String(payload?.choices?.[0]?.message?.content || "").trim();
  if (direct) return direct;
  const parts = payload?.output?.[0]?.content;
  if (Array.isArray(parts)) {
    const joined = parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (joined) return joined;
  }
  return "";
};

const buildHeaders = ({ apiKey = "", provider = "", correlationId = "" }) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (correlationId) headers["X-Request-Id"] = correlationId;
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = env.appBaseUrl || "https://zerodayguardian.ai";
    headers["X-Title"] = "ZeroDay Guardian";
    headers["X-OpenRouter-Title"] = "ZeroDay Guardian";
  }
  return headers;
};

const buildRequestBody = (request = {}, { model = "", maxTokens = 1024, stream = false } = {}) => {
  const body = {
    model,
    messages: toMessages(request.messages, request.topic, request.assistantProfile),
    temperature: 0.2,
    max_tokens: Number(request.maxOutputTokens || maxTokens || 1024),
    stream,
  };
  if (request.responseFormat) body.response_format = request.responseFormat;
  if (request.routeStrategy) body.route = request.routeStrategy;
  if (request.providerOptions) body.provider = request.providerOptions;
  if (request.endUserId) body.user = request.endUserId;
  return body;
};

export class OpenAiCompatibleAdapter {
  constructor({
    provider,
    baseUrl,
    model,
    apiKey,
    maxTokens = 1024,
  } = {}) {
    this.provider = provider || "openai";
    this.baseUrl = baseUrl || "";
    this.model = model || "";
    this.apiKey = apiKey || "";
    this.maxTokens = maxTokens;
  }

  async generate(request, ctx = {}) {
    const started = Date.now();
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/chat/completions`, {
        method: "POST",
        headers: buildHeaders({ apiKey: this.apiKey, provider: this.provider, correlationId: ctx.correlationId }),
        signal: ctx.signal,
        body: JSON.stringify(buildRequestBody(request, { model: this.model, maxTokens: this.maxTokens, stream: false })),
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }

    if (!response.ok) {
      const details = await response.text();
      throw buildHttpError({ provider: this.provider, model: this.model, action: "generate", response, details });
    }

    const payload = await response.json();
    const text = extractText(payload);
    if (!text) {
      const error = new Error(`${this.provider} response missing output text`);
      error.provider = this.provider;
      error.model = this.model;
      error.code = "upstream";
      throw error;
    }
    return {
      provider: this.provider,
      model: this.model,
      text,
      finishReason: String(payload?.choices?.[0]?.finish_reason || "stop"),
      latencyMs: Date.now() - started,
      usage: parseUsage(payload),
    };
  }

  async *stream(request, ctx = {}) {
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/chat/completions`, {
        method: "POST",
        headers: buildHeaders({ apiKey: this.apiKey, provider: this.provider, correlationId: ctx.correlationId }),
        signal: ctx.signal,
        body: JSON.stringify(buildRequestBody(request, { model: this.model, maxTokens: this.maxTokens, stream: true })),
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }

    if (!response.ok) {
      const details = await response.text();
      throw buildHttpError({ provider: this.provider, model: this.model, action: "stream", response, details });
    }
    if (!response.body) throw new Error(`${this.provider} stream unavailable`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let seq = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const boundary = buffer.indexOf("\n");
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") {
          yield { type: "done", provider: this.provider, model: this.model, seq, usage: null };
          return;
        }
        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = String(payload?.choices?.[0]?.delta?.content || "");
        if (delta) {
          seq += 1;
          yield { type: "token", provider: this.provider, model: this.model, seq, delta };
        }
      }
    }
    yield { type: "done", provider: this.provider, model: this.model, seq, usage: null };
  }

  async healthcheck({ signal } = {}) {
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/models`, {
        method: "GET",
        headers: buildHeaders({ apiKey: this.apiKey, provider: this.provider }),
        signal,
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }
    if (!response.ok) {
      const details = await response.text();
      throw buildHttpError({ provider: this.provider, model: this.model, action: "healthcheck", response, details });
    }
    return true;
  }
}
