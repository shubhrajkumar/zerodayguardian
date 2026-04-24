import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRootEnvPath = path.resolve(moduleDir, "..", "..", "..", ".env");
const backendEnvPath = path.resolve(moduleDir, "..", "..", ".env");
const envPaths = [projectRootEnvPath, backendEnvPath].filter((value, index, list) => list.indexOf(value) === index);
const loadedEnv = envPaths.some((envPath, index) => {
  if (!fs.existsSync(envPath)) return false;
  dotenv.config({ path: envPath, override: index > 0 });
  return true;
});
if (!loadedEnv) {
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
const isExplicitTrue = (value) => String(value || "").trim().toLowerCase() === "true";
const isExplicitFalse = (value) => String(value || "").trim().toLowerCase() === "false";

const uniqueList = (items = []) => [...new Set(items)];
const LOCALHOST_LIKE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const formatOriginHost = (host) => (host.includes(":") ? `[${host}]` : host);

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

const normalizeOllamaBaseUrl = (raw = "") => {
  const parsed = parseHttpUrl(raw || "http://127.0.0.1:11434", "OLLAMA_BASE_URL");
  parsed.pathname = normalizePath(parsed.pathname, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
};
const normalizeApiBaseUrl = (raw = "", envName) => {
  const parsed = parseHttpUrl(raw, envName);
  parsed.pathname = normalizePath(parsed.pathname, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
};

const defaultPort = (protocol) => (protocol === "mongodb+srv:" ? 27017 : 27017);
const normalizeLlmProvider = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || ["auto", "dual", "both", "all"].includes(raw)) return "auto";
  return ["openrouter", "openai", "deepseek", "google", "ollama", "ollama_backup", "auto"].includes(raw) ? raw : raw;
};
const parseMongoUrl = (raw) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    const fallback = String(raw || "").trim();
    const multiHostMatch = fallback.match(/^mongodb:\/\/(?:(?<auth>[^@/]+)@)?(?<hosts>[^/]+)\/(?<db>[^?]+)(?:\?(?<query>.*))?$/i);
    if (!multiHostMatch?.groups?.hosts) {
      throw new Error("[neurobot] DATABASE_URL is malformed.");
    }

    const protocol = "mongodb:";
    const hostEntries = String(multiHostMatch.groups.hosts)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const firstHost = hostEntries[0] || "";
    const [hostname, portText] = firstHost.split(":");
    if (!hostname) throw new Error("[neurobot] DATABASE_URL must include a hostname");

    const auth = String(multiHostMatch.groups.auth || "");
    const authSep = auth.indexOf(":");
    const username = authSep >= 0 ? decodeURIComponent(auth.slice(0, authSep)) : decodeURIComponent(auth);
    const dbName = String(multiHostMatch.groups.db || "").trim() || process.env.MONGODB_DB_NAME || "";
    if (!dbName) throw new Error("[neurobot] DATABASE_URL must include a database name or set MONGODB_DB_NAME");

    const searchParams = new URLSearchParams(String(multiHostMatch.groups.query || ""));
    const tlsFlag = String(searchParams.get("tls") || searchParams.get("ssl") || "").toLowerCase();
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname.toLowerCase());
    const requiresTlsHint = !isLocalHost && tlsFlag !== "true";
    const port = Number(portText || defaultPort(protocol));
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error("[neurobot] DATABASE_URL has invalid port");
    }

    return {
      protocol,
      host: hostname,
      port,
      username: username || "",
      dbName,
      isSrv: false,
      isLocalHost,
      tlsFlag: tlsFlag || "unspecified",
      requiresTlsHint,
      masked: `${protocol}//${username ? `${username}:***@` : ""}${hostEntries.join(",")}/${dbName}`,
    };
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

const createDegradedMongoConfig = (reason = "missing") => ({
  protocol: "mongodb:",
  host: "127.0.0.1",
  port: 27017,
  username: "",
  dbName: process.env.MONGODB_DB_NAME || "neurobot",
  isSrv: false,
  isLocalHost: true,
  tlsFlag: "unspecified",
  requiresTlsHint: false,
  masked: `mongodb://127.0.0.1:27017/${process.env.MONGODB_DB_NAME || "neurobot"}?degraded=${reason}`,
  degraded: true,
});

const llmProviderInput = firstSet("LLM_MODE", "LLM_PROVIDER");
const normalizedLlmMode = normalizeLlmProvider(llmProviderInput || "auto");
const isProduction = (process.env.NODE_ENV || "production") === "production";
const isVercel = ["1", "true"].includes(String(process.env.VERCEL || "").trim().toLowerCase());
const isRender =
  ["1", "true"].includes(String(process.env.RENDER || "").trim().toLowerCase()) ||
  Boolean(String(process.env.RENDER_EXTERNAL_URL || "").trim());
const isManagedDeploy = isVercel || isRender;
const vercelFallbackUrl = process.env.VERCEL_URL ? `https://${String(process.env.VERCEL_URL).trim()}` : "https://zeroday-guardian.invalid";
const renderFallbackUrl = String(process.env.RENDER_EXTERNAL_URL || "").trim() || "https://zerodayguardian-backend.onrender.com";
const managedFallbackUrl = isRender ? renderFallbackUrl : vercelFallbackUrl;
const warnDeployConfig = (message) => {
  console.warn(`[neurobot] ${message}`);
};
const required = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "JWT_SECRET",
  "CORS_ORIGIN",
];

export const env = {
  nodeEnv: process.env.NODE_ENV || "production",
  port: Number(process.env.PORT || process.env.NEUROBOT_PORT || 10000),
  corsOrigin: process.env.CORS_ORIGIN || (isProduction ? "" : "http://localhost:8080"),
  openaiBaseUrl: normalizeApiBaseUrl(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", "OPENAI_BASE_URL"),
  openaiApiKey: firstSet("OPENAI_API_KEY", "LLM_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  openaiMaxOutputTokens: clamp(process.env.OPENAI_MAX_OUTPUT_TOKENS, 128, 8192, 2048),
  openrouterBaseUrl: normalizeApiBaseUrl(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1", "OPENROUTER_BASE_URL"),
  openrouterApiKey: firstSet("OPENROUTER_API_KEY", "LLM_API_KEY"),
  openrouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
  openrouterMaxOutputTokens: clamp(process.env.OPENROUTER_MAX_OUTPUT_TOKENS, 128, 4096, 768),
  deepseekBaseUrl: normalizeApiBaseUrl(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com", "DEEPSEEK_BASE_URL"),
  deepseekApiKey: firstSet("DEEPSEEK_API_KEY", "LLM_API_KEY"),
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  deepseekMaxOutputTokens: clamp(process.env.DEEPSEEK_MAX_OUTPUT_TOKENS, 128, 4096, 768),
  googleBaseUrl: normalizeApiBaseUrl(
    process.env.GOOGLE_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
    "GOOGLE_BASE_URL"
  ),
  googleApiKey: firstSet("GOOGLE_API_KEY", "LLM_API_KEY"),
  googleModel: process.env.GOOGLE_MODEL || "gemini-2.0-flash",
  googleMaxOutputTokens: clamp(process.env.GOOGLE_MAX_OUTPUT_TOKENS, 128, 4096, 768),
  ollamaBaseUrl: normalizeOllamaBaseUrl(process.env.OLLAMA_BASE_URL),
  ollamaModel: process.env.OLLAMA_MODEL || "llama3",
  ollamaNumPredict: clamp(process.env.OLLAMA_NUM_PREDICT, 32, 1024, 96),
  ollamaBackupBaseUrl: normalizeOllamaBaseUrl(process.env.OLLAMA_BACKUP_BASE_URL || process.env.OLLAMA_BASE_URL),
  ollamaBackupModel: process.env.OLLAMA_BACKUP_MODEL || "",
  ollamaBackupNumPredict: clamp(process.env.OLLAMA_BACKUP_NUM_PREDICT, 32, 1024, 96),
  mongoUri: firstSet("DATABASE_URL", "MONGODB_URI"),
  redisUrl: process.env.REDIS_URL || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtIssuer: process.env.JWT_ISSUER || "neurobot-backend",
  jwtAudience: process.env.JWT_AUDIENCE || "neurobot-app",
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
  primaryProvider: firstSet("PRIMARY_PROVIDER") || "openrouter",
  fallbackProvider: firstSet("FALLBACK_PROVIDER") || "ollama",
  routingMode: (process.env.ROUTING_MODE || "failover").toLowerCase().replace("weighted_round_robin", "weighted"),
  providerPriority: splitCsv(process.env.PROVIDER_PRIORITY || "openrouter,ollama,ollama_backup,google,openai,deepseek"),
  providerWeightsRaw: splitCsv(
    process.env.PROVIDER_WEIGHTS || "openrouter:100,ollama:70,ollama_backup:55,google:50,openai:45,deepseek:35"
  ),
  llmCriticalTimeoutMs: clamp(process.env.LLM_CRITICAL_TIMEOUT_MS, 4000, 30000, 9000),
  llmMaxRetries: clamp(process.env.LLM_MAX_RETRIES, 0, 8, 3),
  llmRetryBaseMs: clamp(process.env.LLM_RETRY_BASE_MS, 150, 5000, 350),
  llmRetryMaxMs: clamp(process.env.LLM_RETRY_MAX_MS, 300, 10000, 1200),
  llmRateLimitBackoffMs: clamp(process.env.LLM_RATE_LIMIT_BACKOFF_MS, 250, 30000, 1000),
  llmMaxLatencyMs: Math.max(200, Math.min(20000, toNum(process.env.LLM_MAX_LATENCY_MS, 1800))),
  llmQueueConcurrency: clamp(process.env.LLM_QUEUE_CONCURRENCY, 1, 64, process.env.LLM_MODE === "ollama" ? 1 : 8),
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
  freeTierProviderOrder: ["openrouter", "ollama", "ollama_backup", "google", "openai", "deepseek"],
  premiumTierProviderOrder: ["openrouter", "ollama", "ollama_backup", "google", "openai", "deepseek"],
  llmOpsSecret: process.env.LLM_OPS_SECRET || "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
  alertMinLevel: (process.env.ALERT_MIN_LEVEL || "warn").toLowerCase(),
  alertCooldownMs: Math.max(30_000, Math.min(3_600_000, toNum(process.env.ALERT_COOLDOWN_MS, 300_000))),
  strictDependencyStartup:
    isProduction
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
      : isProduction,
  allowLlmFallback:
    process.env.ALLOW_LLM_FALLBACK != null
      ? process.env.ALLOW_LLM_FALLBACK === "true"
      : true,
  forceLocalFallback: (process.env.FORCE_LOCAL_FALLBACK || "false") === "true",
  appBaseUrl: process.env.APP_BASE_URL || process.env.CORS_ORIGIN || (isProduction ? "" : "http://localhost:8080"),
  backendPublicUrl:
    process.env.BACKEND_PUBLIC_URL ||
    process.env.PUBLIC_SERVER_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (isProduction ? "" : `http://localhost:${Number(process.env.NEUROBOT_PORT || 8787)}`),
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
  enableGoogleLocalhost:
    process.env.ENABLE_GOOGLE_LOCALHOST != null
      ? process.env.ENABLE_GOOGLE_LOCALHOST === "true"
      : true,
  googleAuthorizedOrigins: uniqueList(
    splitCsv(process.env.GOOGLE_AUTHORIZED_ORIGINS || process.env.CORS_ORIGIN || (isProduction ? "" : "http://localhost:8080"))
  ),
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  githubOauthClientId: process.env.GITHUB_OAUTH_CLIENT_ID || "",
  githubOauthClientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || "",
  githubApiToken: process.env.GITHUB_API_TOKEN || "",
  oauthSuccessRedirect: process.env.OAUTH_SUCCESS_REDIRECT || "/",
  oauthFailureRedirect: process.env.OAUTH_FAILURE_REDIRECT || "/auth?error=oauth_failed",
  newsRefreshIntervalMs: Math.max(60_000, Math.min(3_600_000, toNum(process.env.NEWS_REFRESH_INTERVAL_MS, 900_000))),
  labDockerEnabled: (process.env.LAB_DOCKER_ENABLED || "false") === "true",
  osintWhoisApiKey: process.env.OSINT_WHOIS_API_KEY || "",
  osintWhoisBaseUrl: process.env.OSINT_WHOIS_BASE_URL || "",
  osintWhoisProvider: process.env.OSINT_WHOIS_PROVIDER || "",
  osintGeoApiKey: process.env.OSINT_GEO_API_KEY || "",
  osintGeoBaseUrl: process.env.OSINT_GEO_BASE_URL || "",
  osintBreachApiKey: process.env.OSINT_BREACH_API_KEY || "",
  osintBreachProvider: process.env.OSINT_BREACH_PROVIDER || "leakcheck",
  osintBreachBaseUrl: process.env.OSINT_BREACH_BASE_URL || "",
  osintPublicShareEnabled: (process.env.OSINT_PUBLIC_SHARE_ENABLED || "false") === "true",
  osintShareBaseUrl: process.env.OSINT_SHARE_BASE_URL || "",
  osintSchedulerEnabled: (process.env.OSINT_SCHEDULER_ENABLED || "true") === "true",
  osintSchedulerIntervalMs: Math.max(30_000, Math.min(900_000, toNum(process.env.OSINT_SCHEDULER_INTERVAL_MS, 60_000))),
  osintSchedulerBatchLimit: Math.max(1, Math.min(20, toNum(process.env.OSINT_SCHEDULER_BATCH_LIMIT, 5))),
  osintAlertWebhookUrl: process.env.OSINT_ALERT_WEBHOOK_URL || "",
  osintAlertSlackWebhookUrl: process.env.OSINT_ALERT_SLACK_WEBHOOK_URL || "",
  osintAlertEmailEnabled: (process.env.OSINT_ALERT_EMAIL_ENABLED || "false") === "true",
  osintSmtpHost: process.env.OSINT_SMTP_HOST || "",
  osintSmtpPort: process.env.OSINT_SMTP_PORT || "",
  osintSmtpUser: process.env.OSINT_SMTP_USER || "",
  osintSmtpPass: process.env.OSINT_SMTP_PASS || "",
  osintSmtpFrom: process.env.OSINT_SMTP_FROM || "",
  osintSmtpTo: process.env.OSINT_SMTP_TO || "",
  osintPdfTemplate: process.env.OSINT_PDF_TEMPLATE || "classic",
  osintPdfBrandName: process.env.OSINT_PDF_BRAND_NAME || "ZeroDay Guardian OSINT",
  osintPdfBrandColor: process.env.OSINT_PDF_BRAND_COLOR || "#38bdf8",
  osintPdfLogoBase64: process.env.OSINT_PDF_LOGO_BASE64 || "",
  authRequireEmailVerification: (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION || "false") === "true",
  authEmailEnabled: (process.env.AUTH_EMAIL_ENABLED || "false") === "true",
  authEmailFromName: process.env.AUTH_EMAIL_FROM_NAME || "ZeroDay Guardian Security",
  authEmailFrom: firstSet("AUTH_EMAIL_FROM", "GMAIL_USER"),
  authEmailUser: firstSet("AUTH_EMAIL_USER", "GMAIL_USER"),
  authEmailAppPassword: firstSet("AUTH_EMAIL_APP_PASSWORD", "GMAIL_PASS"),
  digestEmailEnabled: (process.env.DIGEST_EMAIL_ENABLED || process.env.AUTH_EMAIL_ENABLED || "false") === "true",
  digestEmailFromName: process.env.DIGEST_EMAIL_FROM_NAME || "ZeroDay Guardian Digest",
  digestEmailFrom: firstSet("DIGEST_EMAIL_FROM", "AUTH_EMAIL_FROM", "GMAIL_USER"),
  digestEmailUser: firstSet("DIGEST_EMAIL_USER", "AUTH_EMAIL_USER", "GMAIL_USER"),
  digestEmailAppPassword: firstSet("DIGEST_EMAIL_APP_PASSWORD", "AUTH_EMAIL_APP_PASSWORD", "GMAIL_PASS"),
  pushVapidPublicKey: process.env.PUSH_VAPID_PUBLIC_KEY || "",
  pushVapidPrivateKey: process.env.PUSH_VAPID_PRIVATE_KEY || "",
  pushVapidSubject: process.env.PUSH_VAPID_SUBJECT || "mailto:ksubhraj28@gmail.com",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePremiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID || "",
  stripeTeamPriceId: process.env.STRIPE_TEAM_PRICE_ID || "",
  stripePortalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL || "",
  authOtpPreviewEnabled: false,
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
env.googleAuthorizedOrigins = uniqueList(env.googleAuthorizedOrigins);
if (isVercel) {
  if (!env.appBaseUrl) {
    env.appBaseUrl = managedFallbackUrl;
    warnDeployConfig(`APP_BASE_URL missing during Vercel build/runtime. Using fallback ${env.appBaseUrl}`);
  }
  if (!env.backendPublicUrl) {
    env.backendPublicUrl = managedFallbackUrl;
    warnDeployConfig(`BACKEND_PUBLIC_URL missing during Vercel build/runtime. Using fallback ${env.backendPublicUrl}`);
  }
  if (!env.corsOrigin) {
    env.corsOrigin = env.appBaseUrl;
    warnDeployConfig(`CORS_ORIGIN missing during Vercel build/runtime. Using fallback ${env.corsOrigin}`);
  }
  env.corsOrigins = uniqueList(splitCsv(env.corsOrigin));
  if (!env.googleAuthorizedOrigins.length) {
    env.googleAuthorizedOrigins = [...env.corsOrigins];
  }
  if (!env.sessionSecret) {
    env.sessionSecret = "vercel-session-secret-placeholder-0000000000000000";
    warnDeployConfig("SESSION_SECRET missing during Vercel build/runtime. Using a placeholder secret until env is configured.");
  }
  if (!env.jwtSecret) {
    env.jwtSecret = "vercel-jwt-secret-placeholder-000000000000000000000000";
    warnDeployConfig("JWT_SECRET missing during Vercel build/runtime. Using a placeholder secret until env is configured.");
  }
  if (!env.dbEncryptionKey) {
    env.dbEncryptionKey = "vercel-db-encryption-key-placeholder-000000000000000";
    warnDeployConfig("DB_ENCRYPTION_KEY missing during Vercel build/runtime. Using a placeholder key until env is configured.");
  }
}
if (isRender) {
  if (!env.appBaseUrl) {
    env.appBaseUrl = process.env.CORS_ORIGIN || env.backendPublicUrl || managedFallbackUrl;
    warnDeployConfig(`APP_BASE_URL missing during Render startup. Using fallback ${env.appBaseUrl}`);
  }
  if (!env.backendPublicUrl) {
    env.backendPublicUrl = managedFallbackUrl;
    warnDeployConfig(`BACKEND_PUBLIC_URL missing during Render startup. Using fallback ${env.backendPublicUrl}`);
  }
  if (!env.corsOrigin) {
    env.corsOrigin = env.appBaseUrl || env.backendPublicUrl || managedFallbackUrl;
    warnDeployConfig(`CORS_ORIGIN missing during Render startup. Using fallback ${env.corsOrigin}`);
  }
  env.corsOrigins = uniqueList(splitCsv(env.corsOrigin));
  if (!env.googleAuthorizedOrigins.length) {
    env.googleAuthorizedOrigins = [...env.corsOrigins];
  }
  if (!env.sessionSecret) {
    env.sessionSecret = "render-session-secret-placeholder-0000000000000000";
    warnDeployConfig("SESSION_SECRET missing during Render startup. Using a placeholder secret until env is configured.");
  }
  if (!env.jwtSecret) {
    env.jwtSecret = "render-jwt-secret-placeholder-000000000000000000000000";
    warnDeployConfig("JWT_SECRET missing during Render startup. Using a placeholder secret until env is configured.");
  }
  if (!env.dbEncryptionKey) {
    env.dbEncryptionKey = "render-db-encryption-key-placeholder-000000000000000";
    warnDeployConfig("DB_ENCRYPTION_KEY missing during Render startup. Using a placeholder key until env is configured.");
  }
}
if (!env.googleRedirectUri && env.backendPublicUrl) {
  try {
    env.googleRedirectUri = new URL("/auth/google/callback", env.backendPublicUrl).toString();
  } catch {
    env.googleRedirectUri = `${env.backendPublicUrl.replace(/\/+$/, "")}/auth/google/callback`;
  }
}

const appBaseHost = (() => {
  try {
    return new URL(env.appBaseUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
})();
const localLikeAppHost = ["localhost", "127.0.0.1", "::1"].includes(appBaseHost);
env.authOtpPreviewEnabled = isExplicitTrue(process.env.AUTH_OTP_PREVIEW_ENABLED)
  ? true
  : isExplicitFalse(process.env.AUTH_OTP_PREVIEW_ENABLED)
    ? false
      : env.nodeEnv !== "production" || localLikeAppHost;

const missing = required.filter((key) => {
  if (key === "DATABASE_URL") return !env.mongoUri;
  if (key === "CORS_ORIGIN") return !env.corsOrigin;
  if (key === "JWT_SECRET") return !env.jwtSecret;
  return !process.env[key] || !String(process.env[key]).trim();
});

if (missing.length) {
  if (isManagedDeploy) {
    warnDeployConfig(`Missing required env vars during managed deployment: ${missing.join(", ")}. API will run in degraded mode until these are configured.`);
  } else {
    throw new Error(`[neurobot] Missing required env vars: ${missing.join(", ")}`);
  }
}

if (!Number.isFinite(env.port) || env.port <= 0 || env.port > 65535) {
  throw new Error("[neurobot] Invalid NEUROBOT_PORT");
}
if (String(env.jwtSecret || "").length < 32) {
  if (isManagedDeploy) {
    warnDeployConfig("JWT_SECRET is shorter than 32 characters. Configure a real production secret in your deployment env.");
  } else {
    throw new Error("[neurobot] JWT_SECRET must be at least 32 characters");
  }
}
if (env.llmRetryMaxMs < env.llmRetryBaseMs) {
  throw new Error("[neurobot] LLM_RETRY_MAX_MS must be >= LLM_RETRY_BASE_MS");
}
if (env.streamRetryMaxMs < env.streamRetryMinMs) {
  throw new Error("[neurobot] STREAM_RETRY_MAX_MS must be >= STREAM_RETRY_MIN_MS");
}
if (env.llmCriticalTimeoutMs < 4000) {
  throw new Error("[neurobot] LLM_CRITICAL_TIMEOUT_MS must be >= 4000");
}
if (!new Set(["info", "warn", "error"]).has(env.alertMinLevel)) {
  throw new Error("[neurobot] ALERT_MIN_LEVEL must be one of: info|warn|error");
}

if (env.nodeEnv === "production") {
  if (!env.appBaseUrl || !/^https?:\/\//.test(env.appBaseUrl)) {
    if (isManagedDeploy) {
      warnDeployConfig("APP_BASE_URL is not an absolute URL. Configure a real production APP_BASE_URL in deployment env.");
    } else {
      throw new Error("[neurobot] APP_BASE_URL must be set to an absolute https:// or http:// URL in production");
    }
  }
  if (!env.backendPublicUrl || !/^https?:\/\//.test(env.backendPublicUrl)) {
    if (isManagedDeploy) {
      warnDeployConfig("BACKEND_PUBLIC_URL is not an absolute URL. Configure a real production BACKEND_PUBLIC_URL in deployment env.");
    } else {
      throw new Error("[neurobot] BACKEND_PUBLIC_URL must be set to an absolute https:// or http:// URL in production");
    }
  }
  if (String(env.dbEncryptionKey || "").length < 32) {
    if (isManagedDeploy) {
      warnDeployConfig("DB_ENCRYPTION_KEY is shorter than 32 characters. Configure a real production key in deployment env.");
    } else {
      throw new Error("[neurobot] DB_ENCRYPTION_KEY must be at least 32 characters in production");
    }
  }
  if (!env.corsOrigins.length) {
    if (isManagedDeploy) {
      warnDeployConfig("CORS_ORIGIN is empty in production. Configure at least one frontend origin in deployment env.");
    } else {
      throw new Error("[neurobot] CORS_ORIGIN must include at least one origin in production");
    }
  }
  for (const origin of env.corsOrigins) {
    if (!/^https?:\/\//.test(origin)) {
      if (isManagedDeploy) {
        warnDeployConfig("One or more CORS_ORIGIN entries are not absolute URLs. Configure valid origins in deployment env.");
        break;
      } else {
        throw new Error("[neurobot] CORS_ORIGIN entries must be absolute URLs in production");
      }
    }
  }
}

if (!env.mongoUri) {
  env.mongo = createDegradedMongoConfig("missing");
} else {
  try {
    env.mongo = parseMongoUrl(env.mongoUri);
  } catch (error) {
    if (isManagedDeploy) {
      warnDeployConfig(
        `DATABASE_URL is unavailable or malformed during deployment startup. Using degraded API mode until it is configured.`
      );
      env.mongo = createDegradedMongoConfig("invalid");
    } else {
      throw error;
    }
  }
}

const supportedProviders = new Set(["openrouter", "openai", "deepseek", "google", "ollama", "ollama_backup"]);
const supportedModes = new Set(["auto", "openrouter", "openai", "deepseek", "google", "ollama", "ollama_backup"]);
const supportedRouting = new Set(["primary", "weighted", "failover"]);

if (!supportedModes.has(env.llmMode)) {
  throw new Error("[neurobot] LLM_PROVIDER/LLM_MODE must be one of: auto|openrouter|openai|deepseek|google|ollama|ollama_backup");
}
if (!supportedRouting.has(env.routingMode)) {
  throw new Error("[neurobot] ROUTING_MODE must be one of: primary|weighted|weighted_round_robin|failover");
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
  openrouter: rawWeights.openrouter || 100,
  openai: rawWeights.openai || 90,
  deepseek: rawWeights.deepseek || 80,
  google: rawWeights.google || 85,
  ollama: rawWeights.ollama || 40,
  ollama_backup: rawWeights.ollama_backup || 25,
};

env.hasOpenAi = !!String(env.openaiBaseUrl || "").trim() && !!String(env.openaiModel || "").trim() && !!String(env.openaiApiKey || "").trim();
env.hasOpenRouter =
  !!String(env.openrouterBaseUrl || "").trim() && !!String(env.openrouterModel || "").trim() && !!String(env.openrouterApiKey || "").trim();
env.hasDeepSeek =
  !!String(env.deepseekBaseUrl || "").trim() && !!String(env.deepseekModel || "").trim() && !!String(env.deepseekApiKey || "").trim();
env.hasGoogle =
  !!String(env.googleBaseUrl || "").trim() && !!String(env.googleModel || "").trim() && !!String(env.googleApiKey || "").trim();
env.hasOllama = !!String(env.ollamaBaseUrl || "").trim() && !!String(env.ollamaModel || "").trim();
env.hasOllamaBackup = !!String(env.ollamaBackupBaseUrl || "").trim() && !!String(env.ollamaBackupModel || "").trim();
env.configuredProviders = [
  ...(env.hasOpenRouter ? ["openrouter"] : []),
  ...(env.hasOpenAi ? ["openai"] : []),
  ...(env.hasDeepSeek ? ["deepseek"] : []),
  ...(env.hasGoogle ? ["google"] : []),
  ...(env.hasOllama ? ["ollama"] : []),
  ...(env.hasOllamaBackup ? ["ollama_backup"] : []),
];
env.activeProviderOrder = uniqueList([
  ...[env.primaryProvider, env.fallbackProvider].filter((provider) => env.configuredProviders.includes(provider)),
  ...env.providerPriority.filter((provider) => env.configuredProviders.includes(provider)),
  ...env.configuredProviders,
]);

const openrouterEnabled = env.llmMode === "openrouter" && env.hasOpenRouter;
const openaiEnabled = env.llmMode === "openai" && env.hasOpenAi;
const deepseekEnabled = env.llmMode === "deepseek" && env.hasDeepSeek;
const googleEnabled = env.llmMode === "google" && env.hasGoogle;
const ollamaEnabled = env.llmMode === "ollama" && env.hasOllama;
const ollamaBackupEnabled = env.llmMode === "ollama_backup" && env.hasOllamaBackup;

if (env.llmMode === "openrouter" && !env.hasOpenRouter) {
  throw new Error("[neurobot] OPENROUTER_BASE_URL, OPENROUTER_MODEL, and OPENROUTER_API_KEY are required for current LLM_PROVIDER");
}
if (env.llmMode === "openai" && !env.hasOpenAi) {
  throw new Error("[neurobot] OPENAI_BASE_URL, OPENAI_MODEL, and OPENAI_API_KEY are required for current LLM_PROVIDER");
}
if (env.llmMode === "deepseek" && !env.hasDeepSeek) {
  throw new Error("[neurobot] DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, and DEEPSEEK_API_KEY are required for current LLM_PROVIDER");
}
if (env.llmMode === "google" && !env.hasGoogle) {
  throw new Error("[neurobot] GOOGLE_BASE_URL, GOOGLE_MODEL, and GOOGLE_API_KEY are required for current LLM_PROVIDER");
}
if (env.llmMode === "ollama" && !env.hasOllama) {
  throw new Error("[neurobot] OLLAMA_BASE_URL and OLLAMA_MODEL are required for current LLM_PROVIDER");
}
if (env.llmMode === "ollama_backup" && !env.hasOllamaBackup) {
  throw new Error("[neurobot] OLLAMA_BACKUP_BASE_URL and OLLAMA_BACKUP_MODEL are required for current LLM_PROVIDER");
}
if (openrouterEnabled || env.hasOpenRouter) {
  const openrouterUrl = new URL(env.openrouterBaseUrl);
  if (!["http:", "https:"].includes(openrouterUrl.protocol)) {
    throw new Error("[neurobot] OPENROUTER_BASE_URL must use http:// or https://");
  }
}
if (openaiEnabled || env.hasOpenAi) {
  const openaiUrl = new URL(env.openaiBaseUrl);
  if (!["http:", "https:"].includes(openaiUrl.protocol)) {
    throw new Error("[neurobot] OPENAI_BASE_URL must use http:// or https://");
  }
}
if (deepseekEnabled || env.hasDeepSeek) {
  const deepseekUrl = new URL(env.deepseekBaseUrl);
  if (!["http:", "https:"].includes(deepseekUrl.protocol)) {
    throw new Error("[neurobot] DEEPSEEK_BASE_URL must use http:// or https://");
  }
}
if (googleEnabled || env.hasGoogle) {
  const googleUrl = new URL(env.googleBaseUrl);
  if (!["http:", "https:"].includes(googleUrl.protocol)) {
    throw new Error("[neurobot] GOOGLE_BASE_URL must use http:// or https://");
  }
}
if (ollamaEnabled) {
  const ollamaUrl = new URL(env.ollamaBaseUrl);
  if (!["http:", "https:"].includes(ollamaUrl.protocol)) {
    throw new Error("[neurobot] OLLAMA_BASE_URL must use http:// or https://");
  }
}
if (ollamaBackupEnabled || env.hasOllamaBackup) {
  const ollamaBackupUrl = new URL(env.ollamaBackupBaseUrl);
  if (!["http:", "https:"].includes(ollamaBackupUrl.protocol)) {
    throw new Error("[neurobot] OLLAMA_BACKUP_BASE_URL must use http:// or https://");
  }
}
