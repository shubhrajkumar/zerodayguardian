import { env } from "../../config/env.mjs";
import { buildSystemPrompt } from "../core/prompt.mjs";

const normalizeBaseUrl = (raw = "") => String(raw || "").replace(/\/+$/, "");

const buildPrompt = (messages = [], topic, assistantProfile = null) => {
  const system = buildSystemPrompt(topic, assistantProfile);
  const transcript = messages
    .map((message) => {
      const role = message.role === "assistant" ? "Assistant" : "User";
      return `${role}: ${String(message.content || "").trim()}`;
    })
    .join("\n\n");
  return [system, transcript, "Assistant:"].filter(Boolean).join("\n\n");
};

const parseUsage = (payload = {}) => ({
  promptTokens: Number(payload.prompt_eval_count || 0),
  completionTokens: Number(payload.eval_count || 0),
  totalTokens: Number(payload.prompt_eval_count || 0) + Number(payload.eval_count || 0),
});

const classifyOllamaErrorCode = (statusCode, message = "") => {
  const text = String(message || "").toLowerCase();
  if (statusCode === 404 || /model.+not found/.test(text)) return "invalid_model";
  if (statusCode === 400) return "invalid_request";
  if (statusCode === 408 || statusCode === 504 || /timeout/.test(text)) return "timeout";
  if (statusCode >= 500) return "upstream";
  return "";
};

const buildOllamaHttpError = ({ provider, model, action, response, details }) => {
  const error = new Error(`Ollama ${action} failed ${response.status}: ${String(details || "").trim()}`);
  error.statusCode = response.status;
  error.provider = provider;
  error.model = model;
  error.code = classifyOllamaErrorCode(response.status, details);
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

export class OllamaAdapter {
  constructor({ provider = "ollama", baseUrl = env.ollamaBaseUrl, model = env.ollamaModel, numPredict = env.ollamaNumPredict } = {}) {
    this.provider = provider;
    this.baseUrl = baseUrl;
    this.model = model;
    this.numPredict = numPredict;
  }

  async generate(request, ctx = {}) {
    const started = Date.now();
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ctx.correlationId ? { "X-Request-Id": ctx.correlationId } : {}),
        },
        signal: ctx.signal,
        body: JSON.stringify({
          model: this.model,
          prompt: buildPrompt(request.messages, request.topic, request.assistantProfile),
          stream: false,
          keep_alive: "10m",
          options: {
            temperature: 0.2,
            num_predict: this.numPredict,
          },
        }),
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }
    if (!response.ok) {
      const details = await response.text();
      throw buildOllamaHttpError({
        provider: this.provider,
        model: this.model,
        action: "generate",
        response,
        details,
      });
    }
    const payload = await response.json();
    const text = String(payload.response || "").trim();
    if (!text) {
      const error = new Error("Ollama response missing output text");
      error.provider = this.provider;
      error.model = env.ollamaModel;
      error.code = "upstream";
      throw error;
    }
    return {
      provider: this.provider,
      model: this.model,
      text,
      finishReason: payload.done ? "stop" : "unknown",
      latencyMs: Date.now() - started,
      usage: parseUsage(payload),
    };
  }

  async *stream(request, ctx = {}) {
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ctx.correlationId ? { "X-Request-Id": ctx.correlationId } : {}),
        },
        signal: ctx.signal,
        body: JSON.stringify({
          model: this.model,
          prompt: buildPrompt(request.messages, request.topic, request.assistantProfile),
          stream: true,
          keep_alive: "10m",
          options: {
            temperature: 0.2,
            num_predict: this.numPredict,
          },
        }),
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }

    if (!response.ok) {
      const details = await response.text();
      throw buildOllamaHttpError({
        provider: this.provider,
        model: this.model,
        action: "stream",
        response,
        details,
      });
    }
    if (!response.body) throw new Error("Ollama stream unavailable");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let seq = 0;
    let lastUsage = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const boundary = buffer.indexOf("\n");
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (!line) continue;
        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          continue;
        }
        const delta = String(payload.response || "");
        if (delta) {
          seq += 1;
          yield { type: "token", provider: this.provider, model: this.model, seq, delta };
        }
        if (payload.done) {
          lastUsage = parseUsage(payload);
          yield { type: "done", provider: this.provider, model: this.model, seq, usage: lastUsage };
          return;
        }
      }
    }

    yield { type: "done", provider: this.provider, model: this.model, seq, usage: lastUsage };
  }

  async healthcheck({ signal } = {}) {
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(this.baseUrl)}/api/tags`, {
        method: "GET",
        signal,
      });
    } catch (error) {
      throw decorateNetworkError(error, this.provider);
    }
    if (!response.ok) {
      const details = await response.text();
      throw buildOllamaHttpError({
        provider: this.provider,
        model: this.model,
        action: "healthcheck",
        response,
        details,
      });
    }
    return true;
  }
}
