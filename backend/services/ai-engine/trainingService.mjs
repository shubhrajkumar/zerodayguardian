import { createHash } from "node:crypto";
import net from "node:net";
import { getDb } from "../../src/config/db.mjs";

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
    title: "Password Strength Lab",
    objective: "Evaluate password resilience using entropy and attack-cost modeling.",
    difficulty: "beginner",
    tags: ["password", "identity", "hardening"],
    pointsBase: 80,
  },
  {
    id: "beginner-xss-sandbox",
    title: "XSS Sandbox Simulation",
    objective: "Detect executable script injection patterns and apply output-encoding defenses.",
    difficulty: "beginner",
    tags: ["xss", "web-security", "secure-coding"],
    pointsBase: 90,
  },
  {
    id: "beginner-sqli-demo",
    title: "SQL Injection Demo (Controlled)",
    objective: "Identify injection signatures and map to parameterized query defense patterns.",
    difficulty: "beginner",
    tags: ["sqli", "database", "appsec"],
    pointsBase: 95,
  },
  {
    id: "beginner-portscan-visual",
    title: "Port Scan Visual Simulator",
    objective: "Interpret exposed service ports and prioritize initial hardening actions.",
    difficulty: "beginner",
    tags: ["recon", "network", "exposure"],
    pointsBase: 85,
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
  try {
    return getDb();
  } catch {
    return null;
  }
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
      "Controlled SQLi simulation matches payload patterns commonly used for auth bypass, data extraction, and query chaining.",
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

export const listBeginnerLabs = async () =>
  BEGINNER_LABS.map((lab) => ({
    ...lab,
    taskDescription:
      lab.id === "beginner-password-strength"
        ? "Evaluate one candidate password and justify whether it is deployment-safe."
        : lab.id === "beginner-xss-sandbox"
          ? "Submit one payload and compare reflected output vs escaped output."
          : lab.id === "beginner-sqli-demo"
            ? "Submit one SQL-like input and inspect vulnerable vs prepared statement query paths."
            : "Run deterministic scan simulation and prioritize risky open ports.",
    explanation:
      lab.id === "beginner-password-strength"
        ? "Learn how password complexity and entropy impact brute-force resistance."
        : lab.id === "beginner-xss-sandbox"
          ? "Understand reflected script injection signatures and secure rendering behavior."
          : lab.id === "beginner-sqli-demo"
            ? "Inspect SQLi payload classes and map findings to defensive query handling."
            : "Interpret simulated service exposure and prioritize network hardening steps.",
    hints:
      lab.id === "beginner-password-strength"
        ? ["Use 14+ length with mixed character classes.", "Avoid repeated and dictionary-like patterns."]
        : lab.id === "beginner-xss-sandbox"
          ? ["Try payloads with `<script>` and event handlers.", "Compare unsafe render vs escaped render."]
          : lab.id === "beginner-sqli-demo"
            ? ["Try tautology and UNION-style payload patterns.", "Look at how prepared statements neutralize payload logic."]
            : ["Prioritize high-risk ports (e.g., 445/6379).", "Focus on closing unused exposed services."],
    solution:
      lab.id === "beginner-password-strength"
        ? "Use passphrase-style password with mixed types, 14+ chars, and MFA."
        : lab.id === "beginner-xss-sandbox"
          ? "Apply output encoding and CSP; never render untrusted input as HTML."
          : lab.id === "beginner-sqli-demo"
            ? "Use parameterized statements for every query and disable verbose SQL errors."
            : "Close unnecessary open ports and enforce firewall allowlists.",
  }));

export const runBeginnerLab = async (actor, { labId, input }) => {
  const lab = getLabDefinition(labId);
  if (!lab) {
    const error = new Error("Lab not found");
    error.status = 404;
    throw error;
  }
  const result = runBeginnerLabEngine(labId, input || {});
  const attempt = {
    attemptId: createHash("sha1").update(`${actor.key}:${labId}:${Date.now()}`).digest("hex").slice(0, 16),
    actorKey: actor.key,
    userId: actor.userId,
    labId,
    score: Number(result.score || 0),
    success: Number(result.score || 0) >= 60,
    createdAt: Date.now(),
  };
  await storeAttempt(attempt);
  return {
    labId,
    title: lab.title,
    ...result,
    completionEligible: Number(result.score || 0) >= 60,
    minimumCompletionScore: 60,
  };
};

export const completeBeginnerLab = async (actor, { labId, score }) => {
  const lab = getLabDefinition(labId);
  if (!lab) {
    const error = new Error("Lab not found");
    error.status = 404;
    throw error;
  }
  const numericScore = Math.max(0, Math.min(100, Number(score || 0)));
  if (numericScore < 60) {
    const error = new Error("Completion requires score >= 60");
    error.status = 400;
    throw error;
  }
  const profile = await loadProfile(actor);
  const today = todayIso();
  const streak = streakFromDay(profile.lastActiveDay, Number(profile.streak || 1));
  const bonus = numericScore >= 85 ? 20 : numericScore >= 70 ? 10 : 0;
  const baseAward = Math.round(lab.pointsBase + (numericScore / 100) * 40 + bonus);
  const dayStart = new Date(`${today}T00:00:00.000Z`).getTime();
  const db = getDbSafe();
  let repeatedToday = false;
  if (!db) {
    repeatedToday = MEMORY.completions.some((row) => row.actorKey === actor.key && row.labId === labId && Number(row.completedAt || 0) >= dayStart);
  } else {
    const prior = await db.collection(COLLECTIONS.completions).findOne({
      actorKey: actor.key,
      labId,
      completedAt: { $gte: dayStart },
    });
    repeatedToday = !!prior;
  }
  const pointsAwarded = repeatedToday ? Math.max(12, Math.round(baseAward * 0.2)) : baseAward;
  const nextPoints = Number(profile.points || 0) + pointsAwarded;
  const nextWeekly = Number(profile.weeklyPoints || 0) + pointsAwarded;
  const nextCompletions = Number(profile.completedLabs || 0) + 1;
  const completionRow = {
    actorKey: actor.key,
    userId: actor.userId,
    labId,
    score: numericScore,
    pointsAwarded,
    completedAt: Date.now(),
    weekKey: `${today.slice(0, 4)}-W${Math.ceil(Number(today.slice(8, 10)) / 7)}`,
  };
  if (!db) MEMORY.completions.push(completionRow);
  else await db.collection(COLLECTIONS.completions).insertOne(completionRow);

  const saved = await saveProfile(actor, {
    ...profile,
    points: nextPoints,
    weeklyPoints: nextWeekly,
    rank: rankFromPoints(nextPoints),
    level: computeLevel(nextPoints),
    streak,
    completedLabs: nextCompletions,
    weeklyCompletions: Number(profile.weeklyCompletions || 0) + 1,
    lastActiveDay: today,
  });
  return {
    profile: {
      rank: saved.rank,
      level: saved.level,
      points: saved.points,
      streak: saved.streak,
      completedLabs: saved.completedLabs,
      weeklyPoints: saved.weeklyPoints,
    },
    pointsAwarded,
    repeatedToday,
    rankUp: rankFromPoints(Number(profile.points || 0)) !== saved.rank,
  };
};

export const getProgressionProfile = async (actor) => {
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
  const today = todayIso();
  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    week: `${start.toISOString().slice(0, 10)} to ${end.toISOString().slice(0, 10)}`,
    challenges: [
      {
        id: `weekly-${today}-pwd`,
        title: "Identity Defense Sprint",
        objective: "Score 85+ in Password Strength Lab and explain the defense model.",
        rewardPoints: 120,
      },
      {
        id: `weekly-${today}-xss`,
        title: "XSS Triage Drill",
        objective: "Detect two executable XSS signatures and provide secure rendering guidance.",
        rewardPoints: 140,
      },
      {
        id: `weekly-${today}-recon`,
        title: "Exposure Mapping Exercise",
        objective: "Complete Port Scan Visual Simulator with risk score under 40 and mitigation plan.",
        rewardPoints: 150,
      },
    ],
  };
};
