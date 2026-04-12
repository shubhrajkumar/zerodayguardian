import { createHash } from "node:crypto";
import net from "node:net";

const COLLECTIONS = {
  profiles: "training_profiles",
  attempts: "training_attempts",
  completions: "training_completions",
};

const MEMORY = {
  profiles: new Map(),
  attempts: [],
  completions: [],
};

const RANKS = [
  { name: "Recruit", minPoints: 0 },
  { name: "Analyst", minPoints: 300 },
  { name: "Hunter", minPoints: 800 },
  { name: "Guardian", minPoints: 1600 },
  { name: "Elite", minPoints: 3000 },
];

const BEGINNER_LABS = [
  {
    id: "beginner-password-strength",
    title: "Credential Hardening Mission",
    objective: "Test password strength safely, explain the score, and identify one stronger replacement pattern.",
    explanation: "This simulated mission teaches password entropy, weak-pattern detection, and account-hardening basics.",
    pointsBase: 60,
    level: "beginner",
    missionTag: "simulated defensive",
    taskDescription: "Enter a sample password, review the score, and explain how one change would improve it.",
    hints: [
      "Longer passwords usually matter more than adding one extra symbol.",
      "Repeated characters and common words reduce strength quickly.",
      "Good answers mention MFA and password hashing too.",
    ],
    solution: "Use 14+ characters, mixed character classes, no common words, and MFA on the protected account.",
  },
  {
    id: "beginner-xss-sandbox",
    title: "Reflected XSS Learning Mission",
    objective: "Inspect a simulated XSS payload, compare unsafe reflection vs safe rendering, and name the primary fix.",
    explanation: "This mission teaches how untrusted input becomes active script when output encoding is missing.",
    pointsBase: 70,
    level: "intermediate",
    missionTag: "simulated offensive+defensive",
    taskDescription: "Submit a payload and compare reflected output with the safely escaped version.",
    hints: [
      "Focus on where the browser interprets the payload, not only the string itself.",
      "A good fix mentions context-aware encoding and CSP.",
      "Explain the risk first, then the remediation.",
    ],
    solution: "Escape output by context, validate inputs, and enforce a strict Content-Security-Policy.",
  },
  {
    id: "beginner-sqli-demo",
    title: "SQL Injection Defense Mission",
    objective: "Review a simulated risky query path, identify the pattern hit, and contrast it with a prepared statement.",
    explanation: "This mission shows how payloads change SQL logic when developers concatenate user input into queries.",
    pointsBase: 80,
    level: "intermediate",
    missionTag: "simulated defensive",
    taskDescription: "Enter a suspicious SQL-style payload and inspect the vulnerable vs secure query forms.",
    hints: [
      "Boolean bypass and UNION SELECT are different attack intents.",
      "Prepared statements separate code from data.",
      "Least-privilege DB access reduces blast radius too.",
    ],
    solution: "Use parameterized queries everywhere, suppress verbose DB errors, and monitor query anomalies.",
  },
  {
    id: "beginner-portscan-visual",
    title: "Attack Surface Mapping Mission",
    objective: "Review a simulated port-state map, identify exposed services, and recommend one hardening action.",
    explanation: "This mission teaches how to interpret open, filtered, and closed ports without touching a live target.",
    pointsBase: 90,
    level: "advanced",
    missionTag: "simulated recon",
    taskDescription: "Enter a public-looking hostname to generate a deterministic simulated service exposure map.",
    hints: [
      "Open ports should always map to an intentional business need.",
      "Filtered does not mean safe; it means access is currently constrained.",
      "A good answer pairs one exposure with one control.",
    ],
    solution: "Close unused ports, restrict admin services to private networks, and baseline expected listening services.",
  },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const actorKey = ({ userId, sessionId }) => (userId ? `u:${userId}` : `s:${sessionId}`);
const resolveRole = (req) => String(req?.user?.role || "student").toLowerCase();

const profilePermissions = (role = "student") => {
  if (role === "admin") return ["labs:run", "labs:complete", "leaderboard:view", "weekly:view", "profiles:manage"];
  if (role === "mentor") return ["labs:run", "labs:complete", "leaderboard:view", "weekly:view", "threads:moderate"];
  return ["labs:run", "labs:complete", "leaderboard:view", "weekly:view"];
};

export const resolveTrainingActor = ({ req }) => ({
  userId: req.user?.sub || null,
  sessionId: req.neurobotSessionId || req.requestId,
  key: actorKey({ userId: req.user?.sub || null, sessionId: req.neurobotSessionId || req.requestId }),
  role: resolveRole(req),
});

const getDbSafe = () => {
  return null; // Force use of in-memory store as DB connection is unavailable
};

const rankFromPoints = (points = 0) => {
  const ordered = [...RANKS].sort((a, b) => a.minPoints - b.minPoints);
  let rank = ordered[0].name;
  for (const item of ordered) {
    if (points >= item.minPoints) rank = item.name;
  }
  return rank;
};

const streakFromDay = (lastActiveDay = "", currentStreak = 1) => {
  const today = todayIso();
  if (!lastActiveDay) return 1;
  const delta = Math.floor((new Date(today).getTime() - new Date(lastActiveDay).getTime()) / 86_400_000);
  if (delta <= 0) return currentStreak;
  if (delta === 1) return currentStreak + 1;
  return 1;
};

const baseProfile = (actor) => ({
  actorKey: actor.key,
  userId: actor.userId,
  role: actor.role,
  points: 0,
  rank: "Recruit",
  level: 1,
  streak: 1,
  completedLabs: 0,
  weeklyPoints: 0,
  weeklyCompletions: 0,
  lastActiveDay: todayIso(),
  updatedAt: Date.now(),
});

const computeLevel = (points = 0) => Math.max(1, Math.floor(points / 180) + 1);
const getLabDefinition = (labId) => BEGINNER_LABS.find((lab) => lab.id === labId) || null;
const getNextLabDefinition = (labId) => {
  const index = BEGINNER_LABS.findIndex((lab) => lab.id === labId);
  if (index < 0) return BEGINNER_LABS[0] || null;
  return BEGINNER_LABS[(index + 1) % BEGINNER_LABS.length] || BEGINNER_LABS[0] || null;
};

const sanitizeDomainLike = (input = "") =>
  String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const isPrivateHost = (hostname = "") => {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (host.endsWith(".local")) return true;
  const kind = net.isIP(host);
  if (kind === 4) {
    if (/^(10|127)\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    const parts = host.split(".").map((p) => Number(p));
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  return false;
};

const detectPasswordLab = (password = "") => {
  const value = String(password || "");
  let charset = 0;
  if (/[a-z]/.test(value)) charset += 26;
  if (/[A-Z]/.test(value)) charset += 26;
  if (/\d/.test(value)) charset += 10;
  if (/[^A-Za-z0-9]/.test(value)) charset += 33;
  const entropy = Number((Math.log2(Math.max(charset, 1)) * value.length).toFixed(2));
  let score = 0;
  if (value.length >= 12) score += 30;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 20;
  if (/\d/.test(value)) score += 20;
  if (/[^A-Za-z0-9]/.test(value)) score += 20;
  if (!/(password|admin|123456|qwerty|letmein)/i.test(value)) score += 10;
  if (/(.)\1{2,}/.test(value)) score -= 15;
  score = Math.max(0, Math.min(100, score));
  const level = score >= 85 ? "strong" : score >= 65 ? "good" : score >= 45 ? "medium" : "weak";
  return {
    score,
    level,
    entropy,
    explanation:
      "Password scoring combines length, character diversity, repetition penalty, and weak-pattern detection.",
    defensiveGuidance: [
      "Use 14+ characters and include mixed case, numbers, and symbols.",
      "Store passwords using adaptive hashing (bcrypt/argon2), never plaintext or fast hashes.",
      "Enable MFA and credential stuffing detection on login endpoints.",
    ],
    visualization: {
      barPercent: score,
      label: level,
    },
  };
};

const detectXssLab = (payload = "") => {
  const sample = String(payload || "");
  const signatures = [
    { key: "<script>", found: /<script/i.test(sample), severity: "high" },
    { key: "onerror=", found: /\bonerror\s*=/i.test(sample), severity: "high" },
    { key: "javascript:", found: /javascript:/i.test(sample), severity: "high" },
    { key: "<img", found: /<img/i.test(sample), severity: "medium" },
    { key: "<svg", found: /<svg/i.test(sample), severity: "medium" },
  ];
  const riskScore = Math.min(
    100,
    signatures.reduce((acc, item) => acc + (item.found ? (item.severity === "high" ? 28 : 14) : 0), 0)
  );
  const blockedRender = sample.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    score: 100 - riskScore,
    riskScore,
    findings: signatures.filter((item) => item.found).map((item) => item.key),
    reflectedOutput: sample,
    safeOutput: blockedRender,
    visualization: {
      blockedRender,
      riskMeter: riskScore,
    },
    explanation: "Payload is inspected against executable script and event-handler signatures in a safe parser.",
    whyThisHappens:
      "Reflected XSS occurs when untrusted input is returned to the browser without context-aware encoding.",
    defensiveGuidance: [
      "Encode output by context (HTML/attribute/JS).",
      "Apply strict Content-Security-Policy and block inline script execution.",
      "Validate and sanitize user-controlled input on server boundaries.",
    ],
  };
};

const detectSqliLab = (payload = "") => {
  const sample = String(payload || "");
  const rules = [
    { id: "boolean-tautology", hit: /('|")?\s*or\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i.test(sample) },
    { id: "union-select", hit: /\bunion\b\s+\bselect\b/i.test(sample) },
    { id: "sql-comment", hit: /(--|#|\/\*)/i.test(sample) },
    { id: "stacked-query", hit: /;\s*(select|drop|insert|update|delete)\b/i.test(sample) },
  ];
  const hits = rules.filter((item) => item.hit).map((item) => item.id);
  const riskScore = Math.min(100, hits.length * 24 + (/\b(drop|truncate)\b/i.test(sample) ? 20 : 0));
  return {
    score: 100 - riskScore,
    riskScore,
    findings: hits,
    vulnerableQuery: `SELECT * FROM users WHERE username = '${sample}' AND is_active = 1;`,
    secureQuery: "SELECT * FROM users WHERE username = ? AND is_active = ?;",
    explanation:
      "Controlled SQLi pattern review matches payloads commonly used for auth bypass, data extraction, and query chaining.",
    whyThisHappens:
      "Unsafe string concatenation lets attacker input alter SQL logic; prepared statements keep code and data separated.",
    defensiveGuidance: [
      "Use prepared statements/parameterized queries for all user input.",
      "Disable verbose SQL errors in production responses.",
      "Apply least-privilege DB accounts and query anomaly monitoring.",
    ],
    visualization: {
      riskMeter: riskScore,
      matchedRules: hits,
    },
  };
};

const detectPortScanLab = (target = "") => {
  const host = sanitizeDomainLike(target);
  if (!host || !host.includes(".") || isPrivateHost(host)) {
    const error = new Error("Target must be a public domain-like host");
    error.status = 400;
    throw error;
  }
  const base = [21, 22, 25, 53, 80, 110, 143, 443, 445, 587, 993, 995, 3306, 5432, 6379, 8080];
  const seed = createHash("sha256").update(host).digest("hex");
  const ports = base.map((port, idx) => {
    const value = parseInt(seed.slice(idx * 2, idx * 2 + 2) || "0", 16);
    const status = value % 5 === 0 ? "filtered" : value % 2 === 0 ? "closed" : "open";
    const risk = status === "open" ? (port === 445 || port === 6379 ? "high" : "medium") : "low";
    return { port, status, risk };
  });
  const openPorts = ports.filter((item) => item.status === "open");
  const riskScore = Math.min(100, openPorts.reduce((acc, item) => acc + (item.risk === "high" ? 20 : 8), 0));
  return {
    score: 100 - riskScore,
    target: host,
    ports,
    riskScore,
    explanation:
      "Simulation derives deterministic service exposure from domain-seeded model to train reconnaissance interpretation safely.",
    defensiveGuidance: [
      "Close unused listening services and enforce host firewall default-deny.",
      "Restrict admin/data ports to private networks only.",
      "Continuously baseline and alert on unexpected port exposure changes.",
    ],
    fundamentals: {
      tcp: "TCP is a connection-oriented transport protocol used by many services.",
      port: "A port is a logical service endpoint on a host (e.g., 443 for HTTPS).",
      whyOpenPortsMatter: "Each open port increases external attack surface and must be intentionally exposed and monitored.",
    },
    visualization: {
      openCount: openPorts.length,
      filteredCount: ports.filter((item) => item.status === "filtered").length,
      closedCount: ports.filter((item) => item.status === "closed").length,
    },
  };
};

const runBeginnerLabEngine = (labId, input) => {
  if (labId === "beginner-password-strength") return detectPasswordLab(input?.password);
  if (labId === "beginner-xss-sandbox") return detectXssLab(input?.payload);
  if (labId === "beginner-sqli-demo") return detectSqliLab(input?.payload);
  if (labId === "beginner-portscan-visual") return detectPortScanLab(input?.target);
  const error = new Error("Unsupported beginner lab");
  error.status = 400;
  throw error;
};

const loadProfile = async (actor) => {
  const db = getDbSafe();
  if (!db) return MEMORY.profiles.get(actor.key) || baseProfile(actor);
  const row = await db.collection(COLLECTIONS.profiles).findOne({ actorKey: actor.key });
  return row || baseProfile(actor);
};

const saveProfile = async (actor, profile) => {
  const db = getDbSafe();
  const next = { ...profile, actorKey: actor.key, userId: actor.userId, role: actor.role, updatedAt: Date.now() };
  if (!db) {
    MEMORY.profiles.set(actor.key, next);
    return next;
  }
  await db.collection(COLLECTIONS.profiles).updateOne({ actorKey: actor.key }, { $set: next }, { upsert: true });
  return next;
};

const storeAttempt = async (row) => {
  const db = getDbSafe();
  if (!db) {
    MEMORY.attempts.push(row);
    if (MEMORY.attempts.length > 3000) MEMORY.attempts.shift();
    return;
  }
  await db.collection(COLLECTIONS.attempts).insertOne(row);
};

const loadLeaderboardRows = async ({ period = "alltime", limit = 20 }) => {
  const db = getDbSafe();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  if (!db) {
    const rows = [...MEMORY.profiles.values()];
    rows.sort((a, b) =>
      period === "weekly"
        ? Number(b.weeklyPoints || 0) - Number(a.weeklyPoints || 0)
        : Number(b.points || 0) - Number(a.points || 0)
    );
    return rows.slice(0, safeLimit);
  }
  const sortField = period === "weekly" ? "weeklyPoints" : "points";
  return db.collection(COLLECTIONS.profiles).find({}).sort({ [sortField]: -1, updatedAt: -1 }).limit(safeLimit).toArray();
};

export const listBeginnerLabs = async () => BEGINNER_LABS;

export const runBeginnerLab = async (actor, { labId, input }) => {
  const definition = getLabDefinition(labId);
  if (!definition) {
    const error = new Error("Unsupported beginner lab");
    error.status = 400;
    throw error;
  }

  const engine = runBeginnerLabEngine(labId, input || {});
  const score = Math.max(0, Math.min(100, Number(engine?.score || 0)));
  const completionEligible = score >= 55;
  const row = {
    actorKey: actor.key,
    userId: actor.userId,
    labId,
    score,
    completionEligible,
    createdAt: Date.now(),
    inputHash: createHash("sha256").update(JSON.stringify(input || {})).digest("hex"),
  };
  await storeAttempt(row);

  return {
    labId: definition.id,
    title: definition.title,
    score,
    level: definition.level,
    missionTag: definition.missionTag,
    explanation: `${definition.explanation} ${engine.explanation}`,
    defensiveGuidance: engine.defensiveGuidance || [],
    completionEligible,
    minimumCompletionScore: 55,
    visualization: engine.visualization || {},
    findings: engine.findings || [],
    riskScore: Number(engine.riskScore || 0),
    entropy: Number(engine.entropy || 0),
    ports: engine.ports || [],
    target: engine.target || "",
    reflectedOutput: engine.reflectedOutput || "",
    safeOutput: engine.safeOutput || "",
    vulnerableQuery: engine.vulnerableQuery || "",
    secureQuery: engine.secureQuery || "",
    whyThisHappens: engine.whyThisHappens || "",
    fundamentals: engine.fundamentals || undefined,
  };
};

export const completeBeginnerLab = async (actor, { labId, score }) => {
  const definition = getLabDefinition(labId);
  if (!definition) {
    const error = new Error("Unsupported beginner lab");
    error.status = 400;
    throw error;
  }

  const normalizedScore = Math.max(0, Math.min(100, Number(score || 0)));
  const basePointsAwarded = Math.round((definition.pointsBase || 50) * (normalizedScore / 100));
  const profile = await loadProfile(actor);
  const existingCompletion = MEMORY.completions.find((item) => item.actorKey === actor.key && item.labId === labId);
  const isFirstCompletion = !existingCompletion;

  const previousDay = String(profile.lastActiveDay || "");
  const nextStreak = streakFromDay(previousDay, Number(profile.streak || 1));
  const streakBonus = nextStreak >= 3 ? Math.min(40, nextStreak * 5) : 0;
  const pointsAwarded = basePointsAwarded + streakBonus;
  profile.points = Number(profile.points || 0) + pointsAwarded;
  profile.completedLabs = Number(profile.completedLabs || 0) + (isFirstCompletion ? 1 : 0);
  profile.weeklyPoints = Number(profile.weeklyPoints || 0) + pointsAwarded;
  profile.weeklyCompletions = Number(profile.weeklyCompletions || 0) + (isFirstCompletion ? 1 : 0);
  profile.streak = nextStreak;
  profile.lastActiveDay = todayIso();
  profile.rank = rankFromPoints(Number(profile.points || 0));
  profile.level = computeLevel(Number(profile.points || 0));
  const savedProfile = await saveProfile(actor, profile);
  const nextLab = getNextLabDefinition(labId);

  const completionRow = {
    actorKey: actor.key,
    userId: actor.userId,
    labId,
    score: normalizedScore,
    pointsAwarded,
    completedAt: Date.now(),
  };
  MEMORY.completions.push(completionRow);
  if (MEMORY.completions.length > 3000) MEMORY.completions.shift();

  return {
    profile: {
      role: actor.role,
      permissions: profilePermissions(actor.role),
      points: Number(savedProfile.points || 0),
      rank: savedProfile.rank,
      level: Number(savedProfile.level || 1),
      streak: Number(savedProfile.streak || 1),
      completedLabs: Number(savedProfile.completedLabs || 0),
      weeklyPoints: Number(savedProfile.weeklyPoints || 0),
      rankLadder: RANKS,
    },
    pointsAwarded,
    streakBonus,
    nextRecommendation: nextLab
      ? {
          labId: nextLab.id,
          title: nextLab.title,
          level: nextLab.level,
        }
      : null,
    badge: normalizedScore >= 85 ? `${definition.title} Excellence` : `${definition.title} Cleared`,
  };
};

export const getProgressionProfile = async (actor) => {
  try {
    const profile = await loadProfile(actor);
    const nowRank = rankFromPoints(Number(profile.points || 0));
    if (profile.rank !== nowRank) {
      profile.rank = nowRank;
      profile.level = computeLevel(Number(profile.points || 0));
      await saveProfile(actor, profile);
    }
    return {
      role: actor.role,
      permissions: profilePermissions(actor.role),
      points: Number(profile.points || 0),
      rank: profile.rank || nowRank,
      level: Number(profile.level || computeLevel(Number(profile.points || 0))),
      streak: Number(profile.streak || 1),
      completedLabs: Number(profile.completedLabs || 0),
      weeklyPoints: Number(profile.weeklyPoints || 0),
      rankLadder: RANKS,
    };
  } catch {
    const fallback = baseProfile(actor);
    return {
      role: actor.role,
      permissions: profilePermissions(actor.role),
      points: Number(fallback.points || 0),
      rank: fallback.rank || "Recruit",
      level: Number(fallback.level || 1),
      streak: Number(fallback.streak || 1),
      completedLabs: Number(fallback.completedLabs || 0),
      weeklyPoints: Number(fallback.weeklyPoints || 0),
      rankLadder: RANKS,
    };
  }
};

export const getProgressionLeaderboard = async ({ period = "alltime", limit = 20 } = {}) => {
  const rows = await loadLeaderboardRows({ period, limit });
  return rows.map((row, idx) => ({
    position: idx + 1,
    alias: String(row.userId || row.actorKey || `guardian-${idx + 1}`).replace(/^u:/, "guardian-"),
    rank: rankFromPoints(Number(row.points || 0)),
    points: Number(row.points || 0),
    weeklyPoints: Number(row.weeklyPoints || 0),
    level: Number(row.level || computeLevel(Number(row.points || 0))),
    streak: Number(row.streak || 1),
    completedLabs: Number(row.completedLabs || 0),
  }));
};

export const getWeeklyChallenges = async () => {
  return {
    week: todayIso(),
    challenges: BEGINNER_LABS.slice(0, 3).map((lab, index) => ({
      id: `weekly-${lab.id}`,
      title: lab.title,
      description: lab.objective,
      points: lab.pointsBase + index * 10,
      level: lab.level,
      tag: lab.missionTag,
    })),
    message: "Simulated weekly learning missions are available.",
  };
};
