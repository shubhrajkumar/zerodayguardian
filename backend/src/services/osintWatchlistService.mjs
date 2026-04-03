import { ObjectId } from "mongodb";
import { getDb } from "../config/db.mjs";
import { resolveOsint } from "./osintService.mjs";
import { routeOsintAlert } from "./osintAlertRouter.mjs";

const COLLECTION_WATCHLISTS = "osint_watchlists";
const COLLECTION_ALERTS = "osint_alerts";

const toObjectId = (value) => (ObjectId.isValid(value) ? new ObjectId(value) : value);

const sanitizeText = (value = "") => String(value || "").trim().slice(0, 4000);

const computeNextRun = (intervalMinutes, now = Date.now()) =>
  now + Math.max(5, Number(intervalMinutes || 60)) * 60 * 1000;

const defaultRules = {
  minRiskScore: 70,
  breachThreshold: 1,
  alertOnNoDns: true,
  alertOnMissingTls: true,
};

const defaultRouting = {
  minSeverity: "medium",
  email: true,
  webhook: true,
  slack: true,
  mode: "all",
  severityMap: {
    low: { webhook: true },
    medium: { webhook: true },
    high: { email: true, slack: true, webhook: true },
  },
};

export const createWatchlist = async ({
  ownerId,
  label,
  target,
  modules = [],
  intervalMinutes = 60,
  rules = {},
  routing = {},
}) => {
  const db = getDb();
  const now = Date.now();
  const doc = {
    ownerId: String(ownerId),
    label: sanitizeText(label || target),
    target: sanitizeText(target),
    modules: modules.map((m) => String(m || "")).filter(Boolean),
    intervalMinutes: Math.max(5, Math.min(Number(intervalMinutes || 60), 1440)),
    rules: { ...defaultRules, ...rules },
    routing: { ...defaultRouting, ...routing },
    active: true,
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    nextRunAt: computeNextRun(intervalMinutes, now),
    lastInsight: null,
    lastStatus: "idle",
  };
  const result = await db.collection(COLLECTION_WATCHLISTS).insertOne(doc);
  return { ...doc, _id: result.insertedId };
};

export const listWatchlists = async ({ ownerId, limit = 50 } = {}) => {
  const db = getDb();
  return db
    .collection(COLLECTION_WATCHLISTS)
    .find({ ownerId: String(ownerId) })
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 100)))
    .toArray();
};

export const updateWatchlist = async ({ ownerId, id, patch = {} }) => {
  const db = getDb();
  const now = Date.now();
  const update = {
    ...(patch.label != null ? { label: sanitizeText(patch.label) } : {}),
    ...(patch.target != null ? { target: sanitizeText(patch.target) } : {}),
    ...(patch.modules ? { modules: patch.modules.map((m) => String(m || "")).filter(Boolean) } : {}),
    ...(patch.intervalMinutes != null
      ? { intervalMinutes: Math.max(5, Math.min(Number(patch.intervalMinutes || 60), 1440)) }
      : {}),
    ...(patch.active != null ? { active: !!patch.active } : {}),
    ...(patch.rules ? { rules: { ...defaultRules, ...patch.rules } } : {}),
    ...(patch.routing ? { routing: { ...defaultRouting, ...patch.routing } } : {}),
  };
  if (update.intervalMinutes != null) {
    update.nextRunAt = computeNextRun(update.intervalMinutes, now);
  }
  await db.collection(COLLECTION_WATCHLISTS).updateOne(
    { _id: toObjectId(id), ownerId: String(ownerId) },
    { $set: { ...update, updatedAt: now } }
  );
  return db.collection(COLLECTION_WATCHLISTS).findOne({ _id: toObjectId(id), ownerId: String(ownerId) });
};

export const deleteWatchlist = async ({ ownerId, id }) => {
  const db = getDb();
  await db.collection(COLLECTION_WATCHLISTS).deleteOne({ _id: toObjectId(id), ownerId: String(ownerId) });
};

export const listAlerts = async ({ ownerId, limit = 50 } = {}) => {
  const db = getDb();
  return db
    .collection(COLLECTION_ALERTS)
    .find({ ownerId: String(ownerId) })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 200)))
    .toArray();
};

export const createAlert = async ({ ownerId, watchlistId, severity, title, message, data = {} }) => {
  const db = getDb();
  const now = Date.now();
  const doc = {
    ownerId: String(ownerId),
    watchlistId: String(watchlistId),
    severity: String(severity || "info"),
    title: sanitizeText(title || "OSINT Alert"),
    message: sanitizeText(message || ""),
    data,
    createdAt: now,
  };
  await db.collection(COLLECTION_ALERTS).insertOne(doc);
  return doc;
};

export const runWatchlistScan = async ({ ownerId, watchlist }) => {
  const db = getDb();
  const now = Date.now();
  const result = await resolveOsint({ query: watchlist.target, modules: watchlist.modules });
  const insight = result.insight || null;
  const severity =
    insight?.level === "high" ? "high" : insight?.level === "medium" ? "medium" : "low";

  const rules = { ...defaultRules, ...(watchlist.rules || {}) };
  const routing = { ...defaultRouting, ...(watchlist.routing || {}) };
  const breachCount =
    result?.results?.breach?.status === "ok" && Array.isArray(result?.results?.breach?.data) ? result.results.breach.data.length : 0;
  const dnsAnswers = result?.results?.dns?.data?.answers || [];
  const dnsSupported = result?.results?.dns?.status === "ok";
  const hasDns = Array.isArray(dnsAnswers)
    ? dnsAnswers.some((entry) => entry?.ok && Array.isArray(entry?.payload?.Answer) && entry.payload.Answer.length > 0)
    : false;
  const tlsSupported = result?.results?.tls?.status === "ok";
  const tlsCount = tlsSupported ? result?.results?.tls?.data?.entries?.length || 0 : 0;

  const shouldAlert =
    (insight?.score || 0) >= rules.minRiskScore ||
    breachCount >= rules.breachThreshold ||
    (rules.alertOnNoDns && dnsSupported && !hasDns) ||
    (rules.alertOnMissingTls && tlsSupported && tlsCount === 0);

  await db.collection(COLLECTION_WATCHLISTS).updateOne(
    { _id: watchlist._id, ownerId: String(ownerId) },
    {
      $set: {
        lastRunAt: now,
        nextRunAt: computeNextRun(watchlist.intervalMinutes || 60, now),
        lastInsight: insight,
        lastStatus: result.status || "ok",
        updatedAt: now,
      },
    }
  );

  if (shouldAlert) {
    await createAlert({
      ownerId,
      watchlistId: watchlist._id?.toString?.() || String(watchlist._id),
      severity,
      title: `Alert: ${watchlist.label}`,
      message: insight?.highlights?.[0] || "Custom alert rule triggered.",
      data: {
        target: watchlist.target,
        insight,
        breachCount,
        hasDns,
        tlsCount,
      },
    });
    await routeOsintAlert({
      severity,
      title: `Alert: ${watchlist.label}`,
      message: insight?.highlights?.[0] || "Custom alert rule triggered.",
      data: {
        target: watchlist.target,
        breachCount,
        hasDns,
        tlsCount,
        insight,
      },
      routing,
    });
  }

  return result;
};
