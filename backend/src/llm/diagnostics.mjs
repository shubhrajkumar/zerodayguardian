import dns from "node:dns/promises";
import net from "node:net";
import { env } from "../config/env.mjs";

const MAX_BODY_PREVIEW = 180;
const ROOT_CAUSE_PRIORITY = ["env", "policy", "dns", "firewall", "network", "timeout", "circuit_open", "upstream", "unknown"];

const trimText = (value = "") => String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_BODY_PREVIEW);

const withTimeout = (promise, timeoutMs, code = "timeout") => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(code);
        error.code = code;
        reject(error);
      }, timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
};

const resolveUrlParts = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    return {
      ok: true,
      protocol: url.protocol,
      host: url.hostname,
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      pathname: url.pathname,
      raw: rawUrl,
    };
  } catch {
    return { ok: false, raw: rawUrl };
  }
};

const classifyFromHttpStatus = (statusCode, body = "") => {
  if (!Number.isFinite(statusCode) || statusCode <= 0) return "unknown";
  const text = String(body || "").toLowerCase();
  if (statusCode === 408 || statusCode === 504) return "timeout";
  if (statusCode >= 500) return "upstream";
  if (statusCode === 400 && /model|unknown model|not found|unsupported|invalid argument|does not exist/.test(text)) {
    return "invalid_model";
  }
  return "unknown";
};

export const classifyLlmError = (error = {}) => {
  const statusCode = Number(error?.statusCode || error?.status || 0) || null;
  const rawCode = String(error?.code || error?.cause?.code || "");
  const directCode = rawCode.toLowerCase();
  const errorCode = rawCode.toUpperCase();
  const provider = String(error?.provider || "");
  const message = String(error?.message || "");
  const causeMessage = String(error?.cause?.message || "");
  const text = `${message} ${causeMessage}`.toLowerCase();

  if (
    ["env", "auth", "rate_limit", "invalid_request", "bad_request", "invalid_model", "dns", "firewall", "network", "timeout", "circuit_open", "service_busy"].includes(directCode)
  ) {
    return {
      code: directCode,
      retryable: ["dns", "network", "timeout", "service_busy", "rate_limit"].includes(directCode),
      provider,
      statusCode,
    };
  }

  if (error?.code === "circuit_open" || /no healthy llm providers/.test(text)) {
    return { code: "circuit_open", retryable: false, provider, statusCode };
  }
  if (/all llm providers failed|llm healthcheck failed|all provider attempts failed|ai services are temporarily busy/.test(text)) {
    return { code: "service_busy", retryable: true, provider: "", statusCode };
  }
  if (/missing required env|is required for current llm_mode|malformed|invalid .*base_url/.test(text)) {
    return { code: "env", retryable: false, provider, statusCode };
  }
  if (statusCode) {
    const fromStatus = classifyFromHttpStatus(statusCode, text);
    if (fromStatus !== "unknown") {
      return {
        code: fromStatus,
        retryable: fromStatus === "upstream" || fromStatus === "timeout",
        provider,
        statusCode,
      };
    }
  }
  if (/unknown model|model .* not found|unsupported model|invalid model/.test(text)) {
    return { code: "invalid_model", retryable: false, provider, statusCode };
  }
  if (/response missing output text|stream unavailable|empty completion/.test(text)) {
    return { code: "upstream", retryable: true, provider, statusCode };
  }
  if (error?.name === "AbortError" || /timeout|timed out|aborted|deadline exceeded/.test(text) || errorCode === "ETIMEDOUT") {
    return { code: "timeout", retryable: true, provider, statusCode };
  }
  if (errorCode === "ENOTFOUND" || errorCode === "EAI_AGAIN" || /getaddrinfo|name resolution|dns/.test(text)) {
    return { code: "dns", retryable: true, provider, statusCode };
  }
  if (errorCode === "EPERM" || errorCode === "EACCES" || /firewall|blocked by policy|network policy/.test(text)) {
    return { code: "firewall", retryable: false, provider, statusCode };
  }
  if (
    ["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "EPIPE", "ECONNABORTED"].includes(errorCode) ||
    /fetch failed|network|socket hang up|socket reset|stream socket reset|reset by peer|connection aborted/.test(text)
  ) {
    return { code: "network", retryable: true, provider, statusCode };
  }
  if (errorCode) {
    return { code: `upstream_${errorCode.toLowerCase()}`, retryable: true, provider, statusCode };
  }
  return { code: "upstream_unclassified", retryable: true, provider, statusCode };
};

const keyPreview = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return "***";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
};

const runtimeConfigFor = () =>
  [
    {
      provider: "openrouter",
      enabled: env.hasOpenRouter && (env.llmMode === "openrouter" || env.llmMode === "auto" || (env.activeProviderOrder || []).includes("openrouter")),
      model: env.openrouterModel,
      baseUrl: env.openrouterBaseUrl,
      apiKey: env.openrouterApiKey,
      keyPreview: keyPreview(env.openrouterApiKey),
      urlParts: resolveUrlParts(env.openrouterBaseUrl),
    },
    {
      provider: "openai",
      enabled: env.hasOpenAi && (env.llmMode === "openai" || env.llmMode === "auto" || (env.activeProviderOrder || []).includes("openai")),
      model: env.openaiModel,
      baseUrl: env.openaiBaseUrl,
      apiKey: env.openaiApiKey,
      keyPreview: keyPreview(env.openaiApiKey),
      urlParts: resolveUrlParts(env.openaiBaseUrl),
    },
    {
      provider: "deepseek",
      enabled: env.hasDeepSeek && (env.llmMode === "deepseek" || env.llmMode === "auto" || (env.activeProviderOrder || []).includes("deepseek")),
      model: env.deepseekModel,
      baseUrl: env.deepseekBaseUrl,
      apiKey: env.deepseekApiKey,
      keyPreview: keyPreview(env.deepseekApiKey),
      urlParts: resolveUrlParts(env.deepseekBaseUrl),
    },
    {
      provider: "google",
      enabled: env.hasGoogle && (env.llmMode === "google" || env.llmMode === "auto" || (env.activeProviderOrder || []).includes("google")),
      model: env.googleModel,
      baseUrl: env.googleBaseUrl,
      apiKey: env.googleApiKey,
      keyPreview: keyPreview(env.googleApiKey),
      urlParts: resolveUrlParts(env.googleBaseUrl),
    },
    {
      provider: "ollama",
      enabled: env.hasOllama && (env.llmMode === "ollama" || env.llmMode === "auto" || (env.activeProviderOrder || []).includes("ollama")),
      model: env.ollamaModel,
      baseUrl: env.ollamaBaseUrl,
      apiKey: "",
      keyPreview: "",
      urlParts: resolveUrlParts(env.ollamaBaseUrl),
    },
    {
      provider: "ollama_backup",
      enabled: env.hasOllamaBackup && (env.llmMode === "ollama_backup" || env.llmMode === "auto" || (env.activeProviderOrder || []).includes("ollama_backup")),
      model: env.ollamaBackupModel,
      baseUrl: env.ollamaBackupBaseUrl,
      apiKey: "",
      keyPreview: "",
      urlParts: resolveUrlParts(env.ollamaBackupBaseUrl),
    },
  ];

const configIssuesFor = (providerConfig) => {
  const issues = [];
  if (!providerConfig.enabled) return issues;

  if (!providerConfig.model) {
    issues.push({
      code: "missing_model",
      severity: "error",
      provider: providerConfig.provider,
      message: `${providerConfig.provider} model is missing`,
    });
  }
  if (!providerConfig.baseUrl) {
    issues.push({
      code: "missing_base_url",
      severity: "error",
      provider: providerConfig.provider,
      message: `${providerConfig.provider} base URL is missing`,
    });
  }
  if (!providerConfig.apiKey && !providerConfig.provider.startsWith("ollama")) {
    issues.push({
      code: "missing_api_key",
      severity: "error",
      provider: providerConfig.provider,
      message: `${providerConfig.provider} API key is missing`,
    });
  }
  if (providerConfig.model) {
    const looksSimpleModelName = /^[a-z0-9._/:+-]+$/i.test(providerConfig.model);
    if (providerConfig.provider.startsWith("ollama") && !looksSimpleModelName) {
      issues.push({
        code: "model_name_suspicious",
        severity: "warn",
        provider: providerConfig.provider,
        message: `Ollama model name looks unusual: ${providerConfig.model}`,
      });
    }
  }
  if (!providerConfig.urlParts.ok) {
    issues.push({
      code: "invalid_base_url",
      severity: "error",
      provider: providerConfig.provider,
      message: `${providerConfig.provider} base URL is invalid`,
    });
  }
  return issues;
};

const policyIssues = () => {
  const issues = [];
  if (env.llmCriticalTimeoutMs < 600) {
    issues.push({
      code: "timeout_too_low",
      severity: "warn",
      provider: "all",
      message: "LLM timeout is very low and can cause false timeouts under normal network variance",
    });
  }
  if (env.llmMaxRetries === 0) {
    issues.push({
      code: "retries_disabled",
      severity: "warn",
      provider: "all",
      message: "LLM retries are disabled; transient upstream failures will surface directly",
    });
  }
  if (env.llmRetryMaxMs < env.llmRetryBaseMs) {
    issues.push({
      code: "retry_policy_invalid",
      severity: "error",
      provider: "all",
      message: "LLM retry max delay is lower than retry base delay",
    });
  }
  return issues;
};

const runDnsProbe = async ({ host, timeoutMs }) => {
  if (!host) {
    return { ok: false, code: "env", message: "host missing", latencyMs: 0 };
  }
  const started = Date.now();
  try {
    const lookup = await withTimeout(dns.lookup(host), timeoutMs, "dns_timeout");
    return { ok: true, host, address: lookup.address, family: lookup.family, latencyMs: Date.now() - started };
  } catch (error) {
    const classification = classifyLlmError(error);
    return {
      ok: false,
      host,
      code: classification.code === "unknown" ? "dns" : classification.code,
      errorCode: String(error?.code || ""),
      message: trimText(error?.message || error),
      latencyMs: Date.now() - started,
    };
  }
};

const runTcpProbe = ({ host, port, timeoutMs }) =>
  new Promise((resolve) => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ latencyMs: Date.now() - started, host, port, ...payload });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({ ok: false, code: "timeout", message: "tcp timeout" }));
    socket.once("error", (error) => {
      const classification = classifyLlmError(error);
      finish({
        ok: false,
        code: classification.code,
        errorCode: String(error?.code || ""),
        message: trimText(error?.message || error),
      });
    });
    socket.connect(port, host);
  });

const withAbortTimeout = (timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
};

const endpointPathFor = (provider = "", config = {}) => {
  if (provider.startsWith("ollama")) return "/api/tags";
  if (provider === "google") return `/models?key=${encodeURIComponent(config.apiKey || "")}`;
  return "/models";
};

const endpointHeadersFor = (config = {}) => {
  if (config.provider === "openrouter") {
    return {
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": env.appBaseUrl || "https://zerodayguardian.ai",
      "X-Title": "ZeroDay Guardian",
    };
  }
  if (!config.provider.startsWith("ollama")) {
    return {
      Authorization: `Bearer ${config.apiKey}`,
    };
  }
  return {};
};

const runEndpointProbe = async ({ timeoutMs, config }) => {
  const abort = withAbortTimeout(timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${String(config.baseUrl || "").replace(/\/+$/, "")}${endpointPathFor(config.provider, config)}`, {
      method: "GET",
      headers: endpointHeadersFor(config),
      signal: abort.signal,
    });
    abort.clear();
    if (response.ok) {
      return {
        ok: true,
        statusCode: response.status,
        retryAfterSec: null,
        latencyMs: Date.now() - started,
      };
    }
    const body = trimText(await response.text());
    const classification = classifyLlmError({
      statusCode: response.status,
      message: body,
      provider: config.provider,
      code: "HTTP_ERROR",
    });
    return {
      ok: false,
      statusCode: response.status,
      code: classification.code,
      retryable: classification.retryable,
      retryAfterSec: null,
      message: body,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    abort.clear();
    error.provider = error.provider || config.provider || "unknown";
    const classification = classifyLlmError(error);
    return {
      ok: false,
      statusCode: classification.statusCode || null,
      code: classification.code,
      retryable: classification.retryable,
      retryAfterSec: null,
      errorCode: String(error?.code || ""),
      message: trimText(error?.message || error),
      latencyMs: Date.now() - started,
    };
  }
};

const runInternetProbe = async ({ timeoutMs }) => {
  const abort = withAbortTimeout(timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch("https://www.gstatic.com/generate_204", {
      method: "GET",
      signal: abort.signal,
    });
    abort.clear();
    if (response.status === 204 || response.ok) {
      return {
        ok: true,
        target: "https://www.gstatic.com/generate_204",
        statusCode: response.status,
        latencyMs: Date.now() - started,
      };
    }
    return {
      ok: false,
      target: "https://www.gstatic.com/generate_204",
      statusCode: response.status,
      code: "network",
      message: `unexpected status ${response.status}`,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    abort.clear();
    const classification = classifyLlmError(error);
    return {
      ok: false,
      target: "https://www.gstatic.com/generate_204",
      statusCode: null,
      code: classification.code,
      errorCode: String(error?.code || ""),
      message: trimText(error?.message || error),
      latencyMs: Date.now() - started,
    };
  }
};

const pickHighestPriorityCause = (codes = []) => {
  for (const candidate of ROOT_CAUSE_PRIORITY) {
    if (codes.includes(candidate)) return candidate;
  }
  return "unknown";
};

const inferRootCause = ({ configIssues = [], outbound = {}, providers = {} }) => {
  const healthyProviders = Object.entries(providers)
    .filter(([, provider]) => provider?.enabled && provider?.endpoint?.ok)
    .map(([provider]) => provider);
  if (healthyProviders.length) {
    return {
      code: healthyProviders.length > 1 ? "degraded_primary_recoverable" : "fallback_provider_ready",
      ok: true,
      provider: healthyProviders[0],
    };
  }

  const candidates = [];
  for (const issue of configIssues) {
    if (issue.severity === "error") {
      candidates.push(["retry_policy_invalid"].includes(issue.code) ? "policy" : "env");
    }
  }
  if (!outbound.ok && outbound.code) candidates.push(outbound.code);
  for (const provider of Object.values(providers)) {
    if (!provider?.enabled) continue;
    if (provider?.dns && !provider.dns.ok && provider.dns.code) candidates.push(provider.dns.code);
    if (provider?.tcp && !provider.tcp.ok && provider.tcp.code) candidates.push(provider.tcp.code);
    if (provider?.endpoint && !provider.endpoint.ok && provider.endpoint.code) candidates.push(provider.endpoint.code);
  }
  if (!candidates.length) return { code: "none", ok: true };
  return { code: pickHighestPriorityCause(candidates), ok: false };
};

const activeProviders = () => [...(env.activeProviderOrder || [])];

export const validateLlmStartupConfig = () => {
  const providerConfigs = runtimeConfigFor();
  const enabledProviders = new Set(activeProviders());
  const issues = [...providerConfigs.flatMap((item) => configIssuesFor(item)), ...policyIssues()].filter((issue) => {
    if (issue.provider === "all") return issue.severity === "error";
    return enabledProviders.has(issue.provider) && issue.severity === "error";
  });

  if (!issues.length) return { ok: true, issues: [] };
  const error = new Error(`Invalid AI configuration: ${issues.map((i) => `${i.provider}:${i.code}`).join(", ")}`);
  error.code = "llm_config_invalid";
  error.issues = issues;
  throw error;
};

export const runLlmSelfDiagnosis = async ({ timeoutMs = 2200 } = {}) => {
  const providers = {};
  const providerConfigs = runtimeConfigFor();
  const outbound = await runInternetProbe({ timeoutMs: Math.max(800, timeoutMs) });
  const enabledProviders = new Set(activeProviders());
  const configIssues = [...providerConfigs.flatMap((item) => configIssuesFor(item)), ...policyIssues()].filter((issue) => {
    if (issue.provider === "all") return true;
    return enabledProviders.has(issue.provider);
  });

  for (const config of providerConfigs) {
    const shouldProbe = enabledProviders.has(config.provider);
    const diagnostics = {
      enabled: shouldProbe && config.enabled,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.keyPreview,
      dns: { ok: false, code: "skipped", message: "provider not active" },
      tcp: { ok: false, code: "skipped", message: "provider not active" },
      endpoint: { ok: false, code: "skipped", message: "provider not active" },
    };

    if (shouldProbe && config.urlParts.ok) {
      diagnostics.dns = await runDnsProbe({ host: config.urlParts.host, timeoutMs: Math.min(1500, timeoutMs) });
      diagnostics.tcp = await runTcpProbe({ host: config.urlParts.host, port: config.urlParts.port, timeoutMs: Math.min(1500, timeoutMs) });
      diagnostics.endpoint = await runEndpointProbe({ timeoutMs, config });
    } else if (shouldProbe && !config.urlParts.ok) {
      diagnostics.dns = { ok: false, code: "env", message: "invalid base URL" };
      diagnostics.tcp = { ok: false, code: "env", message: "invalid base URL" };
      diagnostics.endpoint = { ok: false, code: "env", message: "invalid base URL" };
    }

    providers[config.provider] = diagnostics;
  }

  const rootCause = inferRootCause({ configIssues, outbound, providers });
  return {
    generatedAt: new Date().toISOString(),
    rootCause,
    env: {
      llmMode: env.llmMode,
      routingMode: env.routingMode,
      primaryProvider: env.primaryProvider,
      fallbackProvider: env.fallbackProvider,
    },
    policy: {
      timeoutMs: env.llmCriticalTimeoutMs,
      maxRetries: env.llmMaxRetries,
      retryBaseMs: env.llmRetryBaseMs,
      retryMaxMs: env.llmRetryMaxMs,
      rateLimitBackoffMs: env.llmRateLimitBackoffMs,
    },
    config: {
      issues: configIssues,
      providers: providerConfigs.map((item) => ({
        provider: item.provider,
        enabled: item.enabled,
        model: item.model,
        baseUrl: item.baseUrl,
        apiKey: item.keyPreview,
      })),
    },
    outbound,
    providers,
  };
};
