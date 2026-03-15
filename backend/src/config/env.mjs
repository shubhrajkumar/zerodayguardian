import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const findEnvPath = (startDir) => {
  let current = startDir;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
};

const cwdEnvPath = findEnvPath(process.cwd());
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const moduleEnvPath = findEnvPath(moduleDir);
const envPath = cwdEnvPath || moduleEnvPath;
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const firstSet = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const toNum = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const csv = (value = "") =>
  String(value)
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
const splitMap = (value = "") =>
  String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
const splitCsv = (value = "") =>
  String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const normalizeGoogleModel = (value = "") => {
  const model = String(value || "").trim().replace(/^models\//, "");
  if (!model) return "";

  const legacyModelMap = {
    "gemini-1.5-flash": "gemini-2.0-flash",
    "gemini-1.5-flash-8b": "gemini-2.0-flash-lite",
  };

  return legacyModelMap[model] || model;
};

const uniqueList = (items = []) => [...new Set(items)];

const parseHttpUrl = (raw, envName) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`[neurobot] ${envName} is malformed.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`[neurobot] ${envName} must use http:// or https://`);
  }
  if (!parsed.hostname) throw new Error(`[neurobot] ${envName} must include a hostname`);
  return parsed;
};

const normalizePath = (pathname = "", fallback = "") => {
  const compact = String(pathname || "").replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  if (!compact || compact === "/") return fallback;
  return compact.startsWith("/") ? compact : `/${compact}`;
};

const normalizeOpenAiBaseUrl = (raw = "") => {
  const parsed = parseHttpUrl(raw || "https://api.openai.com/v1/responses", "OPENAI_BASE_URL");
  const path = normalizePath(parsed.pathname, "/v1/responses");
  parsed.pathname = /\/v1$/i.test(path) ? `${path}/responses` : path;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
};

const normalizeGoogleBaseUrl = (raw = "") => {
  const parsed = parseHttpUrl(raw || "https://generativelanguage.googleapis.com/v1beta/models", "GOOGLE_BASE_URL");
  const normalizedPath = normalizePath(parsed.pathname, "/v1beta/models");
  parsed.pathname = normalizedPath === "/v1beta" || normalizedPath === "/v1" ? "/v1beta/models" : normalizedPath;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
};

const defaultPort = (protocol) => (protocol === "mongodb+srv:" ? 27017 : 27017);
const normalizeLlmProvider = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (["auto", "dual", "both", "all"].includes(raw)) return "auto";
  if (raw === "openai") return "openai";
  if (raw === "google") return "google";
  return raw;
};
const parseMongoUrl = (raw) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("[neurobot] DATABASE_URL is malformed.");
  }
  const protocol = parsed.protocol;
  if (!["mongodb:", "mongodb+srv:"].includes(protocol)) {
    throw new Error("[neurobot] DATABASE_URL must use mongodb:// or mongodb+srv://");
  }
  if (!parsed.hostname) throw new Error("[neurobot] DATABASE_URL must include a hostname");
  const dbNameFromPath = parsed.pathname?.replace(/^\//, "") || "";
  const dbName = dbNameFromPath || process.env.MONGODB_DB_NAME || "";
  if (!dbName) throw new Error("[neurobot] DATABASE_URL must include a database name or set MONGODB_DB_NAME");
  if (protocol === "mongodb:" && parsed.port) {
    const port = Number(parsed.port);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error("[neurobot] DATABASE_URL has invalid port");
    }
  }

  const username = decodeURIComponent(parsed.username || "");
  const tlsFlag = String(parsed.searchParams.get("tls") || parsed.searchParams.get("ssl") || "").toLowerCase();
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase());
  const requiresTlsHint = !isLocalHost && protocol === "mongodb:" && tlsFlag !== "true";

  return {
    protocol,
    host: parsed.hostname,
    port: Number(parsed.port || defaultPort(protocol)),
    username: username || "",
    dbName,
    isSrv: protocol === "mongodb+srv:",
    isLocalHost,
    tlsFlag: tlsFlag || "unspecified",
    requiresTlsHint,
    masked: `${protocol}//${username ? `${username}:***@` : ""}${parsed.hostname}:${parsed.port || defaultPort(protocol)}/${dbName}`,
  };
};

const llmProviderInput = firstSet("LLM_MODE", "LLM_PROVIDER");
const normalizedLlmMode = normalizeLlmProvider(llmProviderInput || "auto");
const required = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "JWT_SECRET",
  "CORS_ORIGIN",
];

export const env = {
  nodeEnv: process.env.NODE_ENV || "production",
  port: Number(process.env.NEUROBOT_PORT || 8787),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8080",
  openaiApiKey: firstSet("OPENAI_API_KEY", "OPENROUTER_API_KEY", "LLM_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiMaxOutputTokens: clamp(process.env.OPENAI_MAX_OUTPUT_TOKENS, 256, 8192, 2048),
  openaiBaseUrl: normalizeOpenAiBaseUrl(firstSet("OPENAI_BASE_URL", "OPENROUTER_BASE_URL")),
  mongoUri: firstSet("DATABASE_URL", "MONGODB_URI"),
  redisUrl: process.env.REDIS_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  jwtSecret: process.env.JWT_SECRET || "",
  dbEncryptionKey: process.env.DB_ENCRYPTION_KEY || "",
  trustProxy: process.env.TRUST_PROXY === "true",
  verifyLlmOnStartup: (process.env.VERIFY_LLM_ON_STARTUP || "true") === "true",
  healthcheckSecret: process.env.HEALTHCHECK_SECRET || "",
  serviceName: process.env.OTEL_SERVICE_NAME || "neurobot-backend",
  serviceVersion: process.env.OTEL_SERVICE_VERSION || "1.0.0",
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "",
  otelEnabled: (process.env.OTEL_ENABLED || "true") === "true",
  llmMode: normalizedLlmMode || "auto",
  llmProvider: normalizedLlmMode || "auto",
  primaryProvider: (process.env.PRIMARY_PROVIDER || "openai").toLowerCase(),
  fallbackProvider: (process.env.FALLBACK_PROVIDER || "google").toLowerCase(),
  routingMode: (process.env.ROUTING_MODE || "failover").toLowerCase().replace("weighted_round_robin", "weighted"),
  providerPriority: csv(process.env.PROVIDER_PRIORITY || "openai,google"),
  providerWeightsRaw: splitMap(process.env.PROVIDER_WEIGHTS || "openai:80,google:20"),
  openaiCostPer1k: toNum(process.env.COST_OPENAI, 0.003),
  googleCostPer1k: toNum(process.env.COST_GOOGLE, 0.0015),
  googleApiKey: firstSet("GOOGLE_API_KEY", "LLM_API_KEY"),
  googleModel: normalizeGoogleModel(process.env.GOOGLE_MODEL || "gemini-2.0-flash"),
  googleFallbackModels: uniqueList(
    splitCsv(process.env.GOOGLE_FALLBACK_MODELS || "gemini-2.5-flash,gemini-2.0-flash-lite")
      .map((model) => normalizeGoogleModel(model))
      .filter(Boolean)
  ),
  googleBaseUrl: normalizeGoogleBaseUrl(process.env.GOOGLE_BASE_URL),
  llmCriticalTimeoutMs: clamp(process.env.LLM_CRITICAL_TIMEOUT_MS, 20000, 60000, 25000),
  llmMaxRetries: clamp(process.env.LLM_MAX_RETRIES, 0, 8, 3),
  llmRetryBaseMs: clamp(process.env.LLM_RETRY_BASE_MS, 250, 10000, 1000),
  llmRetryMaxMs: clamp(process.env.LLM_RETRY_MAX_MS, 1000, 30000, 4000),
  llmRateLimitBackoffMs: clamp(process.env.LLM_RATE_LIMIT_BACKOFF_MS, 250, 30000, 1000),
  llmMaxLatencyMs: Math.max(200, Math.min(20000, toNum(process.env.LLM_MAX_LATENCY_MS, 2200))),
  llmQueueConcurrency: clamp(process.env.LLM_QUEUE_CONCURRENCY, 1, 64, 1),
  llmQueueMaxSize: clamp(process.env.LLM_QUEUE_MAX_SIZE, 10, 5000, 400),
  llmQueueMaxWaitMs: clamp(process.env.LLM_QUEUE_MAX_WAIT_MS, 500, 120000, 15000),
  llmHealthProbeIntervalMs: clamp(process.env.LLM_HEALTH_PROBE_INTERVAL_MS, 5000, 300000, 30000),
  llmHealthProbeTimeoutMs: clamp(process.env.LLM_HEALTH_PROBE_TIMEOUT_MS, 500, 30000, 5000),
  llmCostWeight: Math.max(0, Math.min(10, toNum(process.env.LLM_COST_WEIGHT, 0.6))),
  llmLatencyWeight: Math.max(0, Math.min(10, toNum(process.env.LLM_LATENCY_WEIGHT, 0.25))),
  llmErrorWeight: Math.max(0, Math.min(10, toNum(process.env.LLM_ERROR_WEIGHT, 0.15))),
  llmCbFailureThreshold: Math.max(1, Math.min(50, toNum(process.env.LLM_CB_FAILURE_THRESHOLD, 3))),
  llmCbOpenMs: Math.max(1000, Math.min(120000, toNum(process.env.LLM_CB_OPEN_MS, 30000))),
  llmCbHalfOpenProbeCount: Math.max(1, Math.min(10, toNum(process.env.LLM_CB_HALF_OPEN_PROBES, 2))),
  freeTierProviderOrder: csv(process.env.FREE_TIER_PROVIDER_ORDER || "openai,google"),
  premiumTierProviderOrder: csv(process.env.PREMIUM_TIER_PROVIDER_ORDER || "openai,google"),
  llmOpsSecret: process.env.LLM_OPS_SECRET || "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
  alertMinLevel: (process.env.ALERT_MIN_LEVEL || "warn").toLowerCase(),
  alertCooldownMs: Math.max(30_000, Math.min(3_600_000, toNum(process.env.ALERT_COOLDOWN_MS, 300_000))),
  strictDependencyStartup:
    (process.env.NODE_ENV || "production") === "production"
      ? process.env.STRICT_DEPENDENCY_STARTUP != null
        ? process.env.STRICT_DEPENDENCY_STARTUP === "true"
        : true
      : false,
  streamHeartbeatMs: Math.max(10_000, Math.min(60_000, toNum(process.env.STREAM_HEARTBEAT_MS, 20_000))),
  streamInitTimeoutMs: Math.max(500, Math.min(8_000, toNum(process.env.STREAM_INIT_TIMEOUT_MS, 1_800))),
  streamRetryMinMs: Math.max(500, Math.min(15000, toNum(process.env.STREAM_RETRY_MIN_MS, 1200))),
  streamRetryMaxMs: Math.max(1000, Math.min(30000, toNum(process.env.STREAM_RETRY_MAX_MS, 3800))),
  streamUseCheckpointStore:
    process.env.STREAM_USE_CHECKPOINT_STORE != null
      ? process.env.STREAM_USE_CHECKPOINT_STORE === "true"
      : (process.env.NODE_ENV || "production") === "production",
  allowLlmFallback:
    process.env.ALLOW_LLM_FALLBACK != null
      ? process.env.ALLOW_LLM_FALLBACK === "true"
      : true,
  forceLocalFallback: (process.env.FORCE_LOCAL_FALLBACK || "false") === "true",
  appBaseUrl: process.env.APP_BASE_URL || process.env.CORS_ORIGIN || "http://localhost:8080",
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
  githubOauthClientId: process.env.GITHUB_OAUTH_CLIENT_ID || "",
  githubOauthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || "",
  oauthSuccessRedirect: process.env.OAUTH_SUCCESS_REDIRECT || "/",
  oauthFailureRedirect: process.env.OAUTH_FAILURE_REDIRECT || "/auth?error=oauth_failed",
  newsRefreshIntervalMs: Math.max(60_000, Math.min(3_600_000, toNum(process.env.NEWS_REFRESH_INTERVAL_MS, 900_000))),
  labDockerEnabled: (process.env.LAB_DOCKER_ENABLED || "false") === "true",
  labDockerImage: process.env.LAB_DOCKER_IMAGE || "zeroday-lab-sandbox:latest",
  labDockerNetwork: process.env.LAB_DOCKER_NETWORK || "bridge",
  labDockerTimeoutMs: clamp(process.env.LAB_DOCKER_TIMEOUT_MS, 2000, 120000, 20000),
  labDockerCpus: toNum(process.env.LAB_DOCKER_CPUS, 0.5),
  labDockerMemory: process.env.LAB_DOCKER_MEMORY || "256m",
  labDockerPidsLimit: clamp(process.env.LAB_DOCKER_PIDS_LIMIT, 32, 1024, 128),
  labAllowlistHosts: splitCsv(process.env.LAB_ALLOWLIST_HOSTS || "target.local"),
  labAllowlistCidrs: splitCsv(process.env.LAB_ALLOWLIST_CIDRS || ""),
  labAllowedBins: splitCsv(process.env.LAB_ALLOWED_BINS || ""),
};
env.corsOrigins = uniqueList(splitCsv(env.corsOrigin));

const missing = required.filter((key) => {
  if (key === "DATABASE_URL") return !env.mongoUri;
  if (key === "CORS_ORIGIN") return !env.corsOrigin;
  if (key === "JWT_SECRET") return !env.jwtSecret;
  return !process.env[key] || !String(process.env[key]).trim();
});

if (missing.length) {
  throw new Error(`[neurobot] Missing required env vars: ${missing.join(", ")}`);
}

if (!Number.isFinite(env.port) || env.port <= 0 || env.port > 65535) {
  throw new Error("[neurobot] Invalid NEUROBOT_PORT");
}
if (env.llmRetryMaxMs < env.llmRetryBaseMs) {
  throw new Error("[neurobot] LLM_RETRY_MAX_MS must be >= LLM_RETRY_BASE_MS");
}
if (env.streamRetryMaxMs < env.streamRetryMinMs) {
  throw new Error("[neurobot] STREAM_RETRY_MAX_MS must be >= STREAM_RETRY_MIN_MS");
}
if (env.llmCriticalTimeoutMs < 20000) {
  throw new Error("[neurobot] LLM_CRITICAL_TIMEOUT_MS must be >= 20000");
}
if (!new Set(["info", "warn", "error"]).has(env.alertMinLevel)) {
  throw new Error("[neurobot] ALERT_MIN_LEVEL must be one of: info|warn|error");
}

if (env.nodeEnv === "production") {
  if (!env.corsOrigins.length) {
    throw new Error("[neurobot] CORS_ORIGIN must include at least one origin in production");
  }
  for (const origin of env.corsOrigins) {
    if (!/^https?:\/\//.test(origin)) {
      throw new Error("[neurobot] CORS_ORIGIN entries must be absolute URLs in production");
    }
  }
}

env.mongo = parseMongoUrl(env.mongoUri);

const supportedProviders = new Set(["openai", "google"]);
const supportedModes = new Set(["auto", "openai", "google"]);
const supportedRouting = new Set(["primary", "weighted", "failover"]);

if (!supportedModes.has(env.llmMode)) {
  throw new Error("[neurobot] LLM_PROVIDER/LLM_MODE must be one of: auto|openai|google|dual|both|all");
}
if (!supportedRouting.has(env.routingMode)) {
  throw new Error("[neurobot] ROUTING_MODE must be one of: primary|weighted|weighted_round_robin|failover");
}
if (!supportedProviders.has(env.primaryProvider)) {
  throw new Error("[neurobot] PRIMARY_PROVIDER must be openai or google");
}
if (!supportedProviders.has(env.fallbackProvider)) {
  throw new Error("[neurobot] FALLBACK_PROVIDER must be openai or google");
}
for (const provider of env.providerPriority) {
  if (!supportedProviders.has(provider)) {
    throw new Error("[neurobot] PROVIDER_PRIORITY contains unsupported provider");
  }
}

const rawWeights = {};
for (const entry of env.providerWeightsRaw) {
  const [nameRaw, valueRaw] = entry.split(":");
  const name = String(nameRaw || "").trim().toLowerCase();
  if (!supportedProviders.has(name)) continue;
  const value = Number(valueRaw);
  if (!Number.isFinite(value) || value <= 0) continue;
  rawWeights[name] = value;
}
env.providerWeights = {
  openai: rawWeights.openai || 1,
  google: rawWeights.google || 1,
};

const openaiEnabled = env.llmMode === "auto" || env.llmMode === "openai";
const googleEnabled = env.llmMode === "auto" || env.llmMode === "google";

if (openaiEnabled && !env.openaiApiKey) {
  throw new Error("[neurobot] OPENAI_API_KEY, OPENROUTER_API_KEY, or LLM_API_KEY is required for current LLM_PROVIDER");
}
if (googleEnabled && !env.googleApiKey) {
  throw new Error("[neurobot] GOOGLE_API_KEY is required for current LLM_PROVIDER");
}
if (openaiEnabled && env.openaiApiKey.startsWith("AIza")) {
  throw new Error("[neurobot] OPENAI_API_KEY appears to be a Google key; provider/key mismatch");
}
if (googleEnabled && !env.googleApiKey.startsWith("AIza")) {
  throw new Error("[neurobot] GOOGLE_API_KEY appears invalid for Google provider; expected AIza-prefixed key");
}

const openaiHost = new URL(env.openaiBaseUrl).hostname.toLowerCase();
const googleHost = new URL(env.googleBaseUrl).hostname.toLowerCase();
if (openaiEnabled && /googleapis\.com$/.test(openaiHost)) {
  throw new Error("[neurobot] OPENAI_BASE_URL points to Google host; provider/base_url mismatch");
}
if (googleEnabled && !/googleapis\.com$/.test(googleHost)) {
  throw new Error("[neurobot] GOOGLE_BASE_URL must point to a googleapis.com host");
}
