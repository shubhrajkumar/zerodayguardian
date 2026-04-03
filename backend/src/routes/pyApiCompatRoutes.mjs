import { Router } from "express";
import mongoose from "mongoose";
import net from "node:net";
import { z } from "zod";
import { getDb } from "../config/db.mjs";
import { User } from "../models/User.mjs";
import { Scan } from "../models/Scan.mjs";
import { OsintQuery } from "../models/OsintQuery.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.mjs";
import { runWebSecurityScan } from "../../services/ai-engine/intelligenceService.mjs";
import { createNotification } from "../services/notificationService.mjs";
import { requestLlm } from "../services/llmService.mjs";
import { scanDomainOsint, scanEmailOsint, scanIpOsint } from "../services/osintService.mjs";
import { TtlCache } from "../utils/ttlCache.mjs";
import { logInfo } from "../utils/logger.mjs";

const router = Router();
const PYTHON_API_BASE_URL = String(process.env.PY_API_INTERNAL_URL || `http://127.0.0.1:${process.env.PY_API_PORT || "8000"}`).replace(/\/+$/, "");
const threatCache = new TtlCache({ ttlMs: 30_000, maxEntries: 200 });
const osintIntelCache = new TtlCache({ ttlMs: 120_000, maxEntries: 300 });
const scanHistoryCache = new TtlCache({ ttlMs: 12_000, maxEntries: 300 });
const scanReportCache = new TtlCache({ ttlMs: 20_000, maxEntries: 300 });
const osintHistoryCache = new TtlCache({ ttlMs: 12_000, maxEntries: 300 });
const PyUserBridgeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: null },
    externalId: { type: String, default: null, index: true },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "py_users",
  }
);

const PyUserBridge = mongoose.models.PyUserBridge || mongoose.model("PyUserBridge", PyUserBridgeSchema);

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;

const normalizeRiskLevel = (value = "") => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high" || normalized === "medium") return normalized;
  return "low";
};

const mapSeverity = (value = "") => {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "high" || normalized === "low") return normalized;
  return "medium";
};

const createHttpError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const requireOwnedUserId = (req, requestedUserId = "", { allowEmpty = true } = {}) => {
  const authUserId = String(req.user?.sub || "").trim();
  const normalizedRequested = String(requestedUserId || "").trim();
  if (!normalizedRequested) {
    if (allowEmpty) return authUserId;
    throw createHttpError(400, "user_id_required", "A user id is required for this request");
  }
  if (!authUserId) {
    throw createHttpError(401, "auth_required", "Authentication required");
  }
  if (normalizedRequested !== authUserId) {
    throw createHttpError(403, "user_scope_forbidden", "You cannot access another user's data");
  }
  return authUserId;
};

const requireOwnedObjectId = (req, requestedUserId = "", options = {}) => {
  const ownerUserId = requireOwnedUserId(req, requestedUserId, options);
  const objectId = toObjectId(ownerUserId);
  if (!objectId) {
    throw createHttpError(400, "invalid_user_id", "Authenticated user id is not valid for this resource");
  }
  return objectId;
};

const userBridgeSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().min(1).max(120).optional().nullable(),
  external_id: z.string().trim().min(1).max(200).optional().nullable(),
});

const scanQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  risk_level: z.enum(["all", "low", "medium", "high"]).default("all"),
  user_id: z.string().trim().min(1).max(200).optional(),
});

const osintHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  target_type: z.enum(["all", "email", "domain", "ip"]).default("all"),
  risk_level: z.enum(["all", "low", "medium", "high"]).default("all"),
  user_id: z.string().trim().min(1).max(200).optional(),
});

const reportParamsSchema = z.object({
  reportId: z.string().trim().min(1).max(200),
});

const scanRequestSchema = z.object({
  url: z.string().trim().url().max(2048),
  user_id: z.string().trim().min(1).max(200).optional(),
});

const threatRequestSchema = z.object({
  user_id: z.string().trim().min(1).max(200).optional(),
  metrics: z.object({
    requests_per_min: z.coerce.number().min(0).max(1_000_000).default(0),
    error_rate: z.coerce.number().min(0).max(1).default(0),
    failed_logins: z.coerce.number().min(0).max(100_000).default(0),
    anomaly_score: z.coerce.number().min(0).max(1).default(0),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
});

const osintIntelRequestSchema = z.object({
  query: z.string().trim().min(3).max(255),
  notes: z.string().trim().max(500).optional().nullable(),
  force_refresh: z.coerce.boolean().optional().default(false),
});
const dayLabParamsSchema = z.object({
  dayNumber: z.coerce.number().int().min(1).max(60),
});
const dayLabSubmitSchema = z.object({
  task_id: z.string().trim().min(2).max(64),
  answer: z.string().trim().min(1).max(4000),
});
const userEventSchema = z.object({
  event_type: z.string().trim().min(2).max(64),
  surface: z.string().trim().min(2).max(64),
  target: z.string().trim().max(500).optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
  user_id: z.string().trim().min(1).max(200).optional().nullable(),
});
const dailyProgressSchema = z.object({
  day: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  missions_completed: z.coerce.number().int().min(0).max(10_000).default(0),
  xp_earned: z.coerce.number().int().min(0).max(1_000_000).default(0),
  streak_day: z.coerce.number().int().min(0).max(10_000).default(0),
  user_id: z.string().trim().min(1).max(200).optional().nullable(),
});
const missionActionSchema = z.object({
  action_type: z.enum([
    "program_day_complete",
    "sandbox_mission_complete",
    "learn_track_started",
    "learn_track_completed",
    "mentor_open",
    "recommendation_reviewed",
    "command_center_opened",
    "mission_hidden_discovered",
    "mission_hidden_completed",
    "insight_shared",
    "referral_invite_sent",
    "referral_signup_completed",
    "notification_opened",
    "notification_preferences_updated",
  ]),
  target: z.string().trim().min(1).max(255).optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
});
const missionPreferencesSchema = z.object({
  email_enabled: z.coerce.boolean().optional(),
  push_enabled: z.coerce.boolean().optional(),
  streak_alerts: z.coerce.boolean().optional(),
  referral_alerts: z.coerce.boolean().optional(),
  digest_enabled: z.coerce.boolean().optional(),
  preferred_window: z.string().trim().min(3).max(32).optional(),
  quiet_hours: z.string().trim().min(3).max(32).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
});

const EMAIL_REGEX = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i;
const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i;
const NO_VERIFIED_DATA = "No verified data.";
const OSINT_DEDUPE_WINDOW_MS = 10 * 60_000;
const THREAT_LLM_TIMEOUT_MS = 1500;
const DAY_LAB_COLLECTION = "py_day_lab_states";
const DAILY_PROGRESS_COLLECTION = "py_daily_progress";
const USER_EVENTS_COLLECTION = "py_user_events";
const DAY_LAB_FOCUS_META = {
  foundation: {
    difficulty: "beginner",
    environment: "Kali shell + safe workstation baseline target",
    kaliTools: ["bash", "ip", "ss", "grep"],
    scenario:
      "You are building baseline operator habits and must prove you can connect commands to evidence before touching high-risk workflows.",
  },
  intel: {
    difficulty: "intermediate",
    environment: "Recon workspace + verified external footprint review",
    kaliTools: ["whois", "dig", "nslookup", "curl"],
    scenario:
      "You are profiling a scoped target and must separate verified exposure from assumption before escalating risk.",
  },
  appsec: {
    difficulty: "intermediate",
    environment: "Staging web target + safe validation workflow",
    kaliTools: ["curl", "ffuf", "nikto", "burpsuite"],
    scenario:
      "You are reviewing a web application before release and need to show both the likely weakness and the remediation path.",
  },
  defense: {
    difficulty: "intermediate",
    environment: "SOC console + synthetic alert evidence",
    kaliTools: ["grep", "jq", "cat", "journalctl"],
    scenario:
      "You are on shift and must move from alert to containment with disciplined evidence handling.",
  },
  cloud: {
    difficulty: "advanced",
    environment: "Cloud practice shell + hardening simulation",
    kaliTools: ["aws", "kubectl", "docker", "trivy"],
    scenario:
      "You are hardening a cloud workload where one weak default can create a public incident.",
  },
  hunt: {
    difficulty: "advanced",
    environment: "Hunt workstation + event timeline simulator",
    kaliTools: ["jq", "grep", "python3", "yara"],
    scenario:
      "You are threat hunting through noisy telemetry and must justify escalation with evidence quality, not instinct.",
  },
  capstone: {
    difficulty: "pro",
    environment: "Operator project lab + reporting workspace",
    kaliTools: ["nmap", "curl", "python3", "git"],
    scenario:
      "You are producing job-ready operator output: evidence, workflow, decision quality, and concise reporting.",
  },
};
const DAY_LAB_PROGRAM = [
  ["Security mindset + CIA triad", "foundation"],
  ["Linux basics", "foundation"],
  ["Networking 101", "foundation"],
  ["HTTP fundamentals", "foundation"],
  ["OSINT basics", "intel"],
  ["Password security", "foundation"],
  ["Review + recap", "foundation"],
  ["Recon workflow", "intel"],
  ["Web auth flows", "appsec"],
  ["TLS basics", "appsec"],
  ["Headers security", "appsec"],
  ["Input validation", "appsec"],
  ["SQLi basics", "appsec"],
  ["Review", "appsec"],
  ["Threat modeling", "defense"],
  ["Logging & SIEM", "defense"],
  ["Detection basics", "defense"],
  ["Incident response", "defense"],
  ["Phishing defense", "defense"],
  ["MFA & identity", "defense"],
  ["Review", "defense"],
  ["Web app test plan", "appsec"],
  ["OWASP risks overview", "appsec"],
  ["API security", "appsec"],
  ["Access control", "appsec"],
  ["File upload risks", "appsec"],
  ["CSRF basics", "appsec"],
  ["Review", "appsec"],
  ["OSINT workflow deep dive", "intel"],
  ["Threat intel triage", "intel"],
  ["Breach response", "defense"],
  ["Vulnerability management", "defense"],
  ["Patch verification", "defense"],
  ["Security monitoring", "defense"],
  ["Review", "defense"],
  ["Cloud basics", "cloud"],
  ["Storage security", "cloud"],
  ["Container security", "cloud"],
  ["CI/CD security", "cloud"],
  ["Secrets management", "cloud"],
  ["Endpoint basics", "defense"],
  ["Review", "cloud"],
  ["Threat hunting workflow", "hunt"],
  ["Anomaly detection", "hunt"],
  ["Insider risk", "hunt"],
  ["Ransomware response", "defense"],
  ["Data loss prevention", "defense"],
  ["Risk scoring", "defense"],
  ["Review", "hunt"],
  ["Portfolio build", "capstone"],
  ["Resume focus", "capstone"],
  ["Interview prep", "capstone"],
  ["Live case study", "capstone"],
  ["Secure design", "capstone"],
  ["Automation", "capstone"],
  ["Final review", "capstone"],
  ["Capstone build 1", "capstone"],
  ["Capstone build 2", "capstone"],
  ["Capstone audit", "capstone"],
  ["Capstone report", "capstone"],
].map(([title, focus], index) => ({ day: index + 1, title, focus }));

const respondOk = (res, data, meta = undefined) =>
  res.json({
    status: "ok",
    data,
    ...(meta ? { meta } : {}),
  });

const respondCreated = (res, data, meta = undefined) =>
  res.status(201).json({
    status: "ok",
    data,
    ...(meta ? { meta } : {}),
  });

const buildListMeta = ({ page = 1, limit = 10, total = 0 }) => ({
  page,
  limit,
  total,
  totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

const invalidateUserScopedCache = (cache, userId) => {
  const prefix = `${String(userId)}:`;
  for (const key of cache.store.keys()) {
    if (String(key).startsWith(prefix)) cache.delete(key);
  }
};

const invalidateScanCaches = (userId, scanId = "") => {
  invalidateUserScopedCache(scanHistoryCache, userId);
  invalidateUserScopedCache(scanReportCache, userId);
  if (scanId) scanReportCache.delete(`${String(userId)}:${String(scanId)}`);
};

const invalidateOsintCaches = (userId) => {
  invalidateUserScopedCache(osintHistoryCache, userId);
};

const inferOsintTargetType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (EMAIL_REGEX.test(normalized)) return "email";
  if (net.isIP(normalized)) return "ip";
  if (DOMAIN_REGEX.test(normalized)) return "domain";
  return "domain";
};

const dedupeLines = (lines = [], limit = 5) => {
  const output = [];
  for (const line of lines) {
    const value = String(line || "").trim();
    if (!value || output.includes(value)) continue;
    output.push(value);
    if (output.length >= limit) break;
  }
  return output;
};

const shortLines = (lines = [], limit = 3) => dedupeLines(lines, limit).map((line) => String(line).slice(0, 160).trim());

const buildOsintAdvice = (payload = {}) => {
  const targetType = String(payload?.target_type || "domain").toLowerCase();
  const riskLevel = normalizeRiskLevel(payload?.risk_level);
  const verifiedSignals = Array.isArray(payload?.verified_signals) ? payload.verified_signals : [];
  const advice = [];

  if (targetType === "email") {
    if (!verifiedSignals.includes("mx")) advice.push("Publish and verify working MX records for the mail domain.");
    if (!verifiedSignals.includes("domain_syntax")) advice.push("Confirm the mailbox uses a valid registered domain.");
  } else if (targetType === "ip") {
    if (!verifiedSignals.includes("reverse_dns")) advice.push("Verify PTR records if this IP should resolve publicly.");
    if (!verifiedSignals.includes("ip_validation")) advice.push("Retest with a valid public IPv4 or IPv6 address.");
  } else {
    if (!verifiedSignals.includes("ns")) advice.push("Check authoritative NS delegation and zone health.");
    if (!verifiedSignals.includes("a")) advice.push("Publish or verify live A records for the domain.");
    if (!verifiedSignals.includes("registrar")) advice.push("Confirm registrar and RDAP records are publicly available.");
  }

  if (!advice.length) {
    advice.push(riskLevel === "high" ? "Escalate for remediation and retest after changes." : "Continue monitoring verified public records.");
  }
  return shortLines(advice, 3);
};

const buildOsintConfidence = (payload = {}) => {
  const checked = Array.isArray(payload?.checked_signals) ? payload.checked_signals.length : 0;
  const verified = Array.isArray(payload?.verified_signals) ? payload.verified_signals.length : 0;
  const riskLevel = normalizeRiskLevel(payload?.risk_level);
  if (!checked) return 0;
  const ratio = verified / checked;
  const score =
    ratio >= 0.8 ? 0.94
      : ratio >= 0.6 ? 0.84
        : ratio >= 0.4 ? 0.72
          : ratio >= 0.2 ? 0.58
            : 0.38;
  const adjusted = payload?.verified
    ? score
    : riskLevel === "high"
      ? Math.max(0.42, score - 0.12)
      : Math.max(0.24, score - 0.18);
  return Number(adjusted.toFixed(2));
};

const buildOsintSourceSummary = (payload = {}) => {
  const targetType = String(payload?.target_type || "domain").toLowerCase();
  const verifiedSignals = Array.isArray(payload?.verified_signals) ? payload.verified_signals : [];
  const map = {
    email: ["email format", "DNS", "MX", "NS"],
    domain: ["DNS", "A", "MX", "NS", "RDAP/WHOIS"],
    ip: ["IP validation", "reverse DNS"],
  };
  const sourceLabel = targetType === "email" ? "mail-domain validation" : targetType === "ip" ? "network identity validation" : "domain registration + DNS";
  return shortLines([
    `${sourceLabel} used ${verifiedSignals.length} verified signal${verifiedSignals.length === 1 ? "" : "s"}.`,
    targetType === "domain" ? "Verified sources: live DNS + RDAP/WHOIS fallback." : "",
    targetType === "email" ? "Verified sources: syntax checks + live DNS/MX." : "",
    targetType === "ip" ? "Verified sources: IP validation + reverse DNS." : "",
    `Signal families checked: ${(map[targetType] || map.domain).join(", ")}.`,
  ], 3);
};

const buildOsintExecutiveSummary = (payload = {}) => {
  const target = String(payload?.normalized_query || payload?.query || "target").trim();
  const type = String(payload?.target_type || "domain").toUpperCase();
  const level = String(payload?.risk_level || "low").toUpperCase();
  const score = Number(payload?.risk_score || 0);
  if (!payload?.verified) return `${type} ${target} has no fully verified intelligence result. ${NO_VERIFIED_DATA}`;
  if (level === "HIGH") return `${type} ${target} shows high-risk verified issues with score ${score}.`;
  if (level === "MEDIUM") return `${type} ${target} has mixed verified signals and needs review.`;
  return `${type} ${target} resolved with low-risk verified posture.`;
};

const buildOsintActionableInsights = (payload = {}) =>
  shortLines(
    [
      ...buildOsintAdvice(payload),
      payload?.verified
        ? "Record the verified indicators and recheck after infrastructure changes."
        : "Do not escalate until at least one stronger verified signal is confirmed.",
    ],
    4
  );

const buildOsintHistoryItem = (row) => ({
  id: String(row?._id || ""),
  query: String(row?.query || ""),
  normalized_query: String(row?.normalizedQuery || ""),
  target_type: String(row?.targetType || "domain"),
  risk_level: normalizeRiskLevel(row?.riskLevel || row?.result?.risk_level),
  verified: Boolean(row?.verified),
  request_count: Number(row?.requestCount || 1),
  created_at: new Date(row?.createdAt || Date.now()).toISOString(),
  updated_at: new Date(row?.updatedAt || row?.lastSeenAt || Date.now()).toISOString(),
  reasons: shortLines(row?.result?.reasons || [], 3),
  bullets: shortLines(row?.result?.bullets || [], 3),
});

const persistOsintHistory = async ({ userId, payload, modules = ["dns", "mx", "whois", "ip"] }) => {
  const normalizedQuery = String(payload?.normalized_query || payload?.query || "").trim().toLowerCase();
  const targetType = String(payload?.target_type || inferOsintTargetType(normalizedQuery)).trim().toLowerCase();
  const dedupeKey = `${String(userId)}::${targetType}::${normalizedQuery}`;
  const threshold = new Date(Date.now() - OSINT_DEDUPE_WINDOW_MS);

  const existing = await OsintQuery.findOne({
    userId,
    dedupeKey,
    updatedAt: { $gte: threshold },
  });

  if (existing) {
    existing.query = String(payload?.query || existing.query || normalizedQuery);
    existing.normalizedQuery = normalizedQuery;
    existing.targetType = targetType;
    existing.riskLevel = normalizeRiskLevel(payload?.risk_level || existing.riskLevel);
    existing.verified = Boolean(payload?.verified);
    existing.modules = modules;
    existing.result = payload;
    existing.lastSeenAt = new Date();
    existing.requestCount = Number(existing.requestCount || 1) + 1;
    await existing.save();
    return existing.toObject();
  }

  const created = await OsintQuery.create({
    userId,
    query: String(payload?.query || normalizedQuery),
    normalizedQuery,
    targetType,
    riskLevel: normalizeRiskLevel(payload?.risk_level),
    verified: Boolean(payload?.verified),
    dedupeKey,
    requestCount: 1,
    lastSeenAt: new Date(),
    modules,
    result: payload,
  });
  return created.toObject();
};

const buildOsintFallback = async ({ query, notes }) => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const targetType = inferOsintTargetType(normalizedQuery);
  const minimalAiEligible = `${normalizedQuery} ${String(notes || "").trim()}`
    .trim()
    .split(/\s+/)
    .filter(Boolean).length > 24;

  if (targetType === "email") {
    const result = await scanEmailOsint(normalizedQuery);
    const mxRecords = Array.isArray(result?.data?.mxRecords) ? result.data.mxRecords : [];
    const domain = String(result?.data?.domain || "").trim();
    const formatValid = String(result?.data?.valid || "").toLowerCase() === "valid";
    const domainValid = domain && domain !== "No data found";
    const verifiedSignals = dedupeLines([
      formatValid ? "email_format" : "",
      domainValid ? "domain_syntax" : "",
      mxRecords.length ? "mx" : "",
    ]);
    const verified = verifiedSignals.includes("mx") && verifiedSignals.length >= 2;
    const riskScore = !formatValid ? 90 : !mxRecords.length ? 62 : 24;
    const riskLevel = riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";
    return {
      query,
      normalized_query: normalizedQuery,
      target_type: "email",
      verified,
      risk_level: riskLevel,
      risk_score: riskScore,
      reasons: shortLines([
        formatValid ? "Email format passed strict syntax validation." : "Email format failed strict syntax validation.",
        domainValid ? "Email domain passed hostname validation." : "Email domain failed hostname validation.",
        mxRecords.length ? "MX records were verified for the domain." : "No MX records were verified.",
      ], 3),
      bullets: verified ? shortLines([mxRecords.length ? `MX: ${mxRecords.slice(0, 2).map((row) => row.exchange || row).join(", ")}.` : ""], 2) : [NO_VERIFIED_DATA],
      checked_signals: ["format", "domain_syntax", "mx"],
      verified_signals: verifiedSignals,
      data: result?.data || {},
      ai_used: false,
      analysis_mode: "verified_multi_signal",
      minimal_ai_eligible: minimalAiEligible,
      cache_hit: false,
    };
  }

  if (targetType === "ip") {
    const result = await scanIpOsint(normalizedQuery);
    const valid = Boolean(result?.data?.validIp);
    const reverseDns = String(result?.data?.hostname || "").trim();
    const hasReverseDns = Boolean(reverseDns && reverseDns !== "No data found");
    const verifiedSignals = dedupeLines([valid ? "ip_validation" : "", hasReverseDns ? "reverse_dns" : ""]);
    const verified = hasReverseDns && verifiedSignals.length >= 2;
    const riskScore = !valid ? 90 : hasReverseDns ? 20 : 48;
    const riskLevel = riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";
    return {
      query,
      normalized_query: normalizedQuery,
      target_type: "ip",
      verified,
      risk_level: riskLevel,
      risk_score: riskScore,
      reasons: shortLines([
        valid ? "IP address format passed validation." : "IP validation failed.",
        hasReverseDns ? "Reverse DNS resolved successfully." : "Reverse DNS did not return a hostname.",
      ], 3),
      bullets: verified ? [`Reverse DNS: ${reverseDns}.`] : [NO_VERIFIED_DATA],
      checked_signals: ["ip_validation", "reverse_dns"],
      verified_signals: verifiedSignals,
      data: result?.data || {},
      ai_used: false,
      analysis_mode: "verified_multi_signal",
      minimal_ai_eligible: minimalAiEligible,
      cache_hit: false,
    };
  }

  const result = await scanDomainOsint(normalizedQuery);
  const dnsRecords = result?.data?.dnsRecords || {};
  const aRecords = Array.isArray(dnsRecords?.a) ? dnsRecords.a : [];
  const mxRecords = Array.isArray(dnsRecords?.mx) ? dnsRecords.mx : [];
  const nsRecords = Array.isArray(dnsRecords?.ns) ? dnsRecords.ns : [];
  const registrar = String(result?.data?.whois?.registrar || "").trim();
  const syntaxValid = String(result?.data?.valid || "").toLowerCase() === "valid";
  const verifiedSignals = dedupeLines([
    syntaxValid ? "domain_syntax" : "",
    aRecords.length ? "a" : "",
    mxRecords.length ? "mx" : "",
    nsRecords.length ? "ns" : "",
    registrar && registrar !== "No data found" ? "registrar" : "",
  ]);
  const verified = verifiedSignals.some((signal) => ["a", "mx", "ns", "registrar"].includes(signal)) && verifiedSignals.length >= 2;
  const riskScore = !syntaxValid ? 92 : verified ? 28 : 58;
  const riskLevel = riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";
  return {
    query,
    normalized_query: normalizedQuery,
    target_type: "domain",
    verified,
    risk_level: riskLevel,
    risk_score: riskScore,
    reasons: shortLines([
      syntaxValid ? "Domain syntax passed validation." : "Domain syntax failed validation.",
      aRecords.length ? "A records resolved successfully." : "No A records were verified.",
      nsRecords.length ? "NS records resolved successfully." : "No NS records were verified.",
      registrar && registrar !== "No data found" ? "Registration data was verified." : "No registrar data could be verified.",
    ], 3),
    bullets: verified
      ? shortLines([
        aRecords.length ? `A: ${aRecords.slice(0, 3).join(", ")}.` : "",
        mxRecords.length ? `MX: ${mxRecords.slice(0, 2).map((row) => row.exchange || row).join(", ")}.` : "",
        nsRecords.length ? `NS: ${nsRecords.slice(0, 2).join(", ")}.` : "",
        registrar && registrar !== "No data found" ? `Registrar: ${registrar}.` : "",
      ], 4)
      : [NO_VERIFIED_DATA],
    checked_signals: ["domain_syntax", "a", "mx", "ns", "registration"],
    verified_signals: verifiedSignals,
    data: result?.data || {},
    ai_used: false,
    analysis_mode: "verified_multi_signal",
    minimal_ai_eligible: minimalAiEligible,
    cache_hit: false,
  };
};

const parseProxyError = async (response) => {
  try {
    const payload = await response.json();
    const detail = typeof payload?.detail === "string" ? payload.detail : "";
    const error = typeof payload?.error === "string" ? payload.error : "";
    return detail || error || `Python API request failed with status ${response.status}`;
  } catch {
    return `Python API request failed with status ${response.status}`;
  }
};

const proxyPythonApi = async ({ method = "GET", path, authorization = "", body }) => {
  const headers = {
    Accept: "application/json",
    ...(authorization ? { Authorization: authorization } : {}),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${PYTHON_API_BASE_URL}/pyapi${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw createHttpError(502, "pyapi_unreachable", "Python API is unreachable");
  }

  if (!response.ok) {
    throw createHttpError(response.status, "pyapi_proxy_error", await parseProxyError(response));
  }

  return response.json();
};

const buildScanReport = (scanDoc) => {
  const findings = Array.isArray(scanDoc?.result?.findings) ? scanDoc.result.findings : [];
  return {
    id: String(scanDoc?._id || ""),
    user_id: scanDoc?.userId ? String(scanDoc.userId) : null,
    target_url: String(scanDoc?.url || scanDoc?.result?.target?.normalizedUrl || ""),
    final_url: scanDoc?.result?.target?.normalizedUrl || scanDoc?.result?.redirectTarget || null,
    status_code:
      scanDoc?.result?.httpsStatus != null
        ? String(scanDoc.result.httpsStatus)
        : scanDoc?.result?.httpStatus != null
          ? String(scanDoc.result.httpStatus)
          : null,
    score: Number(scanDoc?.result?.riskScore ?? 0),
    summary: String(
      scanDoc?.result?.notes ||
        `${String(scanDoc?.riskLevel || "low").toUpperCase()} risk posture detected for ${scanDoc?.url || "target"}.`
    ),
    findings: findings.map((item, index) => ({
      id: String(item?.id || `finding_${index + 1}`),
      severity: mapSeverity(item?.severity),
      title: String(item?.title || "Finding"),
      description: String(item?.description || "No description available."),
      recommendation: String(item?.recommendation || "Review this issue and remediate promptly."),
    })),
    headers: scanDoc?.result?.headers || {},
    latency_ms: Number(scanDoc?.result?.responseTimeMs || scanDoc?.result?.httpResponseTimeMs || 0) || null,
    created_at: scanDoc?.createdAt ? new Date(scanDoc.createdAt).toISOString() : new Date().toISOString(),
  };
};

const evaluateThreatHeuristic = (metrics = {}) => {
  const requestsPerMin = Number(metrics.requests_per_min || 0);
  const errorRate = Number(metrics.error_rate || 0);
  const failedLogins = Number(metrics.failed_logins || 0);
  const anomalyScore = Number(metrics.anomaly_score || 0);
  const reasons = [];
  const checkedSignals = ["requests_per_min", "error_rate", "failed_logins", "anomaly_score"];
  const triggeredSignals = [];
  let score = 0;

  if (requestsPerMin > 1200) {
    score += 3;
    reasons.push("Request volume indicates possible abuse or automation.");
    triggeredSignals.push("requests_per_min");
  } else if (requestsPerMin > 600) {
    score += 2;
    reasons.push("Traffic spike detected above normal baseline.");
    triggeredSignals.push("requests_per_min");
  }

  if (errorRate > 0.12) {
    score += 3;
    reasons.push("Error rate exceeds safe operational thresholds.");
    triggeredSignals.push("error_rate");
  } else if (errorRate > 0.05) {
    score += 2;
    reasons.push("Error rate is trending above normal.");
    triggeredSignals.push("error_rate");
  }

  if (failedLogins > 20) {
    score += 3;
    reasons.push("Excessive failed logins suggest brute-force attempts.");
    triggeredSignals.push("failed_logins");
  } else if (failedLogins > 8) {
    score += 2;
    reasons.push("Repeated failed logins observed.");
    triggeredSignals.push("failed_logins");
  }

  if (anomalyScore > 0.75) {
    score += 3;
    reasons.push("Anomaly model flags suspicious behavior.");
    triggeredSignals.push("anomaly_score");
  } else if (anomalyScore > 0.4) {
    score += 2;
    reasons.push("Anomaly score elevated above baseline.");
    triggeredSignals.push("anomaly_score");
  }

  const riskLevel = score >= 6 ? "high" : score >= 3 ? "medium" : "low";
  const advice =
    riskLevel === "high"
      ? [
          "Throttle or block abusive sources immediately.",
          "Review authentication logs and enforce MFA or lockout controls.",
          "Validate telemetry against WAF, IAM, and edge logs.",
        ]
      : riskLevel === "medium"
        ? [
            "Review the affected service for burst traffic and auth anomalies.",
            "Confirm whether error spikes align with deployments or client failures.",
            "Increase monitoring on login and edge telemetry.",
          ]
        : [
            "Keep monitoring baselines current.",
            "Review thresholds if production traffic patterns have changed.",
          ];
  return {
    riskLevel,
    suspicious: riskLevel !== "low",
    reasons: reasons.length ? reasons : ["No abnormal signals detected at current thresholds."],
    checkedSignals,
    triggeredSignals,
    advice,
    verified: true,
  };
};

const extractJsonObject = (text = "") => {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const countTruthy = (values = []) => values.filter(Boolean).length;

const normalizeThreatResponse = ({ parsed, fallback, provider = "ollama", cacheHit = false, metrics }) => {
  const fallbackLevel = String(fallback?.riskLevel || "low");
  const normalizedLevel = ["low", "medium", "high"].includes(String(parsed?.risk_level || "").toLowerCase())
    ? String(parsed.risk_level).toLowerCase()
    : fallbackLevel;
  const reasons = dedupeLines(
    Array.isArray(parsed?.reasons) ? parsed.reasons : fallback?.reasons || ["No abnormal signals detected at current thresholds."],
    4
  );
  const suspicious = typeof parsed?.suspicious === "boolean" ? parsed.suspicious : normalizedLevel !== "low";
  const confidence = clamp(parsed?.confidence, 0, 1, normalizedLevel === fallbackLevel ? 0.62 : 0.74);
  const riskScore = clamp(
    parsed?.risk_score,
    0,
    100,
    normalizedLevel === "high" ? 82 : normalizedLevel === "medium" ? 56 : 24
  );
  return {
    risk_level: normalizedLevel,
    reasons,
    suspicious,
    metrics,
    verified: true,
    checked_signals: Array.isArray(fallback?.checkedSignals) ? fallback.checkedSignals : [],
    triggered_signals: Array.isArray(fallback?.triggeredSignals) ? fallback.triggeredSignals : [],
    advice: dedupeLines(Array.isArray(parsed?.advice) ? parsed.advice : fallback?.advice || [], 3),
    ai_used: provider !== "heuristic",
    analysis_mode: provider !== "heuristic" ? "llm_live" : "verified_signal_only",
    provider,
    confidence,
    risk_score: riskScore,
    cache_hit: cacheHit,
  };
};

const buildHeuristicThreatResult = (metrics = {}, cacheHit = false) =>
  normalizeThreatResponse({
    parsed: null,
    fallback: evaluateThreatHeuristic(metrics),
    provider: "heuristic",
    cacheHit,
    metrics,
  });

const normalizeDayLabText = (value = "") => String(value || "").trim().toLowerCase();

const buildKeywordValidator = ({ all = [], any = [], minWords = 0, exact = [] } = {}) => (answer = "") => {
  const normalized = normalizeDayLabText(answer);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (exact.length && exact.some((value) => normalized === normalizeDayLabText(value))) return true;
  if (minWords && words.length < minWords) return false;
  const hasAll = all.every((keyword) => normalized.includes(normalizeDayLabText(keyword)));
  const hasAny = !any.length || any.some((keyword) => normalized.includes(normalizeDayLabText(keyword)));
  return hasAll && hasAny;
};

const buildCommandValidator = ({ commands = [], requiredFragments = [], minArgs = 0 } = {}) => (answer = "") => {
  const normalized = normalizeDayLabText(answer);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const startsWithKnownCommand = commands.some((command) => tokens[0] === normalizeDayLabText(command));
  if (!startsWithKnownCommand) return false;
  if (["help", "status", "next", "complete"].includes(tokens[0])) return false;
  if (minArgs && tokens.length - 1 < minArgs) return false;
  return requiredFragments.every((fragment) => normalized.includes(normalizeDayLabText(fragment)));
};

const buildStepValidator = ({ ordered = [], any = [], minWords = 0 } = {}) => (answer = "") => {
  const normalized = normalizeDayLabText(answer);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (minWords && words.length < minWords) return false;
  let cursor = -1;
  for (const step of ordered) {
    const nextIndex = normalized.indexOf(normalizeDayLabText(step), cursor + 1);
    if (nextIndex === -1) return false;
    cursor = nextIndex;
  }
  if (!any.length) return true;
  return any.some((keyword) => normalized.includes(normalizeDayLabText(keyword)));
};

const buildChoiceValidator = (acceptedChoices = []) => (answer = "") => {
  const normalized = normalizeDayLabText(answer)
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/\s+/g, " ");
  return acceptedChoices.some((choice) => normalized === normalizeDayLabText(choice));
};

const createDayTask = ({
  id,
  kind,
  title,
  instruction,
  hint,
  successMessage,
  successCriteria,
  expectedType,
  answerFormat,
  artifactLabel,
  validator,
}) => ({
  id,
  kind,
  title,
  instruction,
  expected_type: expectedType || kind,
  answer_format: answerFormat || "freeform",
  artifact_label: artifactLabel || "Submission",
  hint,
  success_message: successMessage,
  success_criteria: successCriteria,
  validator,
});

const isBlockedBypassAnswer = (answer = "") => {
  const normalized = normalizeDayLabText(answer);
  return [
    "skip",
    "pass",
    "next",
    "idk",
    "i don't know",
    "show answer",
    "solution please",
    "test",
    "asdf",
  ].some((pattern) => normalized === pattern || normalized.includes(pattern));
};

const buildDayLabTasks = (focus = "foundation") => {
  if (focus === "intel") {
    return [
      createDayTask({
        id: "mindset-scope",
        kind: "mindset",
        title: "State the verification mindset",
        instruction: "In one sentence, explain why a single OSINT source is not enough before you escalate exposure.",
        expectedType: "mindset",
        answerFormat: "short-analysis",
        artifactLabel: "Mindset note",
        hint: "Mention verification, corroboration, attribution, or confidence.",
        successMessage: "Mindset accepted. You are anchoring recon to evidence quality, not assumptions.",
        successCriteria: ["Explains the need for corroboration", "Uses verification or confidence language"],
        validator: buildStepValidator({ ordered: ["source"], any: ["verify", "corroborate", "confidence", "attribution"], minWords: 7 }),
      }),
      createDayTask({
        id: "scope-check",
        kind: "tool_action",
        title: "Choose the first recon command",
        instruction: "Enter the first safe OSINT command you would run to verify this target.",
        expectedType: "terminal",
        answerFormat: "command",
        artifactLabel: "Recon command",
        hint: "Start with a real recon step such as whois, dig, nslookup, or curl -I.",
        successMessage: "Recon step accepted. You began with a verifiable signal.",
        successCriteria: ["Uses a scoped recon command", "Shows low-risk evidence collection"],
        validator: buildCommandValidator({ commands: ["whois", "dig", "nslookup", "curl"], minArgs: 1 }),
      }),
      createDayTask({
        id: "verification-step",
        kind: "analysis",
        title: "Describe how you verify the signal",
        instruction: "Write one sentence explaining how you would confirm the finding before trusting it.",
        expectedType: "analysis",
        answerFormat: "analyst-note",
        artifactLabel: "Verification note",
        hint: "Mention a second source, DNS confirmation, registrar data, or header evidence.",
        successMessage: "Verification logic accepted. The workflow stays evidence-driven.",
        successCriteria: ["Names a second validation source", "Explains why the signal becomes trustworthy"],
        validator: buildStepValidator({ ordered: ["confirm"], any: ["dns", "header", "registrar", "whois", "second source"], minWords: 8 }),
      }),
      createDayTask({
        id: "intel-quiz",
        kind: "quiz",
        title: "Escalation gate",
        instruction: "Answer with the best choice: when should you escalate? `A: after one screenshot`, `B: after one verified signal plus corroboration`, `C: immediately after a rumor post`.",
        expectedType: "quiz",
        answerFormat: "choice",
        artifactLabel: "Quiz answer",
        hint: "The correct answer requires verified evidence and corroboration.",
        successMessage: "Quiz passed. You chose an escalation threshold that matches real intel discipline.",
        successCriteria: ["Selects the evidence-backed escalation threshold"],
        validator: buildChoiceValidator(["b", "b:", "after one verified signal plus corroboration", "b - after one verified signal plus corroboration"]),
      }),
    ];
  }

  if (focus === "appsec") {
    return [
      createDayTask({
        id: "mindset-threat-path",
        kind: "mindset",
        title: "Frame the attacker path",
        instruction: "Explain why appsec testing starts from trust boundaries and request flow, not random clicking.",
        expectedType: "mindset",
        answerFormat: "short-analysis",
        artifactLabel: "Threat-path note",
        hint: "Mention request flow, trust boundary, risky sink, or attacker path.",
        successMessage: "Mindset accepted. You are approaching the app like a reviewer, not a button-clicker.",
        successCriteria: ["References trust boundary or request flow", "Connects testing to attacker path"],
        validator: buildStepValidator({ ordered: ["trust boundary"], any: ["request flow", "attacker", "sink", "input"], minWords: 8 }),
      }),
      createDayTask({
        id: "probe-app",
        kind: "tool_action",
        title: "Probe the application safely",
        instruction: "Enter the first safe command or tool you would use to inspect the app surface.",
        expectedType: "terminal",
        answerFormat: "command",
        artifactLabel: "Probe command",
        hint: "Think curl, nikto, ffuf, or burp depending on what you need to verify first.",
        successMessage: "Probe accepted. The test plan starts from safe enumeration.",
        successCriteria: ["Uses a realistic appsec tool", "Starts with safe enumeration before exploitation"],
        validator: buildCommandValidator({ commands: ["curl", "nikto", "ffuf", "burp", "burpsuite"], minArgs: 1 }),
      }),
      createDayTask({
        id: "classify-risk",
        kind: "analysis",
        title: "Name the likely weakness",
        instruction: "Classify the likely issue in one sentence.",
        expectedType: "analysis",
        answerFormat: "finding-note",
        artifactLabel: "Finding classification",
        hint: "Use terms like auth, injection, access control, CSRF, file upload, or headers.",
        successMessage: "Risk classification accepted.",
        successCriteria: ["Names a plausible weakness class", "Keeps the classification concise and testable"],
        validator: buildKeywordValidator({ any: ["auth", "inject", "access", "csrf", "upload", "header", "sql", "xss", "api"], minWords: 6 }),
      }),
      createDayTask({
        id: "appsec-quiz",
        kind: "quiz",
        title: "Fix verification gate",
        instruction: "Answer with the best choice: `A: mark fixed after dev says done`, `B: rerun the risky request path and verify the control holds`, `C: skip verification if staging looks stable`.",
        expectedType: "quiz",
        answerFormat: "choice",
        artifactLabel: "Quiz answer",
        hint: "The right answer includes post-fix verification, not trust alone.",
        successMessage: "Quiz passed. You picked the verification step an appsec reviewer should require.",
        successCriteria: ["Chooses verification over assumption"],
        validator: buildChoiceValidator(["b", "b:", "rerun the risky request path and verify the control holds", "b - rerun the risky request path and verify the control holds"]),
      }),
    ];
  }

  if (focus === "defense" || focus === "hunt") {
    return [
      createDayTask({
        id: "mindset-evidence",
        kind: "mindset",
        title: "Set the triage mindset",
        instruction: focus === "defense"
          ? "Explain why triage should start from evidence collection before containment panic."
          : "Explain why a hunt hypothesis should be written before collecting more telemetry.",
        expectedType: "mindset",
        answerFormat: "short-analysis",
        artifactLabel: "Mindset note",
        hint: focus === "defense" ? "Mention evidence, scope, uncertainty, or false positives." : "Mention hypothesis, noise, scope, or validation.",
        successMessage: "Mindset accepted. The workflow now starts from disciplined reasoning.",
        successCriteria: ["Frames the investigation before action", "Shows evidence-first reasoning"],
        validator: buildKeywordValidator({ any: focus === "defense" ? ["evidence", "scope", "uncertainty", "false"] : ["hypothesis", "noise", "validate", "scope"], minWords: 8 }),
      }),
      createDayTask({
        id: "triage-command",
        kind: "tool_action",
        title: "Start with evidence collection",
        instruction: "Enter the first command you would use to inspect telemetry or logs.",
        expectedType: "terminal",
        answerFormat: "command",
        artifactLabel: "Evidence command",
        hint: "A good first move is grep, jq, cat, journalctl, tail, or yara depending on the source.",
        successMessage: "Triage command accepted. You started from evidence.",
        successCriteria: ["Uses a valid telemetry inspection command", "Starts with data collection rather than assumption"],
        validator: buildCommandValidator({ commands: ["grep", "jq", "cat", "journalctl", "tail", "yara", "python3", "python"], minArgs: 1 }),
      }),
      createDayTask({
        id: "containment-or-hypothesis",
        kind: "analysis",
        title: "State the current decision",
        instruction: focus === "defense" ? "Describe your first containment action." : "State your hunt hypothesis in one sentence.",
        expectedType: "analysis",
        answerFormat: "decision-note",
        artifactLabel: "Decision note",
        hint: focus === "defense" ? "Use isolate, disable, block, reset, or preserve evidence." : "Use abnormal login, suspicious process, beacon, or lateral movement language.",
        successMessage: "Decision accepted. The workflow has direction now.",
        successCriteria: [focus === "defense" ? "Names a containment action" : "States a testable hypothesis", "Connects the action to the signal"],
        validator: (answer) =>
          (focus === "defense" ? /isolate|disable|block|reset|evidence|contain/i : /abnormal|suspicious|beacon|lateral|login|process/i.test(answer)) &&
          answer.split(/\s+/).length >= 6,
      }),
      createDayTask({
        id: "defense-quiz",
        kind: "quiz",
        title: "Escalation gate",
        instruction: focus === "defense"
          ? "Answer with the best choice: `A: contain first and skip evidence`, `B: collect enough evidence to scope impact, then contain`, `C: close the alert after one log line`."
          : "Answer with the best choice: `A: keep collecting data forever`, `B: escalate only when the hypothesis is supported by concrete evidence`, `C: assume compromise after one anomaly`.",
        expectedType: "quiz",
        answerFormat: "choice",
        artifactLabel: "Quiz answer",
        hint: "The right answer balances evidence quality with action.",
        successMessage: "Quiz passed. You chose the escalation threshold that matches real operations.",
        successCriteria: ["Selects the evidence-backed escalation path"],
        validator: buildChoiceValidator(
          focus === "defense"
            ? ["b", "b:", "collect enough evidence to scope impact, then contain", "b - collect enough evidence to scope impact, then contain"]
            : ["b", "b:", "escalate only when the hypothesis is supported by concrete evidence", "b - escalate only when the hypothesis is supported by concrete evidence"]
        ),
      }),
    ];
  }

  if (focus === "cloud") {
    return [
      createDayTask({
        id: "mindset-blast-radius",
        kind: "mindset",
        title: "Frame the blast radius",
        instruction: "Explain why cloud review starts with exposure path and blast radius before changing permissions.",
        expectedType: "mindset",
        answerFormat: "short-analysis",
        artifactLabel: "Exposure note",
        hint: "Mention public exposure, role scope, blast radius, or service account impact.",
        successMessage: "Mindset accepted. You are prioritizing exposure path before blunt changes.",
        successCriteria: ["Explains blast radius thinking", "Shows change discipline before remediation"],
        validator: buildStepValidator({ ordered: ["blast radius"], any: ["public", "role", "service account", "scope"], minWords: 8 }),
      }),
      createDayTask({
        id: "inspect-surface",
        kind: "tool_action",
        title: "Inspect the cloud surface",
        instruction: "Enter the first cloud or container security command you would run.",
        expectedType: "terminal",
        answerFormat: "command",
        artifactLabel: "Inspection command",
        hint: "Use aws, kubectl, docker, or trivy based on the target.",
        successMessage: "Inspection step accepted.",
        successCriteria: ["Uses a cloud-native inspection command", "Starts with verification before remediation"],
        validator: buildCommandValidator({ commands: ["aws", "kubectl", "docker", "trivy"], minArgs: 1 }),
      }),
      createDayTask({
        id: "least-privilege",
        kind: "analysis",
        title: "Explain the least-privilege fix",
        instruction: "Write one sentence on the access reduction you would make.",
        expectedType: "analysis",
        answerFormat: "remediation-note",
        artifactLabel: "Least-privilege note",
        hint: "Mention role, policy, secret, service account, bucket, or public access.",
        successMessage: "Least-privilege reasoning accepted.",
        successCriteria: ["Names an access reduction action", "Ties the change to the exposed surface"],
        validator: buildKeywordValidator({ any: ["role", "policy", "secret", "service", "bucket", "public", "permission"], minWords: 6 }),
      }),
      createDayTask({
        id: "cloud-quiz",
        kind: "quiz",
        title: "Hardening proof gate",
        instruction: "Answer with the best choice: `A: trust the policy save`, `B: verify access is now denied or the resource is no longer public`, `C: skip proof if IaC changed successfully`.",
        expectedType: "quiz",
        answerFormat: "choice",
        artifactLabel: "Quiz answer",
        hint: "Hardening is not complete until the risky access path is proven closed.",
        successMessage: "Quiz passed. You required proof instead of configuration optimism.",
        successCriteria: ["Chooses post-fix proof over assumption"],
        validator: buildChoiceValidator(["b", "b:", "verify access is now denied or the resource is no longer public", "b - verify access is now denied or the resource is no longer public"]),
      }),
    ];
  }

  if (focus === "capstone") {
    return [
      createDayTask({
        id: "capstone-mindset",
        kind: "mindset",
        title: "Define reviewer expectations",
        instruction: "State what separates a hiring-grade security artifact from a lab note.",
        expectedType: "mindset",
        answerFormat: "short-analysis",
        artifactLabel: "Reviewer note",
        hint: "Mention evidence, clarity, reproducibility, or decision quality.",
        successMessage: "Mindset accepted. The day is now framed around real operator standards.",
        successCriteria: ["References reviewer-facing quality", "Mentions evidence or reproducibility"],
        validator: buildStepValidator({ ordered: ["evidence"], any: ["clarity", "reproduc", "decision", "review"], minWords: 8 }),
      }),
      createDayTask({
        id: "technical-move",
        kind: "tool_action",
        title: "Show the first technical action",
        instruction: "Enter the first realistic command or tool you would use.",
        expectedType: "terminal",
        answerFormat: "command",
        artifactLabel: "Technical action",
        hint: "nmap, curl, python3, or git are all valid depending on the scenario.",
        successMessage: "Technical move accepted.",
        successCriteria: ["Uses a realistic operator tool", "Starts with a concrete technical move"],
        validator: buildCommandValidator({ commands: ["nmap", "curl", "python3", "python", "git"], minArgs: 1 }),
      }),
      createDayTask({
        id: "capstone-analysis",
        kind: "analysis",
        title: "Describe the final artifact",
        instruction: "Write one sentence explaining what your final report or artifact must prove.",
        expectedType: "report",
        answerFormat: "artifact-note",
        artifactLabel: "Artifact statement",
        hint: "Mention evidence, workflow, remediation, report, portfolio, or automation outcome.",
        successMessage: "Artifact statement accepted.",
        successCriteria: ["Defines the final deliverable", "Ties it to evidence or workflow quality"],
        validator: buildKeywordValidator({ any: ["evidence", "workflow", "report", "remediation", "portfolio", "automation"], minWords: 7 }),
      }),
      createDayTask({
        id: "capstone-quiz",
        kind: "quiz",
        title: "Review gate",
        instruction: "Answer with the best choice: `A: deliver screenshots only`, `B: deliver evidence, decision rationale, and reproducible next steps`, `C: deliver a tool list without conclusions`.",
        expectedType: "quiz",
        answerFormat: "choice",
        artifactLabel: "Quiz answer",
        hint: "The right answer reflects what a reviewer or hiring manager can actually trust.",
        successMessage: "Quiz passed. Your output standard now matches a real reviewer expectation.",
        successCriteria: ["Chooses a reproducible operator-grade deliverable"],
        validator: buildChoiceValidator(["b", "b:", "deliver evidence, decision rationale, and reproducible next steps", "b - deliver evidence, decision rationale, and reproducible next steps"]),
      }),
    ];
  }

  return [
    createDayTask({
      id: "concept-map",
      kind: "mindset",
      title: "Map the core concept",
      instruction: "Explain the main security concept for this day in one operator-quality sentence.",
      expectedType: "analysis",
      answerFormat: "short-analysis",
      artifactLabel: "Concept note",
      hint: "Tie the topic to confidentiality, integrity, availability, visibility, auth, network trust, or secure defaults.",
      successMessage: "Concept accepted. The lab can now measure your practical understanding.",
      successCriteria: ["Connects the concept to a real security property", "Uses operator-quality language"],
      validator: buildKeywordValidator({ any: ["confidentiality", "integrity", "availability", "linux", "network", "http", "auth", "password", "visibility"], minWords: 8 }),
    }),
    createDayTask({
      id: "first-command",
      kind: "tool_action",
      title: "Run the first terminal move",
      instruction: "Enter the first safe terminal command you would use.",
      expectedType: "terminal",
      answerFormat: "command",
      artifactLabel: "Terminal action",
      hint: "pwd, ls, ip, ss, curl, grep, or cat are good practical starts depending on the task.",
      successMessage: "Terminal move accepted. You started with a real operator action.",
      successCriteria: ["Uses a shell command", "Starts with safe verification instead of random action"],
      validator: buildCommandValidator({ commands: ["pwd", "ls", "ip", "ss", "curl", "grep", "cat", "whoami"] }),
    }),
    createDayTask({
      id: "operator-note",
      kind: "analysis",
      title: "Write the operator note",
      instruction: "Describe what result would convince you the step worked.",
      expectedType: "brief",
      answerFormat: "operator-note",
      artifactLabel: "Evidence note",
      hint: "Mention the output, signal, interface, header, service, or policy you expect to see.",
      successMessage: "Operator note accepted. You linked the action to evidence.",
      successCriteria: ["Names the expected evidence", "Translates output into meaning"],
      validator: buildKeywordValidator({ any: ["output", "signal", "interface", "header", "service", "policy", "result", "response"], minWords: 7 }),
    }),
    createDayTask({
      id: "foundation-quiz",
      kind: "quiz",
      title: "Concept check gate",
      instruction: "Answer with the best choice: `A: a task is complete when a command runs`, `B: a task is complete when the action plus evidence support the conclusion`, `C: a task is complete when the UI changes state`.",
      expectedType: "quiz",
      answerFormat: "choice",
      artifactLabel: "Quiz answer",
      hint: "The correct answer requires action, evidence, and conclusion together.",
      successMessage: "Quiz passed. You chose the evidence-based definition of completion.",
      successCriteria: ["Selects evidence-backed completion logic"],
      validator: buildChoiceValidator(["b", "b:", "a task is complete when the action plus evidence support the conclusion", "b - a task is complete when the action plus evidence support the conclusion"]),
    }),
  ];
};

const buildDayLabModule = (dayNumber = 1) => {
  const day = DAY_LAB_PROGRAM.find((item) => item.day === dayNumber) || DAY_LAB_PROGRAM[0];
  const meta = DAY_LAB_FOCUS_META[day.focus] || DAY_LAB_FOCUS_META.foundation;
  return {
    day: day.day,
    title: day.title,
    objective: `Complete a realistic guided lab for ${day.title} using an operator action, evidence, and a concise conclusion.`,
    scenario: meta.scenario,
    focus: day.focus,
    difficulty: meta.difficulty,
    estimated_minutes: meta.difficulty === "beginner" ? 18 : meta.difficulty === "intermediate" ? 24 : meta.difficulty === "advanced" ? 30 : 36,
    environment: meta.environment,
    kali_tools: meta.kaliTools,
    tasks: buildDayLabTasks(day.focus),
    solution_explanation: [
      `Day ${day.day} trains ${day.focus} judgment through a realistic action, a verification step, and an operator note.`,
      "A correct run begins with a plausible terminal or reasoning step, then proves why the signal matters.",
      "Unlock progression is based on validated completion rather than simply opening the module.",
    ],
    next_steps: [
      "Capture the strongest signal you used in this lab.",
      "Write one sentence on what would change your confidence next time.",
    ],
  };
};

const getDayLabCollection = () => getDb().collection(DAY_LAB_COLLECTION);
const getDailyProgressCollection = () => getDb().collection(DAILY_PROGRESS_COLLECTION);
const getUserEventsCollection = () => getDb().collection(USER_EVENTS_COLLECTION);

const buildEventResponse = (row) => ({
  id: String(row?._id || ""),
  user_id: row?.userId ? String(row.userId) : null,
  event_type: String(row?.eventType || ""),
  surface: String(row?.surface || ""),
  target: row?.target ? String(row.target) : null,
  metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
  created_at: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
});

const buildDailyProgressResponse = (row) => ({
  id: String(row?._id || ""),
  user_id: String(row?.userId || ""),
  day: String(row?.day || ""),
  missions_completed: Number(row?.missionsCompleted || 0),
  xp_earned: Number(row?.xpEarned || 0),
  streak_day: Number(row?.streakDay || 0),
  updated_at: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

const ensureDayLabState = async (userId, dayNumber) => {
  const collection = getDayLabCollection();
  let row = await collection.findOne({ userId, dayNumber });
  if (row) return row;
  const created = {
    userId,
    dayNumber,
    unlocked: dayNumber === 1,
    completed: false,
    currentTaskIndex: 0,
    score: 0,
    xpEarned: 0,
    attempts: 0,
    taskAttemptsById: {},
    completedTaskIds: [],
    terminalLog: [`[day-${dayNumber}] lab ready`],
    lastFeedback: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await collection.insertOne(created);
  return created;
};

const dayLabStateResponse = (row, dayNumber) => ({
  day: dayNumber,
  unlocked: Boolean(row?.unlocked ?? dayNumber === 1),
  completed: Boolean(row?.completed),
  current_task_index: Number(row?.currentTaskIndex || 0),
  score: Number(row?.score || 0),
  xp_earned: Number(row?.xpEarned || 0),
  attempts: Number(row?.attempts || 0),
  task_attempts_by_id: row?.taskAttemptsById && typeof row.taskAttemptsById === "object" ? row.taskAttemptsById : {},
  completed_task_ids: Array.isArray(row?.completedTaskIds) ? row.completedTaskIds : [],
  terminal_log: Array.isArray(row?.terminalLog) ? row.terminalLog : [],
  last_feedback: row?.lastFeedback || null,
  difficulty_band: Number(row?.attempts || 0) >= 4 ? "guided" : Number(row?.completedTaskIds?.length || 0) >= 2 ? "accelerated" : "standard",
});

const buildLabsOverviewPayload = async (userId) => {
  const collection = getDayLabCollection();
  const rows = await collection.find({ userId }).toArray();
  const rowMap = new Map(rows.map((row) => [Number(row.dayNumber), row]));
  let previousCompleted = true;
  const items = DAY_LAB_PROGRAM.map((item) => {
    const row = rowMap.get(item.day);
    const unlocked = item.day === 1 ? true : Boolean(row?.unlocked || previousCompleted);
    const completed = Boolean(row?.completed);
    previousCompleted = completed;
    return {
      day: item.day,
      title: item.title,
      focus: item.focus,
      difficulty: DAY_LAB_FOCUS_META[item.focus]?.difficulty || "beginner",
      unlocked,
      completed,
      score: Number(row?.score || 0),
      xp_earned: Number(row?.xpEarned || 0),
    };
  });
  const recommendedDay = items.find((item) => item.unlocked && !item.completed)?.day || 60;
  const completedCount = items.filter((item) => item.completed).length;
  return {
    items,
    recommended_day: recommendedDay,
    streak_message: `You have completed ${completedCount} interactive lab day${completedCount === 1 ? "" : "s"}.`,
  };
};

const buildCompatRecommendations = async (userId) => {
  const labs = await buildLabsOverviewPayload(userId);
  const recentEvents = await getUserEventsCollection().find({ userId }).sort({ createdAt: -1 }).limit(12).toArray();
  const latestDaily = await getDailyProgressCollection().find({ userId }).sort({ day: -1, updatedAt: -1 }).limit(1).next();
  const nextLab =
    labs.items.find((item) => item.day === labs.recommended_day) ||
    labs.items.find((item) => item.unlocked && !item.completed) ||
    labs.items[0] ||
    null;
  const completedCount = labs.items.filter((item) => item.completed).length;
  const recentSurfaces = [...new Set(recentEvents.map((event) => String(event.surface || "").trim()).filter(Boolean))].slice(0, 4);

  return {
    user_id: userId,
    generated_at: new Date().toISOString(),
    recommendations: [
      {
        title: nextLab ? `Resume Day ${nextLab.day}` : "Open the next lab",
        reason: nextLab
          ? `Your strongest next move is ${nextLab.title} in the ${nextLab.focus} track.`
          : "Your next validated lab is ready to resume.",
        action: nextLab
          ? `Launch Day ${nextLab.day} and complete the next accepted task in the chain.`
          : "Open the program board and continue your next unlocked day.",
        priority: 1,
      },
      {
        title: completedCount >= 3 ? "Keep the streak alive" : "Build more validated reps",
        reason:
          latestDaily && Number(latestDaily.missionsCompleted || 0) > 0
            ? `${Number(latestDaily.missionsCompleted || 0)} missions were logged in your latest daily progress snapshot.`
            : "Repeated validated practice sharpens skill targeting and next-step guidance.",
        action: "Finish one more practical mission or day lab today.",
        priority: 2,
      },
    ],
    signals: {
      recent_surfaces: recentSurfaces,
      completed_day_labs: completedCount,
      recommended_day: labs.recommended_day,
      latest_daily_progress: latestDaily
        ? {
            day: String(latestDaily.day || ""),
            missions_completed: Number(latestDaily.missionsCompleted || 0),
            xp_earned: Number(latestDaily.xpEarned || 0),
            streak_day: Number(latestDaily.streakDay || 0),
          }
        : null,
    },
  };
};

const isPyApiTransportError = (error) => error?.code === "pyapi_proxy_error" || error?.code === "pyapi_unreachable";

const buildMissionControlCompatFallback = async ({ req, userId, warning }) => {
  const labs = await buildLabsOverviewPayload(userId);
  const recommendationsPayload = await buildCompatRecommendations(userId);
  const completedDays = Array.isArray(labs?.items) ? labs.items.filter((item) => item.completed).length : 0;
  const nextLab =
    labs?.items?.find((item) => item.day === labs.recommended_day) ||
    labs?.items?.find((item) => item.unlocked && !item.completed) ||
    labs?.items?.[0] ||
    null;
  const generatedAt = new Date().toISOString();
  const requestId = String(req.requestId || req.headers["x-request-id"] || "mission-control-compat");
  const displayName = String(req.user?.name || req.user?.preferred_username || req.user?.email || "operator").trim();

  return {
    tasks: nextLab
      ? [
        {
          id: `day-${nextLab.day}`,
          title: `Resume Day ${nextLab.day}`,
          detail: `${nextLab.title} is unlocked and ready to continue.`,
          reward: 25,
          action_type: "program_day_complete",
          completed: Boolean(nextLab.completed),
          route: `/program/day/${nextLab.day}`,
          cta_label: "Resume lab",
        },
      ]
      : [],
    challenge: {
      id: "daily-combo",
      title: "Momentum Combo",
      detail: "Complete meaningful actions today.",
      reward: 50,
      goal: 3,
      progress: Math.min(completedDays, 3),
      completed: completedDays >= 3,
    },
    streak: 0,
    best_streak: 0,
    total_completed: completedDays,
    total_points: completedDays * 25,
    momentum: Math.min(100, completedDays * 10),
    completed_days: completedDays,
    completed_sandbox_labs: 0,
    recent_rewards: [],
    badges: completedDays > 0
      ? [
        {
          id: "validated-operator",
          title: "Validated Operator",
          detail: `${displayName} has started building accepted lab reps.`,
          icon: "shield",
          earned: true,
        },
      ]
      : [],
    unlocked_gates: {
      advanced_labs: completedDays >= 7,
      elite_program: completedDays >= 21,
      intel_tools: completedDays >= 14,
      shadow_challenge: false,
    },
    hidden_challenges: [],
    streak_reminder: labs?.streak_message || "Return tomorrow to keep momentum building.",
    curiosity_trigger: "Core training data is still available while advanced mission insights reconnect.",
    next_mission_hook: nextLab
      ? {
        title: `Resume Day ${nextLab.day}`,
        detail: `Pick up ${nextLab.title} and keep your validated progress moving.`,
        cta_label: "Open program day",
        target: "task",
        task_id: `day-${nextLab.day}`,
        route: `/program/day/${nextLab.day}`,
      }
      : {
        title: "Open program",
        detail: "Your next unlocked training step is ready.",
        cta_label: "Open program",
        target: "return",
        route: "/program",
      },
    recommendations: Array.isArray(recommendationsPayload?.recommendations) ? recommendationsPayload.recommendations : [],
    rails: [
      {
        id: "operator-track",
        level: completedDays >= 21 ? "advanced" : completedDays >= 7 ? "intermediate" : "foundation",
        title: "Operator Program",
        objective: nextLab ? `Complete Day ${nextLab.day}: ${nextLab.title}` : "Continue the next unlocked day lab.",
        mode: "guided",
        payoff: "Validated reps, stronger streak foundations, and cleaner recommendations.",
        progress_label: `${completedDays}/60 day labs completed`,
        route: "/program",
      },
    ],
    quick_actions: nextLab
      ? [
        {
          id: "resume-program",
          title: `Resume Day ${nextLab.day}`,
          detail: `${nextLab.title} is the strongest next move right now.`,
          cta: "Continue",
          route: `/program/day/${nextLab.day}`,
          action_type: "program_day_complete",
          status: nextLab.completed ? "completed" : "ready",
        },
      ]
      : [],
    referral: {
      code: String(userId || "").slice(-8) || "invite",
      invite_count: 0,
      signup_count: 0,
      conversion_count: 0,
      reward_points: 0,
      share_url: `/auth?ref=${encodeURIComponent(String(userId || "").slice(-8) || "invite")}`,
      headline: "Invite teammates once the live growth engine reconnects.",
      next_reward: "Referral rewards resume automatically when the training engine is healthy.",
      conversion_rate: 0,
    },
    shareable_insights: nextLab
      ? [
        {
          id: `insight-day-${nextLab.day}`,
          title: `Next up: Day ${nextLab.day}`,
          description: `Continue ${nextLab.title} to keep your operator momentum moving.`,
          cta: "Resume training",
          share_text: `I'm working through Day ${nextLab.day} in ZeroDay Guardian: ${nextLab.title}.`,
          seo_title: `ZeroDay Guardian Day ${nextLab.day} training`,
          seo_description: `Resume ${nextLab.title} and continue validated cybersecurity training progress.`,
          slug: `day-${nextLab.day}`,
          trend: "steady",
          proof_points: [
            `${completedDays} validated day lab${completedDays === 1 ? "" : "s"} completed`,
            "Progress safely preserved during temporary service recovery",
          ],
        },
      ]
      : [],
    smart_notifications: [
      {
        id: "streak-recovery",
        channel: "in_app",
        title: "Training engine recovery mode",
        detail: "Core progress is available and advanced mission insights will resume automatically.",
        send_window: "18:00-20:00",
        enabled: true,
        priority: "high",
        trigger: "fallback_active",
      },
    ],
    notification_preferences: {
      email_enabled: true,
      push_enabled: true,
      streak_alerts: true,
      referral_alerts: true,
      digest_enabled: true,
      preferred_window: "18:00-20:00",
      quiet_hours: "22:00-07:00",
      timezone: "UTC",
    },
    debug: {
      request_id: requestId,
      generated_at: generatedAt,
      auto_retry_ready: true,
      validation_state: "compat_fallback",
      error_capture: "enabled",
      warnings: [warning],
      recent_events: [
        {
          id: `fallback-${Date.now()}`,
          stage: "compat_proxy",
          level: "warning",
          message: warning,
          createdAt: generatedAt,
          payload: {
            source: "node_pyapi_compat",
            fallback: true,
          },
        },
      ],
    },
  };
};

const validateDayLabAnswer = (task, answer = "") => {
  const normalized = normalizeDayLabText(answer);
  if (!normalized) {
    return { accepted: false, feedback: "Empty answers are not valid in this lab.", hint: task.hint };
  }
  if (normalized.length < 4) {
    return { accepted: false, feedback: "Answer is too short to prove operator intent.", hint: task.hint };
  }
  if (isBlockedBypassAnswer(normalized)) {
    return { accepted: false, feedback: "Generic bypass text is blocked. Submit a real operator action or analyst-quality answer.", hint: task.hint };
  }
  const accepted = Boolean(task.validator?.(normalized));
  const feedbackPrefix =
    task.kind === "quiz"
      ? "Quiz check"
      : task.kind === "tool_action"
        ? "Tool action check"
        : task.kind === "mindset"
          ? "Mindset check"
          : "Validation check";
  return {
    accepted,
    feedback: accepted ? task.success_message : `${feedbackPrefix} failed. ${task.hint}`,
    hint: accepted ? null : task.hint,
  };
};

const isComplexThreatRequest = (metrics = {}) => {
  const notes = String(metrics.notes || "").trim();
  const rpm = Number(metrics.requests_per_min || 0);
  const errorRate = Number(metrics.error_rate || 0);
  const failedLogins = Number(metrics.failed_logins || 0);
  const anomaly = Number(metrics.anomaly_score || 0);
  const mediumSignals = countTruthy([
    rpm >= 350 && rpm < 900,
    errorRate >= 0.05 && errorRate < 0.18,
    failedLogins >= 8 && failedLogins < 30,
    anomaly >= 0.45 && anomaly < 0.82,
  ]);
  const hardHighSignal = countTruthy([rpm >= 900, errorRate >= 0.18, failedLogins >= 30, anomaly >= 0.82]) >= 1;
  if (notes.length >= 90) return true;
  if (mediumSignals >= 3 && !hardHighSignal) return true;
  return false;
};

const analyzeThreatWithLlm = async (metrics = {}) => {
  const normalizedMetrics = {
    requests_per_min: Number(metrics.requests_per_min || 0),
    error_rate: Number(metrics.error_rate || 0),
    failed_logins: Number(metrics.failed_logins || 0),
    anomaly_score: Number(metrics.anomaly_score || 0),
    notes: String(metrics.notes || "").trim(),
  };
  const cacheKey = JSON.stringify(normalizedMetrics);
  const cached = threatCache.get(cacheKey);
  if (cached) return { ...cached, cache_hit: true };

  if (!isComplexThreatRequest(normalizedMetrics)) {
    const fastResult = buildHeuristicThreatResult(normalizedMetrics, false);
    threatCache.set(cacheKey, fastResult);
    return fastResult;
  }

  return threatCache.getOrCreate(cacheKey, async () => {
    const fallback = evaluateThreatHeuristic(normalizedMetrics);
    const promptPayload = {
      metrics: normalizedMetrics,
      scoring_guidance: {
        high: "clear indicators of abuse, brute force, or active compromise pressure",
        medium: "meaningful anomaly or suspicious pattern that warrants review",
        low: "normal or low-signal operational behavior",
      },
      rules: [
        "Use only the supplied metrics.",
        "Return strict JSON only.",
        "Reasons must be short operational bullets.",
        "Do not invent unseen telemetry, IPs, users, or incidents.",
      ],
      response_schema: {
        risk_level: "low|medium|high",
        suspicious: true,
        confidence: 0.0,
        risk_score: 0,
        reasons: ["short bullet"],
        advice: ["short action"],
      },
    };

    try {
      const text = await requestLlm({
        messages: [
          {
            role: "user",
            content:
              "You are a SOC threat triage model. Assess the likelihood of active threat behavior from the provided telemetry. " +
              "Return strict JSON only with keys risk_level, suspicious, confidence, risk_score, reasons, advice. " +
              `Input: ${JSON.stringify(promptPayload)}`,
          },
        ],
        topic: "ai-security",
        assistantProfile: {
          tone: "professional",
          style: "concise",
          audience: "security analyst",
        },
        timeoutMs: THREAT_LLM_TIMEOUT_MS,
      });

      const parsed = extractJsonObject(text);
      if (!parsed || typeof parsed !== "object") {
        throw createHttpError(502, "threat_ai_parse_failed", "Threat model returned an invalid response");
      }

      return normalizeThreatResponse({
        parsed,
        fallback,
        provider: "ollama",
        cacheHit: false,
        metrics: normalizedMetrics,
      });
    } catch {
      return buildHeuristicThreatResult(normalizedMetrics, false);
    }
  });
};

router.get("/health", (_req, res) => {
  res.json({ ok: true, mode: "node-compat" });
});

router.use(requireAuth);

router.post("/users", validateBody(userBridgeSchema), async (req, res, next) => {
  try {
    const email = String(req.validatedBody?.email || "").trim().toLowerCase();
    const name = req.validatedBody?.name ? String(req.validatedBody.name).trim() : null;
    const externalId = req.validatedBody?.external_id ? String(req.validatedBody.external_id).trim() : null;

    const authUser =
      (externalId && (await User.findById(externalId).lean())) ||
      (await User.findOne({ email }).lean());
    if (authUser) {
      res.json({
        id: String(authUser._id),
        external_id: externalId || String(authUser._id),
        email: authUser.email,
        name: authUser.name || null,
      });
      return;
    }

    const bridge = await PyUserBridge.findOneAndUpdate(
      { email },
      { $set: { name, externalId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      id: String(bridge._id),
      external_id: bridge.externalId || null,
      email: bridge.email,
      name: bridge.name || null,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/scan/history", validateQuery(scanQuerySchema), async (req, res, next) => {
  try {
    const limit = Number(req.validatedQuery?.limit || 8);
    const page = Number(req.validatedQuery?.page || 1);
    const skip = (page - 1) * limit;
    const riskLevel = String(req.validatedQuery?.risk_level || "all").trim().toLowerCase();
    const explicitUserId = String(req.validatedQuery?.user_id || "").trim();
    const objectId = requireOwnedObjectId(req, explicitUserId, { allowEmpty: true });
    const filter = {
      userId: objectId,
      ...(riskLevel !== "all" ? { riskLevel } : {}),
    };
    const cacheKey = `${String(objectId)}:${riskLevel}:${page}:${limit}`;
    const payload = await scanHistoryCache.getOrCreate(cacheKey, async () => {
      const [rows, total] = await Promise.all([
        Scan.find(filter)
          .select({
            _id: 1,
            url: 1,
            riskLevel: 1,
            risk: 1,
            createdAt: 1,
            "result.riskScore": 1,
            "result.target.normalizedUrl": 1,
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Scan.countDocuments(filter),
      ]);
      return {
        items: rows.map((row) => ({
          id: String(row._id),
          target_url: String(row.url || row.result?.target?.normalizedUrl || ""),
          score: Number(row.result?.riskScore ?? 0),
          risk_level: normalizeRiskLevel(row.riskLevel || row.risk),
          created_at: new Date(row.createdAt || Date.now()).toISOString(),
        })),
        meta: buildListMeta({ page, limit, total }),
      };
    });
    respondOk(res, { items: payload.items }, payload.meta);
  } catch (error) {
    next(error);
  }
});

router.get("/scan/report/:reportId", validateParams(reportParamsSchema), async (req, res, next) => {
  try {
    const reportId = toObjectId(String(req.validatedParams?.reportId || ""));
    const userId = requireOwnedObjectId(req, String(req.user?.sub || ""), { allowEmpty: false });
    if (!reportId) {
      throw createHttpError(404, "report_not_found", "Report not found");
    }
    const cacheKey = `${String(userId)}:${String(reportId)}`;
    const payload = await scanReportCache.getOrCreate(cacheKey, async () => {
      const row = await Scan.findOne({ _id: reportId, ...(userId ? { userId } : {}) })
        .select({
          _id: 1,
          url: 1,
          riskLevel: 1,
          risk: 1,
          createdAt: 1,
          result: 1,
        })
        .lean();
      if (!row) {
        throw createHttpError(404, "report_not_found", "Report not found");
      }
      return buildScanReport(row);
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.post("/scan", validateBody(scanRequestSchema), async (req, res, next) => {
  try {
    const url = String(req.validatedBody?.url || "").trim();
    const ownerUserId = requireOwnedUserId(req, String(req.validatedBody?.user_id || ""), { allowEmpty: true });

    const actor = {
      id: req.user?.sub || "pyapi-compat",
      role: req.user?.role || "user",
      sessionId: req.neurobotSessionId || req.requestId || "pyapi-compat",
      ip: req.ip,
    };
    const userId = requireOwnedObjectId(req, ownerUserId, { allowEmpty: false });
    const requestKey = `${String(userId)}:${String(url).toLowerCase()}`;
    const result = await scanHistoryCache.getOrCreate(
      `live-scan:${requestKey}`,
      async () => runWebSecurityScan(actor, url),
      15_000
    );
    const scan = await Scan.create({
      userId,
      url: result.target?.normalizedUrl || url,
      result,
      riskLevel: normalizeRiskLevel(result.riskLevel),
    });

    if (userId) {
      await createNotification({
        userId,
        title: "Web scan completed",
        message: `Scan finished for ${result.target?.normalizedUrl || url}. Risk score: ${result.riskScore ?? "n/a"}.`,
        severity: normalizeRiskLevel(result.riskLevel),
        type: "webscan",
      });
    }
    invalidateScanCaches(userId, scan._id);

    respondCreated(res, buildScanReport(scan.toObject()));
  } catch (error) {
    next(error);
  }
});

router.post("/threat/detect", validateBody(threatRequestSchema), async (req, res, next) => {
  try {
    const metrics = req.validatedBody?.metrics || {};
    const ownerUserId = requireOwnedUserId(req, String(req.validatedBody?.user_id || ""), { allowEmpty: true });
    let threat;
    try {
      threat = await analyzeThreatWithLlm(metrics);
    } catch {
      threat = {
        risk_level: "low",
        reasons: ["No verified data."],
        suspicious: false,
        metrics,
        verified: false,
        checked_signals: [],
        triggered_signals: [],
        advice: ["Retry when verified telemetry and scoring services are available."],
        ai_used: false,
        analysis_mode: "verified_unavailable",
        provider: "unavailable",
        confidence: 0,
        risk_score: 0,
        cache_hit: false,
      };
    }
    const db = getDb();
    const userId = requireOwnedObjectId(req, ownerUserId, { allowEmpty: false });
    const payload = {
      userId,
      input_metrics: metrics,
      risk_level: threat.risk_level,
      reasons: threat.reasons,
      analysis_mode: threat.analysis_mode,
      provider: threat.provider,
      confidence: threat.confidence,
      risk_score: threat.risk_score,
      createdAt: new Date(),
    };
    const inserted = await db.collection("py_threat_events").insertOne(payload);
    respondCreated(res, {
      id: String(inserted.insertedId),
      user_id: userId ? String(userId) : null,
      risk_level: threat.risk_level,
      reasons: threat.reasons,
      suspicious: threat.suspicious,
      metrics,
      verified: Boolean(threat.verified !== false),
      checked_signals: Array.isArray(threat.checked_signals) ? threat.checked_signals : [],
      triggered_signals: Array.isArray(threat.triggered_signals) ? threat.triggered_signals : [],
      advice: Array.isArray(threat.advice) ? threat.advice : [],
      ai_used: Boolean(threat.ai_used),
      analysis_mode: threat.analysis_mode,
      provider: threat.provider,
      confidence: threat.confidence,
      risk_score: threat.risk_score,
      cache_hit: Boolean(threat.cache_hit),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/osint/intel", validateBody(osintIntelRequestSchema), async (req, res, next) => {
  try {
    const cacheKey = `${String(req.user?.sub || "anon")}::${String(req.validatedBody?.query || "").trim().toLowerCase()}::${String(req.validatedBody?.notes || "").trim().toLowerCase()}`;
    const userId = requireOwnedObjectId(req, String(req.user?.sub || ""), { allowEmpty: false });
    if (!req.validatedBody?.force_refresh) {
      const cached = osintIntelCache.get(cacheKey);
      if (cached) {
        const cachedPayload = { ...cached, cache_hit: true };
        const historyRow = await persistOsintHistory({
          userId,
          payload: cachedPayload,
          modules: cachedPayload.target_type === "ip" ? ["ip", "reverse_dns"] : ["dns", "mx", "whois"],
        });
        respondOk(res, cachedPayload, {
          history_id: String(historyRow?._id || ""),
        });
        return;
      }
    }
    const payload = await osintIntelCache.getOrCreate(
      cacheKey,
      async () => {
        try {
          const livePayload = await proxyPythonApi({
            method: "POST",
            path: "/osint/intel",
            authorization: String(req.headers.authorization || ""),
            body: req.validatedBody,
          });
          return { ...livePayload, cache_hit: false };
        } catch (error) {
          if (error?.code !== "pyapi_proxy_error" && error?.code !== "pyapi_unreachable") throw error;
          return { ...(await buildOsintFallback(req.validatedBody)), cache_hit: false };
        }
      },
      120_000
    );
    const normalizedPayload = {
      ...payload,
      reasons: shortLines(payload?.reasons || [], 3),
      bullets: shortLines(payload?.bullets || [], 3),
      advice: shortLines(payload?.advice || buildOsintAdvice(payload), 3),
      actionable_insights: buildOsintActionableInsights(payload),
      source_summary: buildOsintSourceSummary(payload),
      executive_summary: buildOsintExecutiveSummary(payload),
      confidence: buildOsintConfidence(payload),
      cache_hit: Boolean(payload?.cache_hit),
    };
    const historyRow = await persistOsintHistory({
      userId,
      payload: normalizedPayload,
      modules: normalizedPayload.target_type === "ip" ? ["ip", "reverse_dns"] : ["dns", "mx", "whois"],
    });
    logInfo("OSINT lookup persisted", {
      requestId: req.requestId,
      userId: String(userId),
      targetType: normalizedPayload.target_type,
      verified: Boolean(normalizedPayload.verified),
      riskLevel: normalizedPayload.risk_level,
      cacheHit: normalizedPayload.cache_hit,
    });
    osintIntelCache.set(cacheKey, { ...normalizedPayload, cache_hit: false });
    invalidateOsintCaches(userId);
    respondOk(res, normalizedPayload, {
      history_id: String(historyRow?._id || ""),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/osint/history", validateQuery(osintHistoryQuerySchema), async (req, res, next) => {
  try {
    const limit = Number(req.validatedQuery?.limit || 6);
    const page = Number(req.validatedQuery?.page || 1);
    const skip = (page - 1) * limit;
    const explicitUserId = String(req.validatedQuery?.user_id || "").trim();
    const userId = requireOwnedObjectId(req, explicitUserId, { allowEmpty: true });
    const targetType = String(req.validatedQuery?.target_type || "all").trim().toLowerCase();
    const riskLevel = String(req.validatedQuery?.risk_level || "all").trim().toLowerCase();
    const filter = {
      userId,
      ...(targetType !== "all" ? { targetType } : {}),
      ...(riskLevel !== "all" ? { riskLevel } : {}),
    };
    const cacheKey = `${String(userId)}:${targetType}:${riskLevel}:${page}:${limit}`;
    const payload = await osintHistoryCache.getOrCreate(cacheKey, async () => {
      const [rows, total] = await Promise.all([
        OsintQuery.find(filter)
          .select({
            _id: 1,
            query: 1,
            normalizedQuery: 1,
            targetType: 1,
            riskLevel: 1,
            verified: 1,
            requestCount: 1,
            reasons: 1,
            bullets: 1,
            createdAt: 1,
            updatedAt: 1,
          })
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        OsintQuery.countDocuments(filter),
      ]);
      return {
        items: rows.map((row) => buildOsintHistoryItem(row)),
        meta: buildListMeta({ page, limit, total }),
      };
    });
    respondOk(res, { items: payload.items }, payload.meta);
  } catch (error) {
    next(error);
  }
});

router.get("/osint/status", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "GET",
      path: "/osint/status",
      authorization: String(req.headers.authorization || ""),
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.post("/osint/run", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "POST",
      path: "/osint/run",
      authorization: String(req.headers.authorization || ""),
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/labs/sandbox", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "GET",
      path: "/labs/sandbox",
      authorization: String(req.headers.authorization || ""),
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.post("/labs/sandbox/run", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "POST",
      path: "/labs/sandbox/run",
      authorization: String(req.headers.authorization || ""),
      body: req.body,
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/labs/sandbox/missions/daily", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "GET",
      path: "/labs/sandbox/missions/daily",
      authorization: String(req.headers.authorization || ""),
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/labs/sandbox/missions/weekly", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "GET",
      path: "/labs/sandbox/missions/weekly",
      authorization: String(req.headers.authorization || ""),
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/labs/sandbox/status", async (req, res, next) => {
  try {
    const payload = await proxyPythonApi({
      method: "GET",
      path: "/labs/sandbox/status",
      authorization: String(req.headers.authorization || ""),
    });
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/labs/overview", async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    const payload = await buildLabsOverviewPayload(userId);
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/mission-control", async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    try {
      const payload = await proxyPythonApi({
        method: "GET",
        path: "/mission-control",
        authorization: String(req.headers.authorization || ""),
      });
      respondOk(res, payload);
      return;
    } catch (error) {
      if (!isPyApiTransportError(error)) throw error;
      const payload = await buildMissionControlCompatFallback({
        req,
        userId,
        warning: "Advanced mission-control systems are recovering. Core training progress is still available.",
      });
      respondOk(res, payload, {
        degraded: true,
        fallback: "node_pyapi_compat",
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/mission-control/actions", validateBody(missionActionSchema), async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    try {
      const payload = await proxyPythonApi({
        method: "POST",
        path: "/mission-control/actions",
        authorization: String(req.headers.authorization || ""),
        body: req.validatedBody,
      });
      respondOk(res, payload);
      return;
    } catch (error) {
      if (!isPyApiTransportError(error)) throw error;
      const missionControl = await buildMissionControlCompatFallback({
        req,
        userId,
        warning: "We saved your session locally, but the live action ledger is retrying in the background.",
      });
      respondOk(res, {
        ok: false,
        action_type: String(req.validatedBody?.action_type || ""),
        points_awarded: 0,
        reward: null,
        mission_control: missionControl,
      }, {
        degraded: true,
        fallback: "node_pyapi_compat",
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/mission-control/preferences", validateBody(missionPreferencesSchema), async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    try {
      const payload = await proxyPythonApi({
        method: "POST",
        path: "/mission-control/preferences",
        authorization: String(req.headers.authorization || ""),
        body: req.validatedBody,
      });
      respondOk(res, payload);
      return;
    } catch (error) {
      if (!isPyApiTransportError(error)) throw error;
      const payload = await buildMissionControlCompatFallback({
        req,
        userId,
        warning: "Notification settings could not be synced to the live training engine just yet. Your current preferences remain safe.",
      });
      payload.notification_preferences = {
        ...payload.notification_preferences,
        ...req.validatedBody,
      };
      respondOk(res, payload, {
        degraded: true,
        fallback: "node_pyapi_compat",
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/labs/day/:dayNumber", validateParams(dayLabParamsSchema), async (req, res, next) => {
  try {
    const dayNumber = Number(req.validatedParams?.dayNumber || 1);
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    const module = buildDayLabModule(dayNumber);
    const row = await ensureDayLabState(userId, dayNumber);
    if (dayNumber > 1) {
      const previous = await ensureDayLabState(userId, dayNumber - 1);
      if (!previous?.completed && !row?.unlocked) {
        throw createHttpError(403, "day_lab_locked", "Complete the previous day to unlock this lab");
      }
      if (previous?.completed && !row?.unlocked) {
        await getDayLabCollection().updateOne({ userId, dayNumber }, { $set: { unlocked: true, updatedAt: new Date() } });
        row.unlocked = true;
      }
    }
    const completedTaskIds = Array.isArray(row?.completedTaskIds) ? row.completedTaskIds : [];
    const taskAttemptsById = row?.taskAttemptsById && typeof row.taskAttemptsById === "object" ? row.taskAttemptsById : {};
    const currentTask = module.tasks.find((task) => !completedTaskIds.includes(task.id)) || null;
    respondOk(res, {
      module: {
        ...module,
        tasks: module.tasks.map((task) => ({
          ...task,
          completed: completedTaskIds.includes(task.id),
          attempt_count: Number(taskAttemptsById?.[task.id] || 0),
        })),
      },
      state: dayLabStateResponse(row, dayNumber),
      recommendation: `Focus on task ${Math.min(module.tasks.length, Number(row?.currentTaskIndex || 0) + 1)} and keep the answer tied to a real operator action.`,
      mentor_guidance: currentTask
        ? `Stay deliberate on '${currentTask.title}'. Show the action, then the evidence, then the operator conclusion.`
        : "Lab complete. Move to the next day.",
      current_task_id: currentTask?.id || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/labs/day/:dayNumber/submit", validateParams(dayLabParamsSchema), validateBody(dayLabSubmitSchema), async (req, res, next) => {
  try {
    const dayNumber = Number(req.validatedParams?.dayNumber || 1);
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    const collection = getDayLabCollection();
    const row = await ensureDayLabState(userId, dayNumber);
    const module = buildDayLabModule(dayNumber);
    const task = module.tasks.find((item) => item.id === req.validatedBody?.task_id);
    if (!task) throw createHttpError(404, "task_not_found", "Task not found");

    const completedTaskIds = Array.isArray(row?.completedTaskIds) ? [...row.completedTaskIds] : [];
    const taskAttemptsById = row?.taskAttemptsById && typeof row.taskAttemptsById === "object" ? { ...row.taskAttemptsById } : {};
    const result = validateDayLabAnswer(task, String(req.validatedBody?.answer || ""));
    const attempts = Number(row?.attempts || 0) + 1;
    taskAttemptsById[task.id] = Number(taskAttemptsById[task.id] || 0) + 1;
    const terminalLog = [...(Array.isArray(row?.terminalLog) ? row.terminalLog : []), `$ ${String(req.validatedBody?.answer || "").trim()}`, result.feedback];
    let score = Number(row?.score || 0);
    let xpEarned = Number(row?.xpEarned || 0);
    let completed = Boolean(row?.completed);
    let currentTaskIndex = Number(row?.currentTaskIndex || 0);
    let unlockedNextDay = null;

    if (result.accepted && !completedTaskIds.includes(task.id)) {
      completedTaskIds.push(task.id);
      score += 25;
      xpEarned += 15;
      currentTaskIndex = completedTaskIds.length;
      completed = completedTaskIds.length >= module.tasks.length;
      if (completed && dayNumber < 60) {
        await ensureDayLabState(userId, dayNumber + 1);
        await collection.updateOne({ userId, dayNumber: dayNumber + 1 }, { $set: { unlocked: true, updatedAt: new Date() } });
        unlockedNextDay = dayNumber + 1;
      }
    }

    await collection.updateOne(
      { userId, dayNumber },
      {
        $set: {
          unlocked: true,
          completed,
          currentTaskIndex,
          score,
          xpEarned,
          attempts,
          taskAttemptsById,
          completedTaskIds,
          terminalLog: terminalLog.slice(-20),
          lastFeedback: result.feedback,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await collection.findOne({ userId, dayNumber });
    respondOk(res, {
      accepted: result.accepted,
      task_id: task.id,
      feedback: result.feedback,
      score_delta: result.accepted ? 25 : 0,
      xp_delta: result.accepted ? 15 : 0,
      task_completed: result.accepted,
      lab_completed: Boolean(updated?.completed),
      unlocked_next_day: unlockedNextDay,
      hint: result.hint,
      mentor_guidance: result.accepted
        ? task.kind === "quiz"
          ? "Strong checkpoint. You passed the decision gate and can move to the next required task."
          : "Strong answer. Keep moving and maintain the same evidence quality on the next task."
        : task.kind === "tool_action"
          ? `Slow down on '${task.title}'. Submit a real command that matches the requested tool action.`
          : task.kind === "quiz"
            ? `Slow down on '${task.title}'. Choose the option that reflects evidence-backed operator behavior.`
            : `Slow down on '${task.title}'. Show one clear action and one clear piece of evidence.`,
      retry_allowed: !result.accepted,
      difficulty_band: attempts >= 4 ? "guided" : completedTaskIds.length >= 2 ? "accelerated" : "standard",
      state: dayLabStateResponse(updated, dayNumber),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/adaptive/recommendations", async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    const labs = await buildLabsOverviewPayload(userId);
    const completedByFocus = labs.items
      .filter((item) => item.completed)
      .reduce((acc, item) => {
        acc[item.focus] = (acc[item.focus] || 0) + 1;
        return acc;
      }, {});
    const weakestFocus =
      DAY_LAB_PROGRAM.map((item) => item.focus).find((focus) => !completedByFocus[focus]) ||
      labs.items.find((item) => item.unlocked && !item.completed)?.focus ||
      "foundation";
    const suggestedTrack = DAY_LAB_PROGRAM.find((item) => item.focus === weakestFocus) || DAY_LAB_PROGRAM[0];
    respondOk(res, {
      user_id: userId,
      generated_at: new Date().toISOString(),
      behavior: {
        recent_events: labs.items.filter((item) => item.completed).length,
        recent_surfaces: ["labs", "program", "dashboard"],
      },
      learning: {
        weak_skills: [
          {
            key: weakestFocus,
            label: weakestFocus.replace(/^\w/, (char) => char.toUpperCase()),
            score: Math.max(28, 72 - (completedByFocus[weakestFocus] || 0) * 12),
          },
        ],
        suggested_paths: [
          {
            id: `path-${weakestFocus}`,
            title: `${weakestFocus.replace(/^\w/, (char) => char.toUpperCase())} reinforcement`,
            track: weakestFocus,
            difficulty: DAY_LAB_FOCUS_META[weakestFocus]?.difficulty || "beginner",
          },
        ],
        next_missions: [
          {
            lesson_id: `day-${labs.recommended_day}`,
            lesson_title: `Day ${labs.recommended_day}: ${labs.items.find((item) => item.day === labs.recommended_day)?.title || suggestedTrack.title}`,
            module_title: `${weakestFocus.replace(/^\w/, (char) => char.toUpperCase())} practical track`,
            estimated_minutes: 20,
          },
        ],
      },
      recommendations: [
        {
          title: `Reinforce ${weakestFocus}`,
          reason: `Your next unlocked work sits in ${weakestFocus} and needs another validated rep.`,
          action: `Open Day ${labs.recommended_day} and complete the next accepted task chain.`,
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});

router.post("/events", validateBody(userEventSchema), async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.validatedBody?.user_id || req.user?.sub || ""), { allowEmpty: false });
    const doc = {
      userId,
      eventType: String(req.validatedBody?.event_type || "").trim(),
      surface: String(req.validatedBody?.surface || "").trim(),
      target: req.validatedBody?.target ? String(req.validatedBody.target).trim() : null,
      metadata: req.validatedBody?.metadata && typeof req.validatedBody.metadata === "object" ? req.validatedBody.metadata : {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await getUserEventsCollection().insertOne(doc);
    respondOk(res, buildEventResponse({ ...doc, _id: result.insertedId }));
  } catch (error) {
    next(error);
  }
});

router.post("/progress/daily", validateBody(dailyProgressSchema), async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.validatedBody?.user_id || req.user?.sub || ""), { allowEmpty: false });
    const day = String(req.validatedBody?.day || "").trim();
    await getDailyProgressCollection().updateOne(
      { userId, day },
      {
        $set: {
          userId,
          day,
          missionsCompleted: Number(req.validatedBody?.missions_completed || 0),
          xpEarned: Number(req.validatedBody?.xp_earned || 0),
          streakDay: Number(req.validatedBody?.streak_day || 0),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    const row = await getDailyProgressCollection().findOne({ userId, day });
    respondOk(res, buildDailyProgressResponse(row));
  } catch (error) {
    next(error);
  }
});

router.get("/recommendations", async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    const payload = await buildCompatRecommendations(userId);
    respondOk(res, payload);
  } catch (error) {
    next(error);
  }
});

router.get("/recommendations/stream", async (req, res, next) => {
  try {
    const userId = requireOwnedUserId(req, String(req.user?.sub || ""), { allowEmpty: false });
    const payload = await buildCompatRecommendations(userId);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    res.write(`event: recommendations\nid: ${Date.now()}\ndata: ${JSON.stringify(payload)}\n\n`);
    res.end();
  } catch (error) {
    next(error);
  }
});

export default router;
