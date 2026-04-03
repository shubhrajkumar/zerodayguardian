import { env } from "../../config/env.mjs";
import { buildSystemPrompt } from "../core/prompt.mjs";

const normalizeBaseUrl = (raw = "") => String(raw || "").replace(/\/+$/, "");

const toGeminiRole = (role = "") => (role === "assistant" ? "model" : "user");

const buildRequestBody = (request = {}) => {
  const system = buildSystemPrompt(request.topic, request.assistantProfile);
  const contents = (request.messages || [])
    .map((message) => ({
      role: toGeminiRole(message?.role),
      parts: [{ text: String(message?.content || "").trim() }],
    }))
    .filter((message) => message.parts[0].text);

  return {
    systemInstruction: {
      parts: [{ text: system }],
    },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: env.googleMaxOutputTokens,
    },
  };
};

const parseUsage = (payload = {}) => ({
  promptTokens: Number(payload?.usageMetadata?.promptTokenCount || 0),
  completionTokens: Number(payload?.usageMetadata?.candidatesTokenCount || 0),
  totalTokens: Number(payload?.usageMetadata?.totalTokenCount || 0),
});

const extractText = (payload = {}) =>
  (payload?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

const classifyHttpErrorCode = (statusCode, message = "") => {
  const text = String(message || "").toLowerCase();
  if (statusCode === 400) return "invalid_request";
  if (statusCode === 401 || statusCode === 403) return "auth";
  if (statusCode === 404 || /model.+not found|unsupported/.test(text)) return "invalid_model";
  if (statusCode === 408 || statusCode === 504 || /timeout/.test(text)) return "timeout";
  if (statusCode === 429) return "rate_limit";
  if (statusCode >= 500) return "upstream";
  return "";
};

const buildHttpError = ({ action, response, details }) => {
  const error = new Error(`google ${action} failed ${response.status}: ${String(details || "").trim()}`);
  error.statusCode = response.status;
  error.provider = "google";
  error.model = env.googleModel;
  error.code = classifyHttpErrorCode(response.status, details);
  return error;
};

const decorateNetworkError = (error) => {
  const wrapped = error instanceof Error ? new Error(error.message) : new Error(String(error || "Network error"));
  wrapped.name = error?.name || wrapped.name;
  wrapped.provider = "google";
  wrapped.cause = error;
  wrapped.code = error?.name === "AbortError" ? "ETIMEDOUT" : error?.code || "";
  return wrapped;
};

const modelPath = () => `${normalizeBaseUrl(env.googleBaseUrl)}/models/${encodeURIComponent(env.googleModel)}`;
const authSuffix = () => `key=${encodeURIComponent(env.googleApiKey)}`;

export class GeminiAdapter {
  constructor() {
    this.provider = "google";
  }

  async generate(request, ctx = {}) {
    const started = Date.now();
    let response;
    try {
      response = await fetch(`${modelPath()}:generateContent?${authSuffix()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ctx.correlationId ? { "X-Request-Id": ctx.correlationId } : {}),
        },
        signal: ctx.signal,
        body: JSON.stringify(buildRequestBody(request)),
      });
    } catch (error) {
      throw decorateNetworkError(error);
    }

    if (!response.ok) {
      const details = await response.text();
      throw buildHttpError({ action: "generate", response, details });
    }

    const payload = await response.json();
    const text = extractText(payload);
    if (!text) {
      const error = new Error("google response missing output text");
      error.provider = "google";
      error.model = env.googleModel;
      error.code = "upstream";
      throw error;
    }
    return {
      provider: "google",
      model: env.googleModel,
      text,
      finishReason: String(payload?.candidates?.[0]?.finishReason || "stop"),
      latencyMs: Date.now() - started,
      usage: parseUsage(payload),
    };
  }

  async *stream(request, ctx = {}) {
    let response;
    try {
      response = await fetch(`${modelPath()}:streamGenerateContent?alt=sse&${authSuffix()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ctx.correlationId ? { "X-Request-Id": ctx.correlationId } : {}),
        },
        signal: ctx.signal,
        body: JSON.stringify(buildRequestBody(request)),
      });
    } catch (error) {
      throw decorateNetworkError(error);
    }

    if (!response.ok) {
      const details = await response.text();
      throw buildHttpError({ action: "stream", response, details });
    }
    if (!response.body) throw new Error("google stream unavailable");

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
        if (!data) continue;
        let payload;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = extractText(payload);
        if (delta) {
          seq += 1;
          yield { type: "token", provider: "google", model: env.googleModel, seq, delta };
        }
      }
    }
    yield { type: "done", provider: "google", model: env.googleModel, seq, usage: null };
  }

  async healthcheck({ signal } = {}) {
    let response;
    try {
      response = await fetch(`${normalizeBaseUrl(env.googleBaseUrl)}/models?${authSuffix()}`, {
        method: "GET",
        signal,
      });
    } catch (error) {
      throw decorateNetworkError(error);
    }
    if (!response.ok) {
      const details = await response.text();
      throw buildHttpError({ action: "healthcheck", response, details });
    }
    return true;
  }
}
