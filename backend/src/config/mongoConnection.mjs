const ATLAS_HOST_RE = /(?:^|[.-])xoyweux\.mongodb\.net$/i;

/**
 * Derive the correct Atlas replicaSet name from the seed-list hostnames.
 * Atlas sharded clusters follow the convention:
 *   <cluster-name>-shard-00-00.<project-id>.mongodb.net
 * The replicaSet name is: atlas-<cluster-name>-shard-0
 * Falls back to the hardcoded default only if no shard host is found.
 */
const deriveReplicaSet = (hosts = []) => {
  for (const host of hosts) {
    const match = String(host || "").match(/^(.+?)-shard-\d+-\d+\.xoyweux\.mongodb\.net$/i);
    if (match) {
      return `atlas-${match[1]}-shard-0`;
    }
  }
  return ""; // fallback — let driver auto-discover
};

export const normalizeMongoUri = (value = "") => {
  let normalized = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  const prefixed = normalized.match(/^(?:MONGODB_URI|DATABASE_URL|MONGODB_URL|MONGO_URI|MONGO_URL|DB_URI)\s*=\s*(.+)$/i);
  if (prefixed?.[1]) normalized = prefixed[1].trim().replace(/^['"]|['"]$/g, "");

  const pastedTail = normalized.search(/(?:^|[\s&])(?:GOOGLE_|VITE_GOOGLE_|SESSION_SECRET=|JWT_SECRET=)/i);
  if (pastedTail > 0) normalized = normalized.slice(0, pastedTail).trim();

  return normalized;
};

export const normalizeAtlasSeedListUri = (value = "") => {
  const uri = normalizeMongoUri(value);
  if (!uri || !uri.startsWith("mongodb://")) return uri;

  const hostsPart = uri.slice("mongodb://".length).split("/")[0].split("@").pop() || "";
  const hosts = hostsPart
    .split(",")
    .map((entry) => entry.trim().split(":")[0])
    .filter(Boolean);
  const looksLikeAtlasShardList = hosts.length > 1 && hosts.some((host) => ATLAS_HOST_RE.test(host));
  if (!looksLikeAtlasShardList) return uri;

  const [base, rawQuery = ""] = uri.split("?", 2);
  const params = new URLSearchParams(rawQuery);
  if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");
  if (params.has("ssl") && !params.has("tls")) {
    params.set("tls", params.get("ssl") || "true");
    params.delete("ssl");
  }
  if (!params.has("authSource")) params.set("authSource", "admin");
  if (!params.has("retryWrites")) params.set("retryWrites", "true");
  if (!params.has("w")) params.set("w", "majority");
  // When using explicit seed-list URLs (mongodb://) for Atlas sharded clusters,
  // the replicaSet parameter is REQUIRED for proper SCRAM auth handshake.
  // Without it the driver may connect to a secondary that can't authenticate.
  // Derive the replicaSet from the hostname dynamically; if no shard host is
  // recognized, omit the param and let the driver auto-discover.
  if (!params.has("replicaSet")) {
    const rs = deriveReplicaSet(hosts);
    if (rs) params.set("replicaSet", rs);
  }
  // Do NOT force authMechanism — let MongoDB driver auto-negotiate.
  // Explicit SCRAM-SHA-256 fails if the Atlas user uses SCRAM-SHA-1.
  // The driver defaults to mechanism negotiation which works with both.

  return `${base}?${params.toString()}`;
};

export const mongoConnectOptions = ({
  dbName = process.env.MONGODB_DB_NAME || "zeroday_guardian",
  timeoutMs = Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
  maxPoolSize = 10,
} = {}) => ({
  dbName,
  tls: true,                  // MongoDB driver 6.x deprecated `ssl` — use `tls`
  tlsAllowInvalidCertificates: false,
  authSource: "admin",
  // authMechanism omitted — let driver auto-negotiate (Atlas may use SHA-1 or SHA-256)
  // replicaSet omitted — the URI's replicaSet param (set by normalizeAtlasSeedListUri)
  // is used by the driver. If not present the driver auto-discovers it.
  retryWrites: true,
  w: "majority",
  maxPoolSize,
  minPoolSize: 0,
  serverSelectionTimeoutMS: timeoutMs,
  connectTimeoutMS: timeoutMs,
  socketTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  family: 4,
});

export const mongooseConnectOptions = (options = {}) => ({
  ...mongoConnectOptions(options),
  autoIndex: false,
});
