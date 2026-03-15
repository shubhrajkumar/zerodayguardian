import "dotenv/config";
import { performance } from "node:perf_hooks";

const timeoutMs = Math.max(800, Math.min(15000, Number(process.env.PING_TIMEOUT_MS || 3500)));
const llmMode = String(process.env.LLM_MODE || process.env.LLM_PROVIDER || "auto").toLowerCase();

const normalizeOpenAiBaseUrl = (raw = "") => {
  const url = new URL(raw || "https://api.openai.com/v1/responses");
  const path = String(url.pathname || "/").replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/v1/responses";
  url.pathname = /\/v1$/i.test(path) ? `${path}/responses` : path;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const normalizeGoogleBaseUrl = (raw = "") => {
  const url = new URL(raw || "https://generativelanguage.googleapis.com/v1beta/models");
  const path = String(url.pathname || "/").replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/v1beta/models";
  url.pathname = path.startsWith("/") ? path : `/${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const redact = (value = "") => {
  const s = String(value || "");
  if (!s) return "";
  if (s.length < 10) return "********";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
};

const withTimeout = async (task) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const classify = (status, body) => {
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || /rate.?limit|quota|resource_exhausted/i.test(body)) return "rate_limit";
  if (status >= 500) return "upstream";
  return "unknown";
};

const pingOpenAi = async () => {
  const key = String(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.LLM_API_KEY || "");
  const base = normalizeOpenAiBaseUrl(process.env.OPENAI_BASE_URL || process.env.OPENROUTER_BASE_URL);
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/+$/, "").replace(/\/responses$/i, "/models") || "/v1/models";
  url.search = "";
  const started = performance.now();
  return withTimeout(async (signal) => {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      signal,
    });
    const latencyMs = Math.round(performance.now() - started);
    const body = response.ok ? "" : String(await response.text()).slice(0, 200);
    return {
      provider: "openai",
      baseUrl: base,
      keyPreview: redact(key),
      ok: response.ok,
      statusCode: response.status,
      rootCause: response.ok ? "none" : classify(response.status, body),
      retryable: response.status === 429 || response.status >= 500,
      latencyMs,
      detail: body,
      retryAfter: response.headers.get("retry-after") || "",
    };
  });
};

const pingGoogle = async () => {
  const key = String(process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY || "");
  const base = normalizeGoogleBaseUrl(process.env.GOOGLE_BASE_URL);
  const url = `${base}?key=${encodeURIComponent(key)}`;
  const started = performance.now();
  return withTimeout(async (signal) => {
    const response = await fetch(url, { method: "GET", signal });
    const latencyMs = Math.round(performance.now() - started);
    const body = response.ok ? "" : String(await response.text()).slice(0, 200);
    return {
      provider: "google",
      baseUrl: base,
      keyPreview: redact(key),
      ok: response.ok,
      statusCode: response.status,
      rootCause: response.ok ? "none" : classify(response.status, body),
      retryable: response.status === 429 || response.status >= 500,
      latencyMs,
      detail: body,
      retryAfter: response.headers.get("retry-after") || "",
    };
  });
};

const main = async () => {
  const probes = [];
  if (llmMode === "openai") probes.push(pingOpenAi());
  else if (llmMode === "google") probes.push(pingGoogle());
  else probes.push(pingOpenAi(), pingGoogle());

  const settled = await Promise.allSettled(probes);
  const out = settled.map((result) => {
    if (result.status === "fulfilled") return result.value;
    const message = String(result.reason?.message || result.reason || "probe_failed");
    const timeout = /aborted|timeout/i.test(message);
    return {
      ok: false,
      statusCode: 0,
      rootCause: timeout ? "timeout" : "network",
      retryable: true,
      latencyMs: timeoutMs,
      detail: message.slice(0, 200),
    };
  });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        timeoutMs,
        llmMode,
        probes: out,
      },
      null,
      2
    )
  );
};

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error || "llm_ping_failed"),
      },
      null,
      2
    )
  );
  process.exit(1);
});
