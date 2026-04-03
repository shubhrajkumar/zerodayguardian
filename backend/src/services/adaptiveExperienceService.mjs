import mongoose from "mongoose";
import { getDb } from "../config/db.mjs";
import { getUserMemorySnapshot, getSecurityEvents } from "../../services/memory-service/memoryService.mjs";
import { buildBehavioralLoop } from "./behavioralLoopEngine.mjs";
import { getAdaptiveAiSynthesis } from "./adaptiveAiSynthesisService.mjs";

const MEMORY = {
  events: new Map(),
};

const COLLECTION = "adaptive_events";
const now = () => Date.now();
const normalize = (value = "", max = 160) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const intentWeights = {
  osint: 1.2,
  web_scan: 1.15,
  threat_detection: 1.1,
  headers: 1,
  news: 0.7,
  chat: 0.85,
  sharing: 0.55,
  platform: 0.45,
};

const eventIntentMap = {
  dashboard_visit: "monitoring",
  osint_lookup: "investigation",
  osint_lookup_start: "investigation",
  scan_run: "hardening",
  website_scan_start: "hardening",
  threat_detect: "threat_hunting",
  threat_detect_start: "threat_hunting",
  news_refresh: "intel_monitoring",
  share_result: "communication",
  scan_share: "communication",
  osint_share: "communication",
  mentor_open: "guided_learning",
  chat_open: "guided_learning",
  adaptive_action: "guided_learning",
  learn_track_started: "guided_learning",
  learn_track_completed: "guided_learning",
  history_filter: "review",
};

const interestCatalog = [
  {
    id: "osint_intel",
    label: "OSINT Intel",
    match: (event) =>
      /(osint|domain|whois|dns|mx|reverse-dns|intel)/i.test(
        `${event.type || ""} ${event.surface || ""} ${event.target || ""} ${JSON.stringify(event.metadata || {})}`
      ),
  },
  {
    id: "web_hardening",
    label: "Web Hardening",
    match: (event) =>
      /(scan|headers|tls|https|csp|security-score|webscan)/i.test(
        `${event.type || ""} ${event.surface || ""} ${event.target || ""} ${JSON.stringify(event.metadata || {})}`
      ),
  },
  {
    id: "threat_hunting",
    label: "Threat Hunting",
    match: (event) =>
      /(threat|anomaly|hunt|telemetry|alert|risk)/i.test(
        `${event.type || ""} ${event.surface || ""} ${event.target || ""} ${JSON.stringify(event.metadata || {})}`
      ),
  },
  {
    id: "guided_learning",
    label: "Guided Learning",
    match: (event) =>
      /(mentor|learn|lab|mission|track|zorvix)/i.test(
        `${event.type || ""} ${event.surface || ""} ${event.target || ""} ${JSON.stringify(event.metadata || {})}`
      ),
  },
  {
    id: "intel_monitoring",
    label: "Intel Monitoring",
    match: (event) =>
      /(news|feed|advisory|cve|notification)/i.test(
        `${event.type || ""} ${event.surface || ""} ${event.target || ""} ${JSON.stringify(event.metadata || {})}`
      ),
  },
];

const buildUserId = (userId) => {
  if (!userId) return null;
  return mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : String(userId);
};

const actorKey = (userId) => String(userId || "anon");

const safeEvent = (event = {}) => ({
  type: String(event.type || "unknown").trim().slice(0, 64),
  surface: String(event.surface || "dashboard").trim().slice(0, 64),
  target: String(event.target || "").trim().slice(0, 160),
  metadata: typeof event.metadata === "object" && event.metadata ? event.metadata : {},
  createdAt: Number(event.createdAt || now()) || now(),
});

const listMemoryEvents = (userId) => {
  return (MEMORY.events.get(actorKey(userId)) || []).slice(-120);
};

const saveMemoryEvent = (userId, event) => {
  const key = actorKey(userId);
  const existing = MEMORY.events.get(key) || [];
  MEMORY.events.set(key, [...existing, event].slice(-120));
};

const getDbSafe = () => {
  try {
    return getDb();
  } catch {
    return null;
  }
};

const normalizeUserRole = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["admin", "analyst", "premium", "mentor"].includes(normalized)) return normalized;
  return "learner";
};

const userMatchers = (userId) => {
  const objectId = buildUserId(userId);
  const raw = String(userId || "");
  return [{ userId: objectId }, { userId: raw }, { ownerId: raw }, { ownerId: objectId }].filter(
    (value, index, list) => JSON.stringify(value) === JSON.stringify(list[index])
  );
};

const dominantIntentsFromEvents = (events = []) => {
  const scores = new Map();
  events.forEach((event) => {
    const intent = eventIntentMap[String(event.type || "").trim()] || String(event.surface || "monitoring");
    const weight = Number(intentWeights[String(event.surface || "").trim()] || 0.4);
    scores.set(intent, (scores.get(intent) || 0) + weight);
  });
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([intent, score]) => ({ intent, score: Number(score.toFixed(2)) }));
};

const inferInterestSignals = (events = [], osintRows = [], memory = null) => {
  const scores = new Map();
  events.forEach((event, index) => {
    const recencyWeight = Math.max(0.45, 1 - index * 0.03);
    interestCatalog.forEach((interest) => {
      if (interest.match(event)) {
        scores.set(interest.label, (scores.get(interest.label) || 0) + recencyWeight);
      }
    });
  });

  if (osintRows.length) {
    scores.set("OSINT Intel", (scores.get("OSINT Intel") || 0) + Math.min(3, osintRows.length * 0.45));
  }
  if (String(memory?.learning?.track || "").trim()) {
    scores.set("Guided Learning", (scores.get("Guided Learning") || 0) + 1.2);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label]) => label);
};

const inferLearningPattern = ({ events = [], dominantIntents = [], memory = null }) => {
  const recentGuided = events.filter((event) => /mentor|learn|lab|adaptive/i.test(`${event.type || ""} ${event.surface || ""}`)).length;
  const actionDiversity = new Set(events.map((event) => `${event.surface}:${event.type}`)).size;
  const cadence =
    events.length >= 14 ? "high-frequency" : events.length >= 7 ? "consistent" : events.length >= 3 ? "building" : "early-stage";
  const sessionStyle =
    recentGuided >= 3
      ? "guided"
      : dominantIntents[0]?.intent === "investigation"
        ? "deep-dive"
        : actionDiversity >= 6
          ? "exploratory"
          : "focused";
  const recommendationStyle =
    String(memory?.preferences?.assistantProfile?.tone || "").trim() === "friendly"
      ? "coach-like"
      : recentGuided >= 2
        ? "step-by-step"
        : "operator-brief";
  const preferredSurfaces = [...new Set(events.map((event) => String(event.surface || "").trim()).filter(Boolean))].slice(0, 4);
  return {
    cadence,
    sessionStyle,
    recommendationStyle,
    preferredSurfaces,
  };
};

const buildRecommendations = ({
  dominantIntents = [],
  scanCount = 0,
  osintCount = 0,
  highRiskCount = 0,
  newsFresh = false,
  memory,
  interestSignals = [],
  learningPattern,
  latestEvent = null,
}) => {
  const items = [];
  const firstIntent = dominantIntents[0]?.intent || "monitoring";
  const primaryInterest = interestSignals[0] || "Verified Operations";

  if (firstIntent === "investigation") {
    items.push({
      title: "Pivot from lookup to verification",
      reason: `Recent behavior shows ${osintCount} OSINT-driven actions. Convert findings into a verified website or header scan.`,
      action: "Run a web scan on the latest investigated target.",
    });
  }
  if (firstIntent === "hardening" || highRiskCount > 0) {
    items.push({
      title: "Prioritize remediation flow",
      reason: `${highRiskCount} high-risk findings are visible in recent scan data.`,
      action: "Review the newest high-risk target and close one control gap today.",
    });
  }
  if (learningPattern?.sessionStyle === "guided") {
    items.push({
      title: "Keep guidance aligned with your learning style",
      reason: "Your recent behavior shows repeated mentor and learning interactions.",
      action: "Open Zorvix with one concrete target so the next answer can stay step-by-step and task-specific.",
    });
  }
  if (learningPattern?.sessionStyle === "exploratory") {
    items.push({
      title: "Reduce context switching",
      reason: "You are touching many surfaces in one session, which can dilute follow-through.",
      action: `Stay on ${primaryInterest} for one full loop before opening a new workflow.`,
    });
  }
  if (!newsFresh) {
    items.push({
      title: "Refresh live threat context",
      reason: "Your activity is operational, but the news feed has not been refreshed in the current recommendation cycle.",
      action: "Refresh Security News before the next investigation step.",
    });
  }
  if (latestEvent?.target && /example\.com|demo|sample/i.test(String(latestEvent.target))) {
    items.push({
      title: "Move from placeholder target to a real scoped asset",
      reason: "Recent activity still includes placeholder-style targets.",
      action: "Replace the current sample target with an authorized real hostname or indicator.",
    });
  }
  if (!items.length) {
    items.push({
      title: "Keep the operator loop tight",
      reason: `You have ${scanCount} scan records and ${osintCount} OSINT records available for correlation.`,
      action: "Compare one recent scan with one recent OSINT lookup and save the outcome.",
    });
  }
  if (memory?.learning?.track) {
    items.push({
      title: "Align recommendations with your track",
      reason: `Stored learning track: ${String(memory.learning.track)}`,
      action: "Open a matching tool or lab path from the next-step suggestions.",
    });
  }
  return items.slice(0, 3);
};

const buildSmartActions = ({ latestScan, latestOsint, dominantIntents = [], interestSignals = [], learningPattern, assistantProfile = null }) => {
  const actions = [];
  if (latestOsint?.query) {
    actions.push({
      id: "resume-osint",
      label: "Resume OSINT thread",
      description: `Re-open ${String(latestOsint.query).slice(0, 48)} and validate it with a second signal.`,
      target: String(latestOsint.query),
    });
  }
  if (latestScan?.target_url) {
    actions.push({
      id: "recheck-scan",
      label: "Recheck last target",
      description: `Re-scan ${String(latestScan.target_url).slice(0, 48)} after remediation or configuration changes.`,
      target: String(latestScan.target_url),
    });
  }
  if (dominantIntents[0]?.intent === "guided_learning") {
    actions.push({
      id: "open-mentor",
      label: "Ask Zorvix",
      description: "Use the mentor for a focused next-step explanation tied to your current workflow.",
      target: "zorvix",
    });
  }
  if (interestSignals[0] === "Intel Monitoring") {
    actions.push({
      id: "refresh-news",
      label: "Refresh live advisories",
      description: "Pull the newest security news before the next decision.",
      target: "security-news",
    });
  }
  if (learningPattern?.sessionStyle === "guided") {
    actions.push({
      id: "mentor-plan",
      label: "Build a guided plan",
      description: "Turn your recent behavior into a step-by-step next-action checklist.",
      target: "adaptive-mentor",
    });
  }
  if (assistantProfile?.suggestedMode === "recovery_first") {
    actions.unshift({
      id: "assistant-recovery",
      label: "Open recovery assistant",
      description: "Use the adaptive assistant in recovery-first mode to shorten the next blocked workflow.",
      target: "assistant-recovery",
    });
  } else if (assistantProfile?.suggestedMode === "guided_learning") {
    actions.unshift({
      id: "assistant-learning",
      label: "Open guided assistant",
      description: "Use the assistant’s strongest guidance mode to move through the next task with less friction.",
      target: "assistant-guided-learning",
    });
  }
  return actions.slice(0, 3);
};

const mergeRecommendations = (base = [], overlay = []) => {
  const merged = [];
  const seen = new Set();
  for (const item of [...overlay, ...base]) {
    const title = normalize(item?.title || "", 72);
    const reason = normalize(item?.reason || "", 140);
    const action = normalize(item?.action || "", 140);
    if (!title || !action) continue;
    const key = `${title.toLowerCase()}::${action.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ title, reason, action });
    if (merged.length >= 4) break;
  }
  return merged;
};

const buildAssistantProfile = (events = []) => {
  const assistantEvents = events.filter((event) => /^assistant_hint_/.test(String(event.type || "")));
  const categoryStats = new Map();

  assistantEvents.forEach((event) => {
    const category = String(event.metadata?.category || "general").trim() || "general";
    const stat = categoryStats.get(category) || { category, shown: 0, acted: 0 };
    if (event.type === "assistant_hint_shown") stat.shown += 1;
    if (event.type === "assistant_hint_used") stat.acted += 1;
    categoryStats.set(category, stat);
  });

  const categories = [...categoryStats.values()]
    .map((item) => ({
      ...item,
      engagementRate: item.shown ? Number((item.acted / item.shown).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate || b.acted - a.acted || b.shown - a.shown);

  const preferredCategories = categories.slice(0, 3).map((item) => item.category);
  const totalShown = categories.reduce((sum, item) => sum + item.shown, 0);
  const totalActed = categories.reduce((sum, item) => sum + item.acted, 0);
  const engagementRate = totalShown ? Number((totalActed / totalShown).toFixed(2)) : 0;
  const suggestedMode =
    preferredCategories.includes("recovery")
      ? "recovery_first"
      : preferredCategories.includes("learning")
        ? "guided_learning"
        : preferredCategories.includes("analysis")
          ? "analyst_brief"
          : preferredCategories.includes("momentum")
            ? "momentum_nudges"
            : "balanced";

  return {
    totalShown,
    totalActed,
    engagementRate,
    preferredCategories,
    suggestedMode,
    categories: categories.slice(0, 4),
  };
};

const buildRoleAwareActions = ({ role = "learner", dominantIntents = [], highRiskCount = 0, learningPattern = null }) => {
  const actions = [];
  if (role === "admin") {
    actions.push({
      id: "role-admin-review",
      label: "Review platform risk posture",
      description: "Prioritize risk, history, and recovery guidance with an admin-level oversight lens.",
      target: "dashboard-risk-posture",
    });
  }
  if (role === "analyst") {
    actions.push({
      id: "role-analyst-hunt",
      label: "Open analyst hunt loop",
      description: "Move from verified signals into investigation, correlation, and evidence-backed follow-up.",
      target: "analyst-hunt-loop",
    });
  }
  if (role === "mentor" || role === "learner") {
    actions.push({
      id: "role-learning-path",
      label: "Continue guided learning path",
      description: "Use the assistant to keep the next step narrow, practical, and skill-building.",
      target: "guided-learning-path",
    });
  }
  if (dominantIntents[0]?.intent === "threat_hunting" || highRiskCount > 0) {
    actions.push({
      id: "role-priority-risk",
      label: "Prioritize high-risk investigation",
      description: "Use role-aware workflow ordering to tackle the highest-risk issues first.",
      target: "role-priority-risk",
    });
  }
  if (learningPattern?.sessionStyle === "guided") {
    actions.push({
      id: "role-guided-mode",
      label: "Stay in guided mode",
      description: "Your current workflow responds best to guided assistance rather than broad exploration.",
      target: "guided-mode",
    });
  }
  return actions.slice(0, 3);
};

const getRoleCohortInsights = async ({ db, role = "learner", userId = "" }) => {
  if (!db) {
    return {
      role,
      peerCount: 0,
      topAssistantCategories: [],
      sharedMode: "balanced",
    };
  }

  const users = db.collection("users");
  const adaptive = db.collection(COLLECTION);
  const userDoc = await users.findOne({ $or: userMatchers(userId) }, { projection: { role: 1 } });
  const normalizedRole = normalizeUserRole(userDoc?.role || role);
  const peerIds = await users
    .find({ role: normalizedRole }, { projection: { _id: 1 } })
    .limit(40)
    .toArray();

  const peerUserIds = peerIds.map((item) => String(item._id));
  if (!peerUserIds.length) {
    return {
      role: normalizedRole,
      peerCount: 0,
      topAssistantCategories: [],
      sharedMode: "balanced",
    };
  }

  const categoryRows = await adaptive
    .aggregate([
      {
        $match: {
          userId: { $in: peerUserIds },
          type: { $in: ["assistant_hint_shown", "assistant_hint_used"] },
        },
      },
      {
        $group: {
          _id: "$metadata.category",
          shown: {
            $sum: {
              $cond: [{ $eq: ["$type", "assistant_hint_shown"] }, 1, 0],
            },
          },
          acted: {
            $sum: {
              $cond: [{ $eq: ["$type", "assistant_hint_used"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { acted: -1, shown: -1 } },
      { $limit: 4 },
    ])
    .toArray();

  const topAssistantCategories = categoryRows.map((row) => ({
    category: String(row._id || "general"),
    shown: Number(row.shown || 0),
    acted: Number(row.acted || 0),
    engagementRate: Number(row.shown ? (row.acted / row.shown).toFixed(2) : 0),
  }));

  const sharedMode =
    topAssistantCategories[0]?.category === "recovery"
      ? "recovery_first"
      : topAssistantCategories[0]?.category === "learning"
        ? "guided_learning"
        : topAssistantCategories[0]?.category === "analysis"
          ? "analyst_brief"
          : "balanced";

  return {
    role: normalizedRole,
    peerCount: peerUserIds.length,
    topAssistantCategories,
    sharedMode,
  };
};

export const recordAdaptiveEvent = async ({ userId, event }) => {
  const normalized = {
    ...safeEvent(event),
    userId: String(userId || ""),
  };
  const db = getDbSafe();
  if (!db) {
    saveMemoryEvent(userId, normalized);
    return normalized;
  }
  try {
    await db.collection(COLLECTION).insertOne(normalized);
  } catch {
    saveMemoryEvent(userId, normalized);
  }
  return normalized;
};

export const getAdaptiveExperience = async ({ userId, dashboardStats = null, newsMeta = null }) => {
  const db = getDbSafe();
  const matchers = userMatchers(userId);
  const [memory, securityEvents, dbEvents, osintRows, userDoc, trainingProfile] = await Promise.all([
    getUserMemorySnapshot({ userId: String(userId || "") }),
    getSecurityEvents({ userId: String(userId || ""), limit: 8 }).catch(() => []),
    db
      ? db
          .collection(COLLECTION)
          .find({ $or: matchers })
          .sort({ createdAt: -1 })
          .limit(40)
          .toArray()
      : Promise.resolve(listMemoryEvents(userId)),
    db
      ? db
          .collection("osint_queries")
          .find({ $or: matchers })
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(12)
          .toArray()
      : Promise.resolve([]),
    db ? db.collection("users").findOne({ $or: matchers }, { projection: { role: 1 } }) : Promise.resolve(null),
    db ? db.collection("training_profiles").findOne({ $or: matchers }) : Promise.resolve(null),
  ]);

  const userRole = normalizeUserRole(userDoc?.role || "learner");
  const recentEvents = (dbEvents || []).map(safeEvent);
  const dominantIntents = dominantIntentsFromEvents(recentEvents);
  const latestScan = dashboardStats?.latestScan || null;
  const latestOsint = osintRows?.[0] || null;
  const latestEvent = recentEvents[0] || null;
  const scanCount = Number(dashboardStats?.totalScans || 0);
  const osintCount = Number(osintRows?.length || 0);
  const highRiskCount = Number(dashboardStats?.riskCounts?.high || 0);
  const newsFresh = newsMeta ? !Boolean(newsMeta.stale) : false;
  const interestSignals = inferInterestSignals(recentEvents, osintRows, memory);
  const learningPattern = inferLearningPattern({ events: recentEvents, dominantIntents, memory });
  const assistant = buildAssistantProfile(recentEvents);
  const roleAwareActions = buildRoleAwareActions({
    role: userRole,
    dominantIntents,
    highRiskCount,
    learningPattern,
  });
  const roleInsights = await getRoleCohortInsights({ db, role: userRole, userId });
  const behavioralLoop = buildBehavioralLoop({
    profile: trainingProfile,
    recentEvents,
    dominantIntents,
    interestSignals,
    learningTrack: String(memory?.learning?.track || ""),
    role: userRole,
    highRiskCount,
    completedLabs: Number(trainingProfile?.completedLabs || 0),
  });

  const recommendations = buildRecommendations({
    dominantIntents,
    scanCount,
    osintCount,
    highRiskCount,
    newsFresh,
    memory,
    interestSignals,
    learningPattern,
    latestEvent,
  });

  if (assistant.preferredCategories.includes("recovery")) {
    recommendations.unshift({
      title: "Keep recovery guidance close",
      reason: "Your hint engagement shows a strong preference for recovery-oriented guidance when friction appears.",
      action: "Surface short recovery plans first when a flow fails or stalls.",
    });
  } else if (assistant.preferredCategories.includes("learning")) {
    recommendations.unshift({
      title: "Lean into guided learning prompts",
      reason: "You respond well to mentor-like nudges and step-by-step learning assistance.",
      action: "Use Zorvix as the first assist when opening a new learning or lab workflow.",
    });
  }

  const predictedNeeds = [
    dominantIntents[0]?.intent === "investigation"
      ? "You likely need fast correlation between OSINT findings and verified infrastructure scans."
      : null,
    highRiskCount > 0 ? "You may need remediation guidance on recent high-risk findings." : null,
    !newsFresh ? "You may need fresh advisory context before the next decision." : null,
    securityEvents.length > 0 ? "Recent security events suggest keeping audit visibility close to your workflow." : null,
    learningPattern.sessionStyle === "guided" ? "You likely benefit from next steps that stay ordered and narrow." : null,
    interestSignals[0] ? `Your current activity clusters around ${interestSignals[0].toLowerCase()}.` : null,
  ].filter(Boolean);

  const ai = await getAdaptiveAiSynthesis({
    userId: String(userId || ""),
    adaptive: {
      profile: {
        dominantIntents,
        interestSignals,
        learningPattern,
        assistant,
        role: userRole,
      },
      usage: {
        scans: scanCount,
        osintLookups: osintCount,
        highRiskFindings: highRiskCount,
        recentActions: recentEvents.slice(0, 6).map((event) => ({
          type: event.type,
          surface: event.surface,
          target: event.target,
          createdAt: event.createdAt,
        })),
      },
      predictedNeeds,
      recommendations,
      smartActions: [],
    },
    type: "dashboard",
  });

  const mergedRecommendations = mergeRecommendations(recommendations, ai?.recommendations || []);

  const smartActions = buildSmartActions({
    latestScan,
    latestOsint,
    dominantIntents,
    interestSignals,
    learningPattern,
    assistantProfile: assistant,
  });

  return {
    generatedAt: now(),
    profile: {
      dominantIntents,
      learningTrack: String(memory?.learning?.track || ""),
      assistantTone: String(memory?.preferences?.assistantProfile?.tone || ""),
      recentEventCount: recentEvents.length,
      securityEventCount: securityEvents.length,
      interestSignals,
      learningPattern,
      assistant,
      role: userRole,
      roleInsights,
      behavioralLoop,
    },
    usage: {
      scans: scanCount,
      osintLookups: osintCount,
      highRiskFindings: highRiskCount,
      recentActions: recentEvents.slice(0, 6).map((event) => ({
        type: event.type,
        surface: event.surface,
        target: event.target,
        createdAt: event.createdAt,
      })),
    },
    predictedNeeds: predictedNeeds.slice(0, 3),
    recommendations: mergedRecommendations,
    smartActions: [...roleAwareActions, ...smartActions].slice(0, 5),
    ai,
  };
};
