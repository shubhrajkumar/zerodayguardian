import { getDb } from "../../src/config/db.mjs";
import { getMemoryStats } from "../memory-service/memoryService.mjs";
import { getKnowledgeStats } from "../knowledge-base/knowledgeBaseService.mjs";
import { incMetric, observeMetric } from "../../src/observability/telemetry.mjs";
import { createHash } from "node:crypto";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { URL } from "node:url";
import { promises as dns } from "node:dns";

const MEMORY = {
  profiles: new Map(),
  events: [],
  prompts: new Map(),
  labs: [],
  threads: [],
};

const COLLECTIONS = {
  profiles: "user_profiles",
  events: "telemetry_events",
  prompts: "prompt_recommendations",
  labs: "lab_progress",
  threads: "community_threads",
};

const PROMPT_POOL = [
  {
    id: "prompt_recon_1",
    intent: "recon",
    difficulty: 2,
    text: "Create an authorized reconnaissance plan with scope definition, Nmap sequence, and evidence capture format.",
    nextStep: "Run one scan in lab and document service exposure deltas.",
  },
  {
    id: "prompt_webapp_1",
    intent: "web-security",
    difficulty: 3,
    text: "Explain a web vulnerability with attack flow, detection indicators, and concrete remediation checklist.",
    nextStep: "Simulate one payload in a legal lab and verify fix with retest.",
  },
  {
    id: "prompt_ai_sec_1",
    intent: "ai-security",
    difficulty: 3,
    text: "Design an AI threat model: prompt injection risks, data leakage paths, and guardrail controls.",
    nextStep: "Implement two prompt-defense controls and validate with red-team prompts.",
  },
  {
    id: "prompt_blue_team_1",
    intent: "defense",
    difficulty: 2,
    text: "Build a SOC triage runbook for suspicious alerts including severity scoring and escalation policy.",
    nextStep: "Classify ten verified alert samples and measure triage consistency.",
  },
  {
    id: "prompt_career_1",
    intent: "learning",
    difficulty: 1,
    text: "Create a 4-week cyber learning plan with daily tasks, hands-on labs, and measurable checkpoints.",
    nextStep: "Complete week one and report blockers for adaptive adjustment.",
  },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const dayKey = (ts) => new Date(ts || Date.now()).toISOString().slice(0, 10);

const getDbSafe = () => {
  try {
    return getDb();
  } catch {
    return null;
  }
};

const withDbFallback = async (dbTask, memoryTask) => {
  try {
    return await dbTask();
  } catch {
    return memoryTask();
  }
};

const actorKey = ({ userId, sessionId }) => (userId ? `u:${userId}` : `s:${sessionId}`);

export const resolveActor = ({ req }) => ({
  userId: req.user?.sub || null,
  sessionId: req.neurobotSessionId,
  key: actorKey({ userId: req.user?.sub || null, sessionId: req.neurobotSessionId }),
});

const classifyIntent = (query = "", tool = "") => {
  const text = `${query} ${tool}`.toLowerCase();
  if (/nmap|recon|subdomain|osint|scan/.test(text)) return "recon";
  if (/xss|sqli|csrf|owasp|vuln|exploit/.test(text)) return "web-security";
  if (/soc|siem|incident|detection|log/.test(text)) return "defense";
  if (/ai|llm|prompt|model/.test(text)) return "ai-security";
  return "learning";
};

const complexityScore = (query = "", depth = 0) => {
  const lenScore = Math.min(1, String(query || "").trim().length / 180);
  const technical = /(tcp|udp|payload|privilege|mitigation|forensics|cve|ioc|kill chain)/i.test(String(query || "")) ? 0.35 : 0;
  return Math.max(0, Math.min(1, lenScore * 0.65 + technical + Math.min(0.25, Number(depth || 0) * 0.03)));
};

const baseProfile = () => ({
  xp: 0,
  streak: 1,
  lastActiveDay: todayIso(),
  proficiency: 0.2,
  rank: "Rookie",
  updatedAt: Date.now(),
});

const calcRank = (xp = 0) => {
  if (xp >= 1800) return "Elite";
  if (xp >= 900) return "Guardian";
  return "Rookie";
};

const badgeCatalog = ({ xp = 0, streak = 1, completedLabs = 0, toolsUsed = 0, totalActions = 0, successRate = 0, intents = [] } = {}) => {
  const badges = [
    {
      id: "first-steps",
      label: "First Steps",
      earned: totalActions >= 1,
      progress: Math.min(100, totalActions * 100),
      detail: "Log your first tracked cybersecurity action.",
    },
    {
      id: "signal-hunter",
      label: "Signal Hunter",
      earned: xp >= 200,
      progress: Math.min(100, Math.round((xp / 200) * 100)),
      detail: "Reach 200 XP through verified actions and mission work.",
    },
    {
      id: "streak-keeper",
      label: "Streak Keeper",
      earned: streak >= 5,
      progress: Math.min(100, Math.round((streak / 5) * 100)),
      detail: "Maintain a 5-day activity streak.",
    },
    {
      id: "lab-runner",
      label: "Lab Runner",
      earned: completedLabs >= 3,
      progress: Math.min(100, Math.round((completedLabs / 3) * 100)),
      detail: "Complete 3 guided labs.",
    },
    {
      id: "toolkit-explorer",
      label: "Toolkit Explorer",
      earned: toolsUsed >= 4,
      progress: Math.min(100, Math.round((toolsUsed / 4) * 100)),
      detail: "Use 4 distinct tools or workspaces.",
    },
    {
      id: "precision-operator",
      label: "Precision Operator",
      earned: totalActions >= 10 && successRate >= 0.8,
      progress: Math.min(100, Math.round(((Math.min(totalActions, 10) / 10) * 0.6 + Math.min(successRate, 0.8) / 0.8 * 0.4) * 100)),
      detail: "Keep success rate high over at least 10 actions.",
    },
    {
      id: "adaptive-defender",
      label: "Adaptive Defender",
      earned: intents.length >= 3,
      progress: Math.min(100, Math.round((intents.length / 3) * 100)),
      detail: "Show activity across at least 3 intent categories.",
    },
  ];
  return badges;
};

const SKILL_NODES = [
  {
    id: "osint_intelligence",
    label: "OSINT Intelligence",
    match: (event) => /osint|domain|whois|dns|mx|reverse-dns|intel/i.test(`${event.type || ""} ${event.tool || ""} ${event.query || ""}`),
  },
  {
    id: "web_security",
    label: "Web Security",
    match: (event) => /xss|sqli|csrf|headers|webscan|owasp|tls|https/i.test(`${event.type || ""} ${event.tool || ""} ${event.query || ""}`),
  },
  {
    id: "threat_detection",
    label: "Threat Detection",
    match: (event) => /threat|telemetry|siem|incident|alert|hunt|anomaly/i.test(`${event.type || ""} ${event.tool || ""} ${event.query || ""}`),
  },
  {
    id: "secure_engineering",
    label: "Secure Engineering",
    match: (event) => /password|auth|api|token|hardening|defense/i.test(`${event.type || ""} ${event.tool || ""} ${event.query || ""}`),
  },
  {
    id: "simulation_ops",
    label: "Simulation Ops",
    match: (event) => /lab|mission|sandbox|practice|progress/i.test(`${event.type || ""} ${event.tool || ""} ${event.query || ""}`),
  },
];

const buildSkillGraph = ({ events = [], labs = [], proficiency = 0.2 }) => {
  const graph = SKILL_NODES.map((node) => {
    const nodeEvents = events.filter((event) => node.match(event));
    const successes = nodeEvents.filter((event) => event.success !== false).length;
    const failures = nodeEvents.filter((event) => event.success === false).length;
    const avgDepth = nodeEvents.length
      ? nodeEvents.reduce((sum, event) => sum + Number(event.depth || 0), 0) / nodeEvents.length
      : 0;
    const completedLabs = labs.filter((lab) => String(lab.status || "") === "completed" && node.match({ type: "lab_progress", tool: "lab", query: String(lab.labId || "") })).length;
    const exposure = Math.min(1, nodeEvents.length / 14);
    const execution = nodeEvents.length ? successes / Math.max(1, nodeEvents.length) : 0;
    const labBoost = Math.min(0.22, completedLabs * 0.06);
    const score = Math.max(
      0,
      Math.min(
        100,
        Math.round(((proficiency * 0.28) + exposure * 0.34 + execution * 0.24 + Math.min(1, avgDepth / 5) * 0.14 + labBoost) * 100)
      )
    );
    const gap = Math.max(0, Math.round((failures * 9) + Math.max(0, 55 - score)));
    return {
      id: node.id,
      label: node.label,
      score,
      exposureCount: nodeEvents.length,
      successRate: Number(execution.toFixed(2)),
      completedLabs,
      level: score >= 78 ? "strong" : score >= 56 ? "growing" : "weak",
      gap,
      recommendation:
        score >= 78
          ? `Push ${node.label} into harder missions or real verified workflows.`
          : score >= 56
            ? `Keep building ${node.label} with one more focused lab or workflow this week.`
            : `Prioritize ${node.label}; it is currently a weakness in your graph.`,
    };
  });

  const strongest = [...graph].sort((a, b) => b.score - a.score).slice(0, 2);
  const weakest = [...graph].sort((a, b) => b.gap - a.gap || a.score - b.score).slice(0, 2);
  const recommendedPath = [...weakest, ...graph.filter((node) => !weakest.some((weak) => weak.id === node.id)).sort((a, b) => b.score - a.score)]
    .slice(0, 3)
    .map((node) => ({
      skillId: node.id,
      label: node.label,
      priority: weakest.some((weak) => weak.id === node.id) ? "close_gap" : "compound_strength",
      action:
        weakest.some((weak) => weak.id === node.id)
          ? `Schedule a focused practice block for ${node.label}.`
          : `Use ${node.label} as a leverage point in a harder mission.`,
    }));

  return {
    nodes: graph,
    strongest,
    weakest,
    recommendedPath,
  };
};

const updateStreak = (profile) => {
  const today = todayIso();
  const prev = String(profile.lastActiveDay || "");
  if (!prev) return { ...profile, streak: 1, lastActiveDay: today };
  const delta = Math.floor((new Date(today).getTime() - new Date(prev).getTime()) / 86400000);
  if (delta <= 0) return { ...profile, lastActiveDay: today };
  if (delta === 1) return { ...profile, streak: Number(profile.streak || 1) + 1, lastActiveDay: today };
  return { ...profile, streak: 1, lastActiveDay: today };
};

const readProfileMemory = (actor) => MEMORY.profiles.get(actor.key) || baseProfile();
const writeProfileMemory = (actor, profile) => {
  MEMORY.profiles.set(actor.key, profile);
  return profile;
};

const loadProfile = async (actor) => {
  const db = getDbSafe();
  if (!db) return readProfileMemory(actor);
  return withDbFallback(
    async () => {
      const col = db.collection(COLLECTIONS.profiles);
      const row = await col.findOne({ actorKey: actor.key });
      return row || baseProfile();
    },
    () => readProfileMemory(actor)
  );
};

const saveProfile = async (actor, profile) => {
  const db = getDbSafe();
  if (!db) return writeProfileMemory(actor, profile);
  return withDbFallback(
    async () => {
      const col = db.collection(COLLECTIONS.profiles);
      await col.updateOne(
        { actorKey: actor.key },
        { $set: { ...profile, actorKey: actor.key, userId: actor.userId, sessionId: actor.sessionId } },
        { upsert: true }
      );
      return profile;
    },
    () => writeProfileMemory(actor, profile)
  );
};

export const recordTelemetryEvent = async (actor, payload) => {
  const started = Date.now();
  const intent = classifyIntent(payload.query, payload.tool);
  const complexity = complexityScore(payload.query, payload.depth);
  const db = getDbSafe();
  const row = {
    actorKey: actor.key,
    userId: actor.userId,
    sessionId: actor.sessionId,
    type: payload.type,
    tool: payload.tool || "",
    intent,
    complexity,
    success: payload.success !== false,
    durationMs: Number(payload.durationMs || 0),
    depth: Number(payload.depth || 0),
    query: String(payload.query || "").slice(0, 2000),
    metadata: payload.metadata || {},
    createdAt: Date.now(),
  };
  if (!db) {
    MEMORY.events.push(row);
    if (MEMORY.events.length > 2500) MEMORY.events.shift();
  } else {
    await withDbFallback(
      async () => {
        await db.collection(COLLECTIONS.events).insertOne(row);
      },
      () => {
        MEMORY.events.push(row);
        if (MEMORY.events.length > 2500) MEMORY.events.shift();
      }
    );
  }

  const profile = updateStreak(await loadProfile(actor));
  const xpGain = Math.max(3, Math.min(25, 5 + Math.round(complexity * 10) + (payload.success === false ? 0 : 4)));
  const next = {
    ...profile,
    xp: Number(profile.xp || 0) + xpGain,
    proficiency: Math.max(
      0,
      Math.min(
        1,
        Number(profile.proficiency || 0.2) * 0.82 +
          complexity * 0.13 +
          (payload.success === false ? 0 : 0.05) +
          Math.min(0.08, Number(payload.depth || 0) * 0.01)
      )
    ),
    rank: calcRank(Number(profile.xp || 0) + xpGain),
    updatedAt: Date.now(),
  };
  await saveProfile(actor, next);

  incMetric("neurobot_intel_events_total", 1, { type: payload.type, intent });
  observeMetric("neurobot_intel_event_latency_ms", Date.now() - started, { type: payload.type });
  return { intent, complexity, xpGain, profile: next };
};

const readRecentEvents = async (actor, limit = 160) => {
  const db = getDbSafe();
  if (!db) return MEMORY.events.filter((e) => e.actorKey === actor.key).slice(-limit);
  return withDbFallback(
    async () => db.collection(COLLECTIONS.events).find({ actorKey: actor.key }).sort({ createdAt: -1 }).limit(limit).toArray(),
    () => MEMORY.events.filter((e) => e.actorKey === actor.key).slice(-limit)
  );
};

const promptScore = ({ prompt, intent, profile, recent }) => {
  const intentMatch = prompt.intent === intent ? 1 : 0;
  const diffGap = Math.abs((profile.proficiency || 0.2) * 5 - prompt.difficulty);
  const difficultyFit = Math.max(0, 1 - diffGap / 5);
  const usagePenalty = recent.some((r) => r.metadata?.promptId === prompt.id) ? -0.22 : 0;
  const stochastic = Math.random() * 0.08;
  return intentMatch * 0.55 + difficultyFit * 0.35 + usagePenalty + stochastic;
};

export const getAdaptivePromptRecommendation = async (actor, { query = "", regenerate = false } = {}) => {
  const intent = classifyIntent(query, "");
  const profile = await loadProfile(actor);
  const recent = await readRecentEvents(actor, 80);
  const ranked = PROMPT_POOL.map((prompt) => ({
    ...prompt,
    relevance: Number(promptScore({ prompt, intent, profile, recent }).toFixed(4)),
  })).sort((a, b) => b.relevance - a.relevance);
  const selected = ranked[0] || PROMPT_POOL[0];

  if (regenerate) {
    await recordTelemetryEvent(actor, {
      type: "prompt_regenerate",
      query,
      tool: "",
      depth: 1,
      success: true,
      metadata: { promptId: selected.id, relevance: selected.relevance },
    });
  }

  const db = getDbSafe();
  const storeRow = {
    actorKey: actor.key,
    userId: actor.userId,
    sessionId: actor.sessionId,
    promptId: selected.id,
    intent,
    relevance: selected.relevance,
    query: String(query || "").slice(0, 1000),
    createdAt: Date.now(),
  };
  if (!db) {
    MEMORY.prompts.set(actor.key, storeRow);
  } else {
    await withDbFallback(
      async () => {
        await db.collection(COLLECTIONS.prompts).insertOne(storeRow);
      },
      () => MEMORY.prompts.set(actor.key, storeRow)
    );
  }

  return {
    promptId: selected.id,
    prompt: selected.text,
    nextStep: selected.nextStep,
    intent,
    relevance: selected.relevance,
    proficiency: Number(profile.proficiency || 0.2),
  };
};

export const getDashboardIntelligence = async (actor) => {
  const profile = await loadProfile(actor);
  const events = await readRecentEvents(actor, 420);
  const memoryStats = await getMemoryStats({ userId: actor.userId, sessionId: actor.sessionId });
  const knowledgeStats = await getKnowledgeStats({ userId: actor.userId, sessionId: actor.sessionId });
  const labsDb = getDbSafe();
  let labs = [];
  if (labsDb) {
    labs = await withDbFallback(
      async () => labsDb.collection(COLLECTIONS.labs).find({ actorKey: actor.key }).sort({ updatedAt: -1 }).limit(200).toArray(),
      () => MEMORY.labs.filter((l) => l.actorKey === actor.key)
    );
  } else {
    labs = MEMORY.labs.filter((l) => l.actorKey === actor.key);
  }

  const heatmap = {};
  for (const event of events) {
    const key = dayKey(event.createdAt);
    heatmap[key] = (heatmap[key] || 0) + 1;
  }
  const completedLabs = labs.filter((l) => l.status === "completed").length;
  const totalLabsTouched = new Set(labs.map((l) => l.labId)).size;

  const mostRecentIntent = events[0]?.intent || "learning";
  const continueLearning = {
    intent: mostRecentIntent,
    action:
      mostRecentIntent === "recon"
        ? "Run one controlled enumeration lab and compare service deltas."
        : mostRecentIntent === "web-security"
          ? "Complete one OWASP lab with exploit and patch verification."
          : mostRecentIntent === "defense"
            ? "Triage ten alerts and classify true/false positives."
            : "Follow a 45-minute focused mission from your roadmap.",
  };

  const successEvents = events.filter((event) => event.success !== false).length;
  const totalEvents = Math.max(1, events.length);
  const distinctIntents = [...new Set(events.map((event) => String(event.intent || "learning")).filter(Boolean))];
  const telemetry = {
    events: events.length,
    toolsUsed: new Set(events.map((event) => event.tool).filter(Boolean)).size,
    successRate: Number((successEvents / totalEvents).toFixed(2)),
    averageDurationMs: events.length
      ? Math.round(events.reduce((acc, event) => acc + Number(event.durationMs || 0), 0) / events.length)
      : 0,
  };
  const badges = badgeCatalog({
    xp: Number(profile.xp || 0),
    streak: Number(profile.streak || 1),
    completedLabs,
    toolsUsed: telemetry.toolsUsed,
    totalActions: events.length,
    successRate: telemetry.successRate,
    intents: distinctIntents,
  });
  const achievements = badges.filter((badge) => badge.earned).map((badge) => badge.label);
  const todayActions = events.filter((event) => dayKey(event.createdAt) === todayIso()).length;
  const nextRankXp = Number(profile.xp || 0) >= 1800 ? 1800 : Number(profile.xp || 0) >= 900 ? 1800 : 900;
  const xpToNextRank = Math.max(0, nextRankXp - Number(profile.xp || 0));
  const skillGraph = buildSkillGraph({
    events,
    labs,
    proficiency: Number(profile.proficiency || 0.2),
  });

  return {
    xp: Number(profile.xp || 0),
    streak: Number(profile.streak || 1),
    rank: profile.rank || calcRank(Number(profile.xp || 0)),
    proficiency: Number(profile.proficiency || 0.2),
    completedLabs,
    totalLabsTouched,
    heatmap,
    continueLearning,
    telemetry,
    achievements,
    badges,
    skillGraph,
    gamification: {
      totalActions: events.length,
      todayActions,
      xpToNextRank,
      nextRank: nextRankXp === 1800 ? "Elite" : "Guardian",
      trackedIntents: distinctIntents,
    },
    memory: memoryStats,
    knowledge: knowledgeStats,
    recentToolUsage: events
      .filter((e) => e.tool)
      .slice(0, 8)
      .map((e) => ({ tool: e.tool, intent: e.intent, at: e.createdAt })),
  };
};

export const saveLabProgress = async (actor, payload) => {
  const db = getDbSafe();
  const difficulty = Number(payload.difficulty || 2);
  const durationSec = Number(payload.durationSec || 0);
  const score =
    payload.status === "completed"
      ? Math.max(55, Math.min(100, 70 + difficulty * 6 - Math.min(18, Math.floor(durationSec / 180))))
      : payload.status === "failed"
        ? 20
        : 40;
  const row = {
    actorKey: actor.key,
    userId: actor.userId,
    sessionId: actor.sessionId,
    labId: payload.labId,
    status: payload.status,
    durationSec,
    difficulty,
    score,
    updatedAt: Date.now(),
  };
  if (db) {
    await withDbFallback(
      async () =>
        db.collection(COLLECTIONS.labs).updateOne({ actorKey: actor.key, labId: payload.labId }, { $set: row }, { upsert: true }),
      () => {
        const idx = MEMORY.labs.findIndex((x) => x.actorKey === actor.key && x.labId === payload.labId);
        if (idx >= 0) MEMORY.labs[idx] = row;
        else MEMORY.labs.push(row);
      }
    );
  } else {
    const idx = MEMORY.labs.findIndex((x) => x.actorKey === actor.key && x.labId === payload.labId);
    if (idx >= 0) MEMORY.labs[idx] = row;
    else MEMORY.labs.push(row);
  }
  const telemetry = await recordTelemetryEvent(actor, {
    type: "lab_progress",
    query: payload.labId,
    tool: "lab",
    depth: difficulty,
    durationMs: durationSec * 1000,
    success: payload.status === "completed",
    metadata: { status: payload.status, score },
  });
  return {
    ...row,
    feedback: {
      score,
      xpAwarded: Number(telemetry?.xpGain || 0),
      totalXp: Number(telemetry?.profile?.xp || 0),
      rank: String(telemetry?.profile?.rank || "Rookie"),
    },
  };
};

export const getCommunityIntelligence = async () => {
  const db = getDbSafe();
  let profiles = [];
  if (db) {
    profiles = await withDbFallback(
      async () => db.collection(COLLECTIONS.profiles).find({}).sort({ xp: -1, streak: -1 }).limit(20).toArray(),
      () => [...MEMORY.profiles.entries()].map(([key, value]) => ({ actorKey: key, ...value }))
    );
  } else {
    profiles = [...MEMORY.profiles.entries()].map(([key, value]) => ({ actorKey: key, ...value }));
    profiles.sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
    profiles = profiles.slice(0, 20);
  }

  const leaderboard = profiles.slice(0, 10).map((profile, idx) => ({
    alias: `Guardian-${String(idx + 1).padStart(2, "0")}`,
    rank: profile.rank || calcRank(Number(profile.xp || 0)),
    xp: Number(profile.xp || 0),
    streak: Number(profile.streak || 1),
    proficiency: Number(profile.proficiency || 0.2),
  }));

  const events = db
    ? await withDbFallback(
      async () => db.collection(COLLECTIONS.events).find({}).sort({ createdAt: -1 }).limit(1200).toArray(),
      () => MEMORY.events.slice(-1200)
    )
    : MEMORY.events.slice(-1200);

  const intentCount = {};
  for (const event of events) {
    const intent = String(event.intent || "learning");
    intentCount[intent] = (intentCount[intent] || 0) + 1;
  }
  const dominant = Object.entries(intentCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([intent]) => intent);

  const intentMission = (intent, idx) => ({
    id: `mission-${idx + 1}`,
    title:
      intent === "recon"
        ? "Recon Mission"
        : intent === "web-security"
          ? "Web Defense Mission"
          : intent === "defense"
            ? "Blue Team Mission"
            : intent === "ai-security"
              ? "AI Security Mission"
              : "Learning Mission",
    objective:
      intent === "recon"
        ? "Complete one authorized reconnaissance workflow and submit findings."
        : intent === "web-security"
          ? "Patch one vulnerable pattern and validate with regression checks."
          : intent === "defense"
            ? "Triage ten alerts and build a short response playbook."
            : intent === "ai-security"
              ? "Design two controls against prompt injection and leakage."
              : "Complete one focused learning sprint with practical notes.",
  });

  return {
    leaderboard,
    missions: (dominant.length ? dominant : ["learning", "defense", "recon"]).map(intentMission),
    generatedAt: Date.now(),
  };
};

export const getResourceVault = async () => {
  const now = Date.now();
  return {
    generatedAt: now,
    resources: [
      {
        id: "res-owasp-top10",
        title: "OWASP Top 10",
        kind: "framework",
        source: "OWASP",
        url: "https://owasp.org/www-project-top-ten/",
        usage: "Use as baseline for web risk classification and remediation prioritization.",
        reliability: "verified",
        updatedAt: now,
      },
      {
        id: "res-mitre-attck",
        title: "MITRE ATT&CK",
        kind: "framework",
        source: "MITRE",
        url: "https://attack.mitre.org/",
        usage: "Map detections and threat-hunting hypotheses to known adversary tactics.",
        reliability: "trusted",
        updatedAt: now,
      },
      {
        id: "res-cisa-alerts",
        title: "CISA Advisories",
        kind: "threat-intel",
        source: "CISA",
        url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
        usage: "Track high-impact vulnerabilities and prioritize patch windows.",
        reliability: "verified",
        updatedAt: now,
      },
      {
        id: "res-blue-playbook",
        title: "Blue Team Incident Response Playbook",
        kind: "guide",
        source: "ZeroDay-Guardian",
        url: "/downloads/BlueTeam_Incident_Response_Playbook.md",
        usage: "Use for structured triage, containment, and post-incident evidence handling.",
        reliability: "updated",
        updatedAt: now,
      },
      {
        id: "res-threat-cheatsheet",
        title: "Threat Hunting Query Cheatsheet",
        kind: "cheatsheet",
        source: "ZeroDay-Guardian",
        url: "/downloads/ThreatHunting_Query_CheatSheet.md",
        usage: "Use for SOC pivoting and hypothesis-driven investigation workflows.",
        reliability: "updated",
        updatedAt: now,
      },
    ],
  };
};

const DORK_TEMPLATES = {
  "File exposure": {
    pattern: 'site:%TARGET% (ext:env OR ext:ini OR ext:sql OR ext:bak OR ext:log) ("password" OR "api_key" OR "secret")',
    explanation:
      "Targets indexed config/backup/log files that can leak credentials, tokens, or environment internals.",
    defensiveAdvice:
      "Block sensitive extensions at the edge, remove indexed backup files, and rotate exposed secrets immediately.",
  },
  "Login pages": {
    pattern: 'site:%TARGET% (intitle:"login" OR inurl:login OR inurl:signin OR inurl:portal) (admin|staff|dashboard)',
    explanation: "Maps authentication interfaces that need MFA, brute-force throttling, and strict IP segmentation.",
    defensiveAdvice:
      "Require MFA, enforce lockout/rate limits, and isolate administrative authentication surfaces from public internet.",
  },
  "Directory listing": {
    pattern: 'site:%TARGET% intitle:"index of" ("parent directory"|"backup"|"uploads")',
    explanation: "Finds directory listing pages that may expose files, archives, or internal paths.",
    defensiveAdvice: "Disable directory indexing and apply access controls for upload and archive paths.",
  },
  "PDF/Docs discovery": {
    pattern: 'site:%TARGET% (ext:pdf OR ext:doc OR ext:docx OR ext:ppt OR ext:xls) ("internal" OR "confidential" OR "policy")',
    explanation:
      "Finds potentially sensitive documents exposed to search indexing that may disclose process, architecture, or identity data.",
    defensiveAdvice:
      "Use access controls for internal docs, redact sensitive data, and apply robots/meta controls for non-public assets.",
  },
};

const normalizeDomainLike = (input = "") =>
  String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const isValidPublicDomain = (value = "") => {
  const domain = normalizeDomainLike(value);
  if (!domain || domain.length > 253) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;
  if (!domain.includes(".")) return false;
  if (domain.startsWith("-") || domain.endsWith("-") || domain.startsWith(".") || domain.endsWith(".")) return false;
  return !isPrivateHost(domain);
};

export const getDorkTemplates = () =>
  Object.entries(DORK_TEMPLATES).map(([name, entry]) => ({
    name,
    template: entry.pattern,
    explanation: entry.explanation,
    defensiveAdvice: entry.defensiveAdvice,
  }));

export const runDorkBuilder = async (actor, { target, category }) => {
  const normalizedTarget = normalizeDomainLike(target);
  if (!isValidPublicDomain(normalizedTarget)) {
    const error = new Error("Invalid or private target domain");
    error.status = 400;
    throw error;
  }
  const template = DORK_TEMPLATES[category];
  if (!template) {
    const error = new Error("Unsupported dork category");
    error.status = 400;
    throw error;
  }
  const query = template.pattern.replace(/%TARGET%/g, normalizedTarget);
  const result = {
    query,
    explanation: template.explanation,
    category,
    target: normalizedTarget,
    defensiveAdvice: template.defensiveAdvice,
  };
  await recordTelemetryEvent(actor, {
    type: "tool_dork_generate",
    query: `${category} ${normalizedTarget}`,
    tool: "google-dork-intelligence",
    depth: 2,
    success: true,
    metadata: { category, target: normalizedTarget },
  });
  return result;
};

const bannedTerms = [/drop\s+table/i, /steal\s+credentials/i, /malware\s+delivery/i];

const moderateContent = (title = "", content = "") => {
  const text = `${title}\n${content}`;
  const blocked = bannedTerms.some((rule) => rule.test(text));
  return {
    blocked,
    reason: blocked ? "Potentially malicious content blocked by moderation policy." : "",
  };
};

export const createCommunityThread = async (actor, { title, content, roleTag = "Beginner" }) => {
  const moderation = moderateContent(title, content);
  if (moderation.blocked) {
    const error = new Error(moderation.reason);
    error.status = 400;
    throw error;
  }
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorKey: actor.key,
    userId: actor.userId,
    title: String(title).trim(),
    content: String(content).trim(),
    roleTag: ["Beginner", "Pentester", "Analyst"].includes(String(roleTag)) ? String(roleTag) : "Beginner",
    parentId: null,
    upvotes: 0,
    upvotedBy: [],
    replies: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const db = getDbSafe();
  if (db) await db.collection(COLLECTIONS.threads).insertOne(row);
  else MEMORY.threads.push(row);

  await recordTelemetryEvent(actor, {
    type: "community_thread_create",
    query: title,
    tool: "community",
    depth: 2,
    success: true,
  });
  return row;
};

export const createCommunityReply = async (actor, { parentId, content }) => {
  const text = String(content || "").trim();
  const moderation = moderateContent("", text);
  if (moderation.blocked) {
    const error = new Error(moderation.reason);
    error.status = 400;
    throw error;
  }
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorKey: actor.key,
    userId: actor.userId,
    title: "",
    content: text,
    parentId: String(parentId),
    upvotes: 0,
    upvotedBy: [],
    replies: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const db = getDbSafe();
  if (db) {
    await db.collection(COLLECTIONS.threads).insertOne(row);
    await db.collection(COLLECTIONS.threads).updateOne({ id: row.parentId }, { $inc: { replies: 1 }, $set: { updatedAt: Date.now() } });
  } else {
    MEMORY.threads.push(row);
    const idx = MEMORY.threads.findIndex((t) => t.id === row.parentId);
    if (idx >= 0) MEMORY.threads[idx].replies = Number(MEMORY.threads[idx].replies || 0) + 1;
  }
  await recordTelemetryEvent(actor, {
    type: "community_reply_create",
    query: parentId,
    tool: "community",
    depth: 2,
    success: true,
  });
  return row;
};

export const upvoteCommunityThread = async (actor, { threadId }) => {
  const db = getDbSafe();
  const voter = String(actor.key || "");
  if (db) {
    const current = await db.collection(COLLECTIONS.threads).findOne({ id: threadId });
    if (!current) {
      const error = new Error("Thread not found");
      error.status = 404;
      throw error;
    }
    const upvotedBy = Array.isArray(current.upvotedBy) ? current.upvotedBy : [];
    if (upvotedBy.includes(voter)) return { upvotes: Number(current.upvotes || 0), alreadyVoted: true };
    const upvotes = Number(current.upvotes || 0) + 1;
    await db.collection(COLLECTIONS.threads).updateOne({ id: threadId }, { $set: { upvotes, updatedAt: Date.now() }, $push: { upvotedBy: voter } });
    await recordTelemetryEvent(actor, { type: "community_upvote", query: threadId, tool: "community", depth: 1, success: true });
    return { upvotes, alreadyVoted: false };
  }
  const idx = MEMORY.threads.findIndex((t) => t.id === threadId);
  if (idx < 0) {
    const error = new Error("Thread not found");
    error.status = 404;
    throw error;
  }
  MEMORY.threads[idx].upvotedBy = Array.isArray(MEMORY.threads[idx].upvotedBy) ? MEMORY.threads[idx].upvotedBy : [];
  if (MEMORY.threads[idx].upvotedBy.includes(voter)) {
    return { upvotes: Number(MEMORY.threads[idx].upvotes || 0), alreadyVoted: true };
  }
  MEMORY.threads[idx].upvotedBy.push(voter);
  MEMORY.threads[idx].upvotes = Number(MEMORY.threads[idx].upvotes || 0) + 1;
  MEMORY.threads[idx].updatedAt = Date.now();
  await recordTelemetryEvent(actor, { type: "community_upvote", query: threadId, tool: "community", depth: 1, success: true });
  return { upvotes: Number(MEMORY.threads[idx].upvotes || 0), alreadyVoted: false };
};

export const listCommunityThreads = async ({ limit = 30, sort = "trending" } = {}) => {
  const db = getDbSafe();
  const sortFn = (a, b) => {
    if (sort === "new") return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    if (sort === "unanswered") {
      const aUn = Number(a.replies || 0) === 0 ? 1 : 0;
      const bUn = Number(b.replies || 0) === 0 ? 1 : 0;
      return bUn - aUn || Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
    }
    const aScore = Number(a.upvotes || 0) * 3 + Number(a.replies || 0) * 2 + Math.floor(Number(a.createdAt || 0) / 3_600_000);
    const bScore = Number(b.upvotes || 0) * 3 + Number(b.replies || 0) * 2 + Math.floor(Number(b.createdAt || 0) / 3_600_000);
    return bScore - aScore;
  };
  const toTree = (rows) => {
    const roots = rows.filter((r) => !r.parentId);
    return roots.map((root) => ({
      ...root,
      repliesList: rows.filter((r) => r.parentId === root.id).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0)),
    }));
  };
  if (db) {
    const rows = await db.collection(COLLECTIONS.threads).find({}).limit(600).toArray();
    return toTree(rows.sort(sortFn).slice(0, limit));
  }
  return toTree([...MEMORY.threads].sort(sortFn).slice(0, limit));
};

export const identifyHash = async (actor, hash) => {
  const raw = String(hash || "").trim();
  let algorithm = "unknown";
  let confidence = 0.3;
  let format = "unknown";
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(raw)) {
    algorithm = "bcrypt";
    confidence = 0.95;
    format = "modular-crypt";
  } else if (/^[a-f0-9]{64}$/i.test(raw) && /^[A-F0-9]+$/.test(raw)) {
    algorithm = "sha256";
    confidence = 0.91;
    format = "hex-upper";
  } else if (/^[a-f0-9]{128}$/i.test(raw)) {
    algorithm = "sha512";
    confidence = 0.92;
    format = "hex";
  } else if (/^[a-f0-9]{64}$/i.test(raw)) {
    algorithm = "sha256";
    confidence = 0.9;
    format = "hex";
  } else if (/^[a-f0-9]{40}$/i.test(raw)) {
    algorithm = "sha1";
    confidence = 0.82;
    format = "hex";
  } else if (/^[a-f0-9]{32}$/i.test(raw)) {
    algorithm = "md5";
    confidence = 0.8;
    format = "hex";
  }
  const bits = algorithm === "md5" ? 128 : algorithm === "sha1" ? 160 : algorithm === "sha256" ? 256 : algorithm === "sha512" ? 512 : 0;
  const hashLength = raw.length;
  const uniqueChars = new Set(raw.split("")).size;
  const approxEntropy = Number((Math.log2(Math.max(1, uniqueChars)) * hashLength).toFixed(2));
  await recordTelemetryEvent(actor, {
    type: "tool_hash_identify",
    query: algorithm,
    tool: "hash-identifier",
    depth: 1,
    success: algorithm !== "unknown",
    metadata: { confidence, bits, format, hashLength, approxEntropy },
  });
  return { algorithm, confidence, bits, format, hashLength, approxEntropy };
};

const humanizeSeconds = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 1) return "less than 1 second";
  const units = [
    ["year", 31_536_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  let remaining = Math.floor(seconds);
  const chunks = [];
  for (const [name, unit] of units) {
    if (remaining < unit || chunks.length >= 2) continue;
    const qty = Math.floor(remaining / unit);
    remaining -= qty * unit;
    chunks.push(`${qty} ${name}${qty === 1 ? "" : "s"}`);
  }
  return chunks.join(" ");
};

const charsetSize = (password = "") => {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 33;
  return pool;
};

export const analyzePasswordStrength = async (actor, password) => {
  const p = String(password || "");
  const length = p.length;
  let score = 0;
  if (p.length >= 12) score += 35;
  if (/[A-Z]/.test(p)) score += 15;
  if (/[a-z]/.test(p)) score += 12;
  if (/\d/.test(p)) score += 15;
  if (/[^A-Za-z0-9]/.test(p)) score += 18;
  if (!/(password|admin|1234|qwerty|letmein)/i.test(p)) score += 5;
  if (/(.)\1{2,}/.test(p)) score -= 14;
  if (/^(?:[a-z]+|[A-Z]+|\d+)$/.test(p)) score -= 8;
  score = Math.min(100, score);
  const level = score >= 86 ? "strong" : score >= 65 ? "good" : score >= 45 ? "medium" : "weak";
  const pool = Math.max(1, charsetSize(p));
  const entropy = Number((Math.log2(pool) * Math.max(0, length)).toFixed(2));
  const guesses = Math.max(1, 2 ** Math.min(80, entropy));
  const attackModels = {
    onlineRateLimited: 10,
    onlineUnthrottled: 1000,
    offlineFastHash: 10_000_000_000,
  };
  const crackEstimates = {
    onlineRateLimited: humanizeSeconds(guesses / attackModels.onlineRateLimited),
    onlineUnthrottled: humanizeSeconds(guesses / attackModels.onlineUnthrottled),
    offlineFastHash: humanizeSeconds(guesses / attackModels.offlineFastHash),
  };
  const recommendations = [
    length < 12 ? "Use at least 12 characters." : null,
    /[A-Z]/.test(p) ? null : "Add uppercase letters.",
    /[a-z]/.test(p) ? null : "Add lowercase letters.",
    /\d/.test(p) ? null : "Add numbers.",
    /[^A-Za-z0-9]/.test(p) ? null : "Add symbols.",
    /(password|admin|1234|qwerty|letmein)/i.test(p) ? "Avoid common password patterns and dictionary words." : null,
    /(.)\1{2,}/.test(p) ? "Avoid repeated character runs like 'aaa' or '111'." : null,
  ].filter(Boolean);
  await recordTelemetryEvent(actor, {
    type: "tool_password_strength",
    query: level,
    tool: "password-strength-analyzer",
    depth: Math.ceil(score / 25),
    success: true,
    metadata: { score, entropy, length },
  });
  return { score, level, entropy, crackEstimates, recommendations };
};

const parseHeaderLines = (rawHeaders = "") => {
  const lines = String(rawHeaders || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerMap = new Map();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!headerMap.has(key)) headerMap.set(key, []);
    headerMap.get(key).push(value);
  }
  return headerMap;
};

const buildHeaderFindings = (rawHeaders = "") => {
  const headers = parseHeaderLines(rawHeaders);
  const has = (name) => headers.has(name);
  const valueOf = (name) => String((headers.get(name) || []).join("; "));
  const findings = [
    { key: "content-security-policy", ok: has("content-security-policy"), severity: "high" },
    { key: "strict-transport-security", ok: has("strict-transport-security"), severity: "high" },
    { key: "x-frame-options", ok: has("x-frame-options"), severity: "medium" },
    { key: "x-content-type-options", ok: has("x-content-type-options"), severity: "medium" },
    { key: "referrer-policy", ok: has("referrer-policy"), severity: "low" },
    { key: "permissions-policy", ok: has("permissions-policy"), severity: "medium" },
  ];
  const csp = valueOf("content-security-policy");
  const issues = [];
  if (csp && /unsafe-inline|unsafe-eval/.test(csp)) {
    issues.push("CSP includes unsafe directives (`unsafe-inline` or `unsafe-eval`).");
  }
  const xfo = valueOf("x-frame-options").toLowerCase();
  if (xfo && !/(deny|sameorigin)/.test(xfo)) {
    issues.push("`X-Frame-Options` is present but not using `DENY` or `SAMEORIGIN`.");
  }
  const hsts = valueOf("strict-transport-security").toLowerCase();
  if (hsts && !/max-age=\d{5,}/.test(hsts)) {
    issues.push("`Strict-Transport-Security` max-age appears too low.");
  }

  const risk = findings.reduce((acc, f) => acc + (f.ok ? 0 : f.severity === "high" ? 24 : f.severity === "medium" ? 12 : 7), 0);
  const issuePenalty = issues.length * 8;
  const riskScore = Math.min(100, risk + issuePenalty);
  const missing = findings.filter((item) => !item.ok).map((item) => item.key);
  const recommendations = [
    missing.includes("content-security-policy")
      ? "Add a strict `Content-Security-Policy` to reduce XSS and script injection risk."
      : null,
    missing.includes("strict-transport-security")
      ? "Enable `Strict-Transport-Security` with long max-age and includeSubDomains."
      : null,
    missing.includes("x-frame-options")
      ? "Set `X-Frame-Options: DENY` (or `SAMEORIGIN`) to mitigate clickjacking."
      : null,
    missing.includes("x-content-type-options")
      ? "Set `X-Content-Type-Options: nosniff` to prevent MIME sniffing attacks."
      : null,
    missing.includes("referrer-policy") ? "Add a restrictive `Referrer-Policy` to reduce URL data leakage." : null,
    missing.includes("permissions-policy") ? "Define `Permissions-Policy` to disable unnecessary browser capabilities." : null,
    ...issues,
  ].filter(Boolean);
  const headerExplanations = {
    "content-security-policy": "Restricts script/content sources to reduce XSS and injection impact.",
    "strict-transport-security": "Forces browsers to use HTTPS and prevents protocol downgrade.",
    "x-frame-options": "Controls framing to reduce clickjacking attacks.",
    "x-content-type-options": "Prevents MIME sniffing and content-type confusion.",
    "referrer-policy": "Limits URL referrer leakage across origins.",
    "permissions-policy": "Restricts powerful browser APIs (camera, mic, geolocation, etc.).",
  };
  const rating = riskScore <= 15 ? "A" : riskScore <= 35 ? "B" : riskScore <= 55 ? "C" : riskScore <= 75 ? "D" : "F";
  return {
    findings,
    riskScore,
    missing,
    recommendations,
    server: valueOf("server") || "unknown",
    contentType: valueOf("content-type") || "unknown",
    securityHeaders: findings.map((item) => ({
      name: item.key,
      present: item.ok,
      severity: item.severity,
      explanation: headerExplanations[item.key] || "Security header guidance.",
    })),
    rating,
  };
};

export const analyzeHeaders = async (actor, headersRaw) => {
  const result = buildHeaderFindings(headersRaw);
  await recordTelemetryEvent(actor, {
    type: "tool_header_analyze",
    query: `risk:${result.riskScore}`,
    tool: "http-header-analyzer",
    depth: Math.ceil(result.riskScore / 25),
    success: true,
    metadata: { missing: result.findings.filter((f) => !f.ok).map((f) => f.key) },
  });
  return result;
};

const isPrivateHost = (hostname) => {
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
  if (kind === 6) {
    if (host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return true;
  }
  return false;
};

export const analyzeHeadersFromUrl = async (actor, targetUrl) => {
  let parsed;
  try {
    parsed = new URL(String(targetUrl || ""));
  } catch {
    const error = new Error("Invalid URL format");
    error.status = 400;
    error.code = "invalid_url";
    throw error;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("Only HTTP/HTTPS URLs are allowed");
    error.status = 400;
    error.code = "unsupported_scheme";
    throw error;
  }
  if (isPrivateHost(parsed.hostname)) {
    const error = new Error("Private or local targets are blocked");
    error.status = 400;
    error.code = "private_target_blocked";
    throw error;
  }
  try {
    let response;
    const attempt = await fetchWithTiming(parsed.toString(), { method: "HEAD", redirect: "manual" });
    response = attempt.response;
    if (response.status === 405 || response.status === 501) {
      response = (await fetchWithTiming(parsed.toString(), { method: "GET", redirect: "manual" })).response;
    }
    const headerText = [...response.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    const analyzed = buildHeaderFindings(headerText);
    await recordTelemetryEvent(actor, {
      type: "tool_header_analyze_url",
      query: parsed.hostname,
      tool: "http-header-analyzer",
      depth: Math.ceil(analyzed.riskScore / 25),
      success: true,
      metadata: {
        statusCode: response.status,
        missing: analyzed.findings.filter((f) => !f.ok).map((f) => f.key),
      },
    });
    return {
      url: parsed.toString(),
      statusCode: response.status,
      findings: analyzed.findings,
      riskScore: analyzed.riskScore,
      missing: analyzed.missing,
      recommendations: analyzed.recommendations,
      headers: headerText,
    };
  } catch (fetchError) {
    const message = String(fetchError?.message || "").toLowerCase();
    const aborted = String(fetchError?.name || "").toLowerCase() === "aborterror" || message.includes("timeout");
    const error = new Error(aborted ? "Header fetch timed out" : "Failed to fetch headers from target");
    error.status = aborted ? 504 : 502;
    error.code = aborted ? "upstream_timeout" : "upstream_fetch_failed";
    error.details = { host: parsed.hostname };
    throw error;
  }
};

export const analyzeMetadata = async (actor, input) => {
  const raw = String(input || "").trim();
  const parts = raw.split("/");
  const filename = parts[parts.length - 1] || raw;
  const ext = filename.includes(".") ? filename.split(".").pop().toLowerCase() : "unknown";
  const hasPIIHint = /(aadhaar|ssn|passport|employee|payroll|invoice|customer|dob)/i.test(filename);
  const hasInternalHint = /(internal|confidential|private|secret|restricted)/i.test(filename);
  const hasVersionTag = /(?:^|[-_])v\d+(?:[-_.]|$)/i.test(filename);
  const hasDateStamp = /\b(20\d{2}[-_ ]?(0[1-9]|1[0-2])[-_ ]?([0-2]\d|3[01]))\b/.test(filename);
  const privacyRisks = [
    hasPIIHint ? "Filename hints potential sensitive personal/business data." : null,
    hasInternalHint ? "Filename classification suggests internal-only information." : null,
    hasDateStamp ? "Date stamp in filename may reveal operational timelines." : null,
  ].filter(Boolean);
  const result = {
    filename,
    extension: ext,
    fileType: ext,
    length: filename.length,
    size: filename.length,
    createdDate: hasDateStamp ? filename.match(/\b(20\d{2}[-_ ]?(0[1-9]|1[0-2])[-_ ]?([0-2]\d|3[01]))\b/i)?.[1] || null : null,
    metadataTags: [ext, hasVersionTag ? "versioned-file" : null, hasInternalHint ? "internal-classification" : null].filter(Boolean),
    hasVersionTag,
    hasDateStamp,
    hasSensitiveHint: /(final|backup|confidential|internal|secret)/i.test(filename),
    hasPIIHint,
    hasInternalHint,
    privacyRisks,
    defensiveAdvice: [
      "Use neutral file naming; avoid embedding user/customer identifiers.",
      "Apply document labels and access controls before sharing files externally.",
      "Strip metadata before publication and archive original securely.",
    ],
  };
  await recordTelemetryEvent(actor, {
    type: "tool_metadata_analyze",
    query: ext,
    tool: "metadata-viewer",
    depth: 1,
    success: true,
    metadata: result,
  });
  return result;
};

const inferMimeFromMagic = (buffer) => {
  const hex = buffer.slice(0, 12).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("25504446")) return "application/pdf";
  if (hex.startsWith("504b0304")) return "application/zip";
  return "application/octet-stream";
};

const readPdfInfoTags = (buffer) => {
  const text = buffer.toString("latin1");
  const tags = [];
  const mappings = [
    ["/Author", "author"],
    ["/Creator", "creator"],
    ["/Producer", "producer"],
    ["/Title", "title"],
    ["/CreationDate", "creation-date"],
    ["/ModDate", "modified-date"],
  ];
  for (const [needle, label] of mappings) {
    if (text.includes(needle)) tags.push(label);
  }
  return [...new Set(tags)];
};

const readPngTextTags = (buffer) => {
  const tags = [];
  let offset = 8;
  while (offset + 8 < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("ascii");
    if (["tEXt", "zTXt", "iTXt", "tIME"].includes(type)) tags.push(type);
    offset += 12 + length;
    if (offset > buffer.length) break;
  }
  return [...new Set(tags)];
};

const readImageDimensions = (buffer, mime) => {
  if (mime === "image/png" && buffer.length >= 24) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const size = buffer.readUInt16BE(offset + 2);
      if (size < 2) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      offset += size + 2;
    }
  }
  return null;
};

export const analyzeMetadataFile = async (actor, payload) => {
  const filename = String(payload?.filename || "");
  const mimeType = String(payload?.mimeType || "");
  const size = Number(payload?.size || 0);
  const base64 = String(payload?.base64 || "");
  const buffer = Buffer.from(base64, "base64");
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const inferredMime = inferMimeFromMagic(buffer);
  const dimensions = readImageDimensions(buffer, inferredMime);
  const metadataTags = [
    ...(inferredMime === "application/pdf" ? readPdfInfoTags(buffer) : []),
    ...(inferredMime === "image/png" ? readPngTextTags(buffer) : []),
  ];
  const createdDate =
    inferredMime === "application/pdf" && buffer.toString("latin1").match(/\/CreationDate\s*\(([^)]+)\)/)?.[1]
      ? buffer.toString("latin1").match(/\/CreationDate\s*\(([^)]+)\)/)?.[1] || null
      : null;
  const mimeMismatch = mimeType && mimeType !== "application/octet-stream" && inferredMime !== "application/octet-stream" && mimeType !== inferredMime;
  const privacyRisks = [
    /(passport|invoice|salary|customer|employee|internal|secret)/i.test(filename)
      ? "Filename suggests potentially sensitive business data."
      : null,
    mimeMismatch ? "Declared MIME does not match detected file signature." : null,
    dimensions && dimensions.width > 3000 ? "High-resolution image may contain hidden visual details." : null,
  ].filter(Boolean);
  const result = {
    filename,
    mimeType,
    inferredMime,
    fileType: inferredMime,
    size,
    bytesParsed: buffer.length,
    sha256,
    createdDate,
    metadataTags,
    extension: filename.includes(".") ? filename.split(".").pop().toLowerCase() : "unknown",
    dimensions: dimensions || null,
    privacyRisks,
    defensiveAdvice: [
      "Validate file type on upload using signature checks, not extension only.",
      "Sanitize and strip metadata before distributing files externally.",
      "Store uploads in isolated object storage with strict access policies.",
    ],
  };
  await recordTelemetryEvent(actor, {
    type: "tool_metadata_file_analyze",
    query: result.extension,
    tool: "metadata-viewer",
    depth: 1,
    success: true,
    metadata: { mimeType, inferredMime, size },
  });
  return result;
};

export const simulateSubdomainRecon = async (actor, target) => {
  const host = normalizeDomainLike(target);
  await recordTelemetryEvent(actor, {
    type: "tool_subdomain_sim",
    query: host,
    tool: "subdomain-recon-disabled",
    depth: 1,
    success: false,
    metadata: { reason: "no_verified_data" },
  });
  return {
    target: host,
    verified: false,
    subdomains: [],
    methodology: "No verified data.",
    defensiveAdvice: ["Use verified DNS, certificate transparency, and live website scan evidence only."],
  };
};

const SCAN_TIMEOUT_MS = 2800;
const MAX_BODY_BYTES = 180_000;
const DNS_FALLBACK_TIMEOUT_MS = 1600;
const MAX_REDIRECTS = 4;

const fetchDnsJson = async (hostname, type) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DNS_FALLBACK_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=${encodeURIComponent(type)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/dns-json",
          "User-Agent": "Zorvix-WebScanner/1.0",
        },
      }
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.Answer) ? payload.Answer.map((item) => String(item?.data || "")).filter(Boolean) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};

const resolveHostAddresses = async (hostname) => {
  if (net.isIP(hostname)) {
    return {
      ipv4: net.isIP(hostname) === 4 ? [hostname] : [],
      ipv6: net.isIP(hostname) === 6 ? [hostname] : [],
    };
  }

  const [ipv4, ipv6] = await Promise.all([
    (async () => {
      try {
        const results = await dns.lookup(hostname, { family: 4, all: true });
        return results.map((entry) => entry.address).filter(Boolean);
      } catch {
        return await fetchDnsJson(hostname, "A");
      }
    })(),
    (async () => {
      try {
        const results = await dns.lookup(hostname, { family: 6, all: true });
        return results.map((entry) => entry.address).filter(Boolean);
      } catch {
        return await fetchDnsJson(hostname, "AAAA");
      }
    })(),
  ]);

  return { ipv4, ipv6 };
};

const resolveCnameRecordsForScan = async (hostname) => {
  try {
    return await dns.resolveCname(hostname);
  } catch {
    const values = await fetchDnsJson(hostname, "CNAME");
    return values.map((value) => String(value).replace(/\.$/, ""));
  }
};

const createLookupResolver = (hostname) => {
  let cachedResolution = null;
  return async (_requestedHostname, options, callback) => {
    try {
      if (!cachedResolution) cachedResolution = resolveHostAddresses(hostname);
      const resolved = await cachedResolution;
      const family = Number(options?.family || 0);
      const pool =
        family === 6
          ? resolved.ipv6
          : family === 4
            ? resolved.ipv4
            : [...resolved.ipv4, ...resolved.ipv6];
      const address = pool.find(Boolean);
      if (!address) {
        const error = new Error(`dns_resolution_failed:${hostname}`);
        error.code = "DNS_RESOLUTION_FAILED";
        callback(error);
        return;
      }
      callback(null, address, net.isIP(address) || 4);
    } catch (error) {
      callback(error);
    }
  };
};

const createResponseHeaders = (headers = {}) => {
  const entries = Object.entries(headers).map(([key, value]) => [
    String(key || "").toLowerCase(),
    Array.isArray(value) ? value.join(", ") : String(value ?? ""),
  ]);
  const map = new Map(entries);
  return {
    get(name) {
      return map.get(String(name || "").toLowerCase()) || null;
    },
    entries() {
      return map.entries();
    },
  };
};

const requestWithResolvedDns = async (inputUrl, { method = "GET", redirect = "follow", timeoutMs = SCAN_TIMEOUT_MS } = {}) => {
  const started = Date.now();
  let currentUrl = new URL(inputUrl);
  let redirectCount = 0;

  while (true) {
    const transport = currentUrl.protocol === "https:" ? https : http;
    const lookup = createLookupResolver(currentUrl.hostname);
    const response = await new Promise((resolve, reject) => {
      const request = transport.request(
        currentUrl,
        {
          method,
          lookup,
          servername: currentUrl.hostname,
          headers: {
            Host: currentUrl.host,
            "User-Agent": "Zorvix-WebScanner/1.0",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        },
        (res) => {
          const chunks = [];
          let total = 0;
          res.on("data", (chunk) => {
            if (method === "HEAD" || total >= MAX_BODY_BYTES) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            const remaining = MAX_BODY_BYTES - total;
            if (remaining <= 0) return;
            const slice = buffer.length > remaining ? buffer.subarray(0, remaining) : buffer;
            total += slice.length;
            chunks.push(slice);
          });
          res.on("end", () => {
            resolve({
              status: Number(res.statusCode || 0),
              ok: Number(res.statusCode || 0) >= 200 && Number(res.statusCode || 0) < 300,
              headers: createResponseHeaders(res.headers),
              text: method === "HEAD" ? "" : Buffer.concat(chunks).toString("utf8"),
              url: currentUrl.toString(),
            });
          });
          res.on("error", reject);
        }
      );
      request.setTimeout(timeoutMs, () => request.destroy(new Error("request_timeout")));
      request.on("error", reject);
      request.end();
    });

    const location = response.headers.get("location");
    const shouldFollow =
      redirect === "follow" && response.status >= 300 && response.status < 400 && Boolean(location);
    if (!shouldFollow) {
      return { response, timingMs: Date.now() - started };
    }
    if (redirectCount >= MAX_REDIRECTS) {
      const error = new Error("redirect_limit_exceeded");
      error.code = "redirect_limit_exceeded";
      throw error;
    }
    currentUrl = new URL(location, currentUrl);
    redirectCount += 1;
  }
};

const normalizeScanTarget = (input = "") => {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
};

const isPrivateIp = (value = "") => {
  const ip = String(value || "");
  const kind = net.isIP(ip);
  if (kind === 4) {
    if (/^(10|127)\./.test(ip)) return true;
    if (/^169\.254\./.test(ip)) return true;
    if (/^192\.168\./.test(ip)) return true;
    const parts = ip.split(".").map((p) => Number(p));
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (kind === 6) {
    if (ip === "::1") return true;
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  }
  return false;
};

const isPrivateHostTarget = async (hostname) => {
  const host = String(hostname || "").toLowerCase();
  if (!host) return true;
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (host.endsWith(".local")) return true;
  if (net.isIP(host)) return isPrivateIp(host);
  try {
    const [aRecords, aaaaRecords] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    const ips = [
      ...(aRecords.status === "fulfilled" ? aRecords.value : []),
      ...(aaaaRecords.status === "fulfilled" ? aaaaRecords.value : []),
    ];
    if (!ips.length) return false;
    return ips.every((ip) => isPrivateIp(ip));
  } catch {
    return false;
  }
};

const fetchWithTiming = async (url, { method = "GET", redirect = "follow" } = {}) => {
  return requestWithResolvedDns(url, { method, redirect, timeoutMs: SCAN_TIMEOUT_MS });
};

const readLimitedText = async (response) => {
  if (!response) return "";
  if (typeof response.text === "string") return response.text;
  if (!response?.body) return "";
  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const remaining = MAX_BODY_BYTES - total;
    if (remaining <= 0) {
      await reader.cancel();
      break;
    }
    const slice = value.length > remaining ? value.slice(0, remaining) : value;
    total += slice.length;
    text += decoder.decode(slice, { stream: true });
    if (total >= MAX_BODY_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return text;
};

const extractTechnologies = (headers, html = "") => {
  const detected = new Set();
  const server = String(headers.get("server") || "").toLowerCase();
  const poweredBy = String(headers.get("x-powered-by") || "").toLowerCase();
  if (server.includes("nginx")) detected.add("Nginx");
  if (server.includes("apache")) detected.add("Apache");
  if (server.includes("cloudflare")) detected.add("Cloudflare");
  if (server.includes("cloudfront")) detected.add("CloudFront");
  if (server.includes("iis")) detected.add("Microsoft IIS");
  if (server.includes("openresty")) detected.add("OpenResty");
  if (poweredBy.includes("express")) detected.add("Node/Express");
  if (poweredBy.includes("php")) detected.add("PHP");
  if (poweredBy.includes("laravel")) detected.add("Laravel");
  if (poweredBy.includes("django")) detected.add("Django");
  if (poweredBy.includes("asp.net")) detected.add("ASP.NET");

  const htmlLower = String(html || "").toLowerCase();
  if (htmlLower.includes("wp-content") || htmlLower.includes("wp-includes")) detected.add("WordPress");
  if (htmlLower.includes("__next_data__")) detected.add("Next.js");
  if (htmlLower.includes("__nuxt__")) detected.add("Nuxt.js");
  if (htmlLower.includes("drupal.settings") || htmlLower.includes("data-drupal")) detected.add("Drupal");
  if (htmlLower.includes("content=\"shopify\"")) detected.add("Shopify");

  return [...detected];
};

const scanCommonPorts = async (hostname) => {
  const resolved = await resolveHostAddresses(hostname);
  const targetAddress = resolved.ipv4[0] || resolved.ipv6[0] || hostname;
  const ports = [80, 443, 22, 3306, 8080];
  const checkPort = (port) =>
    new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;
      const finish = (status) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve({ port, status });
      };
      socket.setTimeout(700);
      socket.once("connect", () => finish("open"));
      socket.once("timeout", () => finish("filtered"));
      socket.once("error", () => finish("closed"));
      socket.connect(port, targetAddress);
    });
  const results = await Promise.all(ports.map((port) => checkPort(port)));
  return results;
};

const readTlsInfo = async (hostname) => {
  const resolved = await resolveHostAddresses(hostname);
  const targetAddress = resolved.ipv4[0] || resolved.ipv6[0] || hostname;
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: targetAddress,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 6000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const validFrom = cert?.valid_from || null;
        const validTo = cert?.valid_to || null;
        const validToMs = validTo ? new Date(validTo).getTime() : 0;
        const daysRemaining = validToMs ? Math.ceil((validToMs - Date.now()) / 86400000) : null;
        const subject = cert?.subject ? Object.values(cert.subject).join(", ") : null;
        const issuer = cert?.issuer ? Object.values(cert.issuer).join(", ") : null;
        const selfSigned = subject && issuer ? subject === issuer : false;
        resolve({
          enabled: !!cert && Object.keys(cert).length > 0,
          authorized: socket.authorized || false,
          authorizationError: socket.authorizationError || null,
          validFrom,
          validTo,
          daysRemaining,
          subject,
          issuer,
          selfSigned,
        });
        socket.end();
      }
    );
    socket.on("error", () =>
      resolve({
        enabled: false,
        authorized: false,
        authorizationError: "tls_connection_failed",
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        subject: null,
        issuer: null,
        selfSigned: null,
      })
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        enabled: false,
        authorized: false,
        authorizationError: "tls_timeout",
        validFrom: null,
        validTo: null,
        daysRemaining: null,
        subject: null,
        issuer: null,
        selfSigned: null,
      });
    });
  });
};

const parseRedirectToHttps = (status, location, hostname) => {
  if (!status || status < 300 || status >= 400) return false;
  if (!location) return false;
  try {
    const target = new URL(location, `http://${hostname}`);
    return target.protocol === "https:";
  } catch {
    return false;
  }
};

export const runWebSecurityScan = async (actor, input) => {
  const url = normalizeScanTarget(input);
  if (!url) {
    const error = new Error("Please provide a valid http or https URL.");
    error.status = 400;
    error.code = "invalid_url";
    throw error;
  }
  if (await isPrivateHostTarget(url.hostname)) {
    const error = new Error("Private or local targets are blocked.");
    error.status = 400;
    error.code = "private_target_blocked";
    throw error;
  }

  const httpUrl = new URL(url.toString());
  httpUrl.protocol = "http:";
  const httpsUrl = new URL(url.toString());
  httpsUrl.protocol = "https:";

  const httpPromise = (async () => {
    try {
      const attempt = await fetchWithTiming(httpUrl.toString(), { method: "HEAD", redirect: "manual" });
      if (attempt.response.status === 405 || attempt.response.status === 501) {
        return await fetchWithTiming(httpUrl.toString(), { method: "GET", redirect: "manual" });
      }
      return attempt;
    } catch (error) {
      return { error };
    }
  })();

  const httpsPromise = (async () => {
    try {
      return await fetchWithTiming(httpsUrl.toString(), { method: "GET", redirect: "follow" });
    } catch (error) {
      return { error };
    }
  })();

  const tlsPromise = readTlsInfo(url.hostname);

  const dnsPromise = Promise.allSettled([
    resolveHostAddresses(url.hostname).then((result) => result.ipv4),
    resolveHostAddresses(url.hostname).then((result) => result.ipv6),
    resolveCnameRecordsForScan(url.hostname),
  ]);

  const [httpResult, httpsResult, tlsInfo, dnsRecords] = await Promise.all([httpPromise, httpsPromise, tlsPromise, dnsPromise]);

  const httpsError = httpsResult?.error || null;
  const htmlSnippet = httpsResult?.response ? await readLimitedText(httpsResult.response) : "";

  const httpRedirectsToHttps = httpResult?.response
    ? parseRedirectToHttps(
        httpResult.response.status,
        httpResult.response.headers.get("location"),
        url.hostname
      )
    : false;
  const httpsOk = Boolean(httpsResult?.response && httpsResult.response.ok);
  const hsts = httpsResult?.response?.headers?.get("strict-transport-security") || "";

  const headers = httpsResult?.response?.headers;
  const serverHeader = headers?.get("server") || "";
  const poweredBy = headers?.get("x-powered-by") || "";
  const contentType = headers?.get("content-type") || "";
  const contentLength = headers?.get("content-length") || "";
  const technologies = headers ? extractTechnologies(headers, htmlSnippet) : [];
  const missingHeaders = [
    !headers?.get("content-security-policy") ? "Content-Security-Policy" : null,
    !headers?.get("strict-transport-security") ? "Strict-Transport-Security" : null,
    !headers?.get("x-frame-options") ? "X-Frame-Options" : null,
    !headers?.get("x-content-type-options") ? "X-Content-Type-Options" : null,
    !headers?.get("referrer-policy") ? "Referrer-Policy" : null,
    !headers?.get("permissions-policy") ? "Permissions-Policy" : null,
  ].filter(Boolean);

  const openPorts = await scanCommonPorts(url.hostname);
  let riskScore = 100;
  if (!httpsOk) riskScore -= 20;
  if (!httpRedirectsToHttps && url.protocol === "http:") riskScore -= 10;
  if (tlsInfo.enabled && !tlsInfo.authorized) riskScore -= 15;
  riskScore -= Math.min(30, missingHeaders.length * 5);
  if (openPorts.some((p) => p.port === 22 && p.status === "open")) riskScore -= 5;
  if (openPorts.some((p) => p.port === 3306 && p.status === "open")) riskScore -= 10;
  riskScore = Math.max(0, Math.min(100, riskScore));
  const riskLevel = riskScore >= 75 ? "low" : riskScore >= 55 ? "medium" : "high";

  const [aRecords, aaaaRecords, cnameRecords] = dnsRecords;

  const ipv4 = aRecords.status === "fulfilled" ? aRecords.value : [];
  const ipv6 = aaaaRecords.status === "fulfilled" ? aaaaRecords.value : [];
  const cname = cnameRecords.status === "fulfilled" ? cnameRecords.value : [];

  const result = {
    target: {
      input: String(input || ""),
      normalizedUrl: httpsUrl.toString(),
      hostname: url.hostname,
      protocol: url.protocol.replace(":", ""),
      isIp: net.isIP(url.hostname) > 0,
    },
    responseTimeMs: httpsResult?.timingMs || httpResult?.timingMs || null,
    httpResponseTimeMs: httpResult?.timingMs || null,
    httpStatus: httpResult?.response?.status || null,
    httpsStatus: httpsResult?.response?.status || null,
    httpsEnforced: httpRedirectsToHttps || (url.protocol === "https:" && httpsOk),
    redirectTarget: httpResult?.response?.headers?.get("location") || null,
    ssl: tlsInfo,
    sslStatus: tlsInfo.enabled ? (tlsInfo.authorized ? "valid" : "warning") : "missing",
    headers: {
      server: serverHeader || "unknown",
      poweredBy: poweredBy || "unknown",
      contentType: contentType || "unknown",
      contentLength: contentLength || "unknown",
      hsts: hsts || null,
      csp: headers?.get("content-security-policy") || null,
      xFrameOptions: headers?.get("x-frame-options") || null,
      xContentTypeOptions: headers?.get("x-content-type-options") || null,
      referrerPolicy: headers?.get("referrer-policy") || null,
      permissionsPolicy: headers?.get("permissions-policy") || null,
    },
    missingHeaders,
    domain: {
      hostname: url.hostname,
      ipv4,
      ipv6,
      cname,
    },
    openPorts,
    technologies,
    riskScore,
    riskLevel,
    notes: httpsError
      ? "HTTPS request failed; check connectivity, certificate, or server availability."
      : null,
  };

  Promise.resolve(
    recordTelemetryEvent(actor, {
      type: "tool_webscan",
      query: url.hostname,
      tool: "web-security-scanner",
      depth: 2,
      success: !!httpsResult?.response,
      metadata: {
        httpsStatus: result.httpsStatus,
        sslStatus: result.sslStatus,
        httpsEnforced: result.httpsEnforced,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
      },
    })
  ).catch(() => undefined);

  return result;
};
