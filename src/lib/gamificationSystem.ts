import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DocumentData,
  Timestamp,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { toast } from "@/hooks/use-toast";

export type MissionScope = "daily" | "weekly";
export type MissionKind = "port_scan" | "cve_read" | "ctf" | "lab_chain" | "intel_chain";
export type RewardTone = "deploy" | "badge" | "level_up" | "quiz";

export type GamifiedMission = {
  id: string;
  scope: MissionScope;
  kind: MissionKind;
  title: string;
  briefing: string;
  cta: string;
  route: string;
  xp: number;
  badgeId?: string;
  completed: boolean;
  completedAt?: string | null;
};

export type QuizOption = {
  id: string;
  emoji: string;
  label: string;
};

export type DailyQuizQuestion = {
  id: string;
  prompt: string;
  explanation: string;
  options: QuizOption[];
  correctOptionId: string;
};

export type DailyQuizAnswer = {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  explanation: string;
  answeredAt: string;
  pointsAwarded: number;
};

export type GamificationBadge = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  earnedAt: string;
};

export type GamificationReward = {
  id: string;
  title: string;
  detail: string;
  xp: number;
  tone: RewardTone;
  createdAt: string;
};

export type GamificationSnapshot = {
  userId: string;
  handle: string;
  dailyKey: string;
  weeklyKey: string;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  streakDays: number;
  completedDays: number;
  dailyMissions: GamifiedMission[];
  weeklyMissions: GamifiedMission[];
  quizQuestions: DailyQuizQuestion[];
  quizAnswers: Record<string, DailyQuizAnswer>;
  badges: GamificationBadge[];
  recentRewards: GamificationReward[];
  serviceStatus: "ready" | "degraded";
  serviceMessage: string;
};

type PersistedGamificationState = Omit<GamificationSnapshot, "serviceStatus" | "serviceMessage"> & {
  lastCompletedDailyKey?: string | null;
  updatedAt?: string | null;
};

type GamificationHook = {
  snapshot: GamificationSnapshot;
  loading: boolean;
  error: string;
  latestReward: GamificationReward | null;
  refresh: () => Promise<void>;
  clearLatestReward: () => void;
  completeMission: (scope: MissionScope, missionId: string) => Promise<GamificationSnapshot | null>;
  submitQuizAnswer: (questionId: string, optionId: string) => Promise<DailyQuizAnswer | null>;
};

const DAILY_XP_PER_QUIZ_CORRECT = 50;
const STORAGE_COLLECTION = "gamification_users";
const LOCAL_STORAGE_PREFIX = "zdg:gamification";
const MOTTO_READY = "Deploy the next move. Intel is live.";
const MOTTO_DEGRADED = "Intel uplink is unstable. Mission data is protected.";

const DAILY_MISSION_BLUEPRINTS: Array<Omit<GamifiedMission, "id" | "scope" | "completed" | "completedAt">> = [
  {
    kind: "port_scan",
    title: "Port Scan Sweep",
    briefing: "Deploy a disciplined scan plan and identify the exposed service surface without noise.",
    cta: "Deploy recon",
    route: "/lab",
    xp: 120,
    badgeId: "signal-hunter",
  },
  {
    kind: "cve_read",
    title: "CVE Intel Read",
    briefing: "Read one fresh CVE, extract the exploit path, and log one defensive takeaway.",
    cta: "Gather intel",
    route: "/learn",
    xp: 100,
    badgeId: "intel-scribe",
  },
  {
    kind: "ctf",
    title: "CTF Breach Drill",
    briefing: "Clear one focused capture-the-flag scenario and validate the lesson you stole from it.",
    cta: "Breach complete",
    route: "/community",
    xp: 140,
    badgeId: "ctf-raider",
  },
];

const WEEKLY_MISSION_BLUEPRINTS: Array<Omit<GamifiedMission, "id" | "scope" | "completed" | "completedAt">> = [
  {
    kind: "lab_chain",
    title: "Exploit Chain Build",
    briefing: "Link recon, signal validation, and execution into one clean offensive story.",
    cta: "Assemble chain",
    route: "/lab",
    xp: 240,
    badgeId: "chain-builder",
  },
  {
    kind: "intel_chain",
    title: "Threat Intel Digest",
    briefing: "Aggregate multiple sources, isolate what matters, and brief it like an operator.",
    cta: "Compile digest",
    route: "/learn",
    xp: 220,
    badgeId: "intel-architect",
  },
  {
    kind: "port_scan",
    title: "Surface Mapping Run",
    briefing: "Turn raw exposure into a high-confidence attack-surface map with next actions.",
    cta: "Map surface",
    route: "/toolbox",
    xp: 230,
    badgeId: "surface-cartographer",
  },
  {
    kind: "ctf",
    title: "Elite CTF Sprint",
    briefing: "Clear a harder challenge set without losing control of method or evidence.",
    cta: "Run elite sprint",
    route: "/community",
    xp: 260,
    badgeId: "elite-raider",
  },
  {
    kind: "lab_chain",
    title: "Defense Retrofit",
    briefing: "Translate a breach path into detections, hardening, and measurable recovery steps.",
    cta: "Ship defenses",
    route: "/dashboard",
    xp: 250,
    badgeId: "blue-team-forge",
  },
];

const QUIZ_BANK: DailyQuizQuestion[] = [
  {
    id: "quiz-open-ports",
    prompt: "Which scan type is best when you need the quietest first-pass TCP port discovery?",
    explanation: "A SYN scan is commonly used for efficient half-open discovery while avoiding full TCP handshakes.",
    correctOptionId: "syn",
    options: [
      { id: "syn", emoji: "🔐", label: "SYN scan" },
      { id: "udp", emoji: "🛡️", label: "UDP flood" },
      { id: "full", emoji: "⚔️", label: "Full connect scan" },
      { id: "icmp", emoji: "💀", label: "ICMP echo only" },
    ],
  },
  {
    id: "quiz-cve-score",
    prompt: "What does CVSS primarily estimate for a vulnerability?",
    explanation: "CVSS estimates vulnerability severity and exploit impact using a standardized scoring model.",
    correctOptionId: "severity",
    options: [
      { id: "severity", emoji: "🔐", label: "Severity and impact" },
      { id: "patch", emoji: "🛡️", label: "Patch size" },
      { id: "vendor", emoji: "⚔️", label: "Vendor popularity" },
      { id: "logs", emoji: "💀", label: "Log retention time" },
    ],
  },
  {
    id: "quiz-triad",
    prompt: "Which part of the CIA triad is damaged when an attacker silently modifies a database record?",
    explanation: "Unauthorized modification breaks integrity because the data can no longer be trusted.",
    correctOptionId: "integrity",
    options: [
      { id: "confidentiality", emoji: "🔐", label: "Confidentiality" },
      { id: "integrity", emoji: "🛡️", label: "Integrity" },
      { id: "availability", emoji: "⚔️", label: "Availability" },
      { id: "attribution", emoji: "💀", label: "Attribution" },
    ],
  },
  {
    id: "quiz-osint",
    prompt: "What is the strongest reason to validate OSINT findings across multiple sources?",
    explanation: "Cross-validation reduces false positives and improves confidence before action.",
    correctOptionId: "validate",
    options: [
      { id: "validate", emoji: "🔐", label: "Reduce false positives" },
      { id: "speed", emoji: "🛡️", label: "Increase scan speed" },
      { id: "hide", emoji: "⚔️", label: "Hide from logs" },
      { id: "encrypt", emoji: "💀", label: "Encrypt the source" },
    ],
  },
  {
    id: "quiz-defense",
    prompt: "Which control most directly limits lateral movement after one workstation is compromised?",
    explanation: "Network segmentation limits how far an attacker can pivot from the initial foothold.",
    correctOptionId: "segmentation",
    options: [
      { id: "segmentation", emoji: "🔐", label: "Network segmentation" },
      { id: "branding", emoji: "🛡️", label: "Brand monitoring" },
      { id: "cdn", emoji: "⚔️", label: "CDN caching" },
      { id: "dns", emoji: "💀", label: "Public DNS only" },
    ],
  },
  {
    id: "quiz-exploit",
    prompt: "Why should exploit validation happen inside a controlled lab before any production discussion?",
    explanation: "Controlled validation protects systems, preserves ethics, and verifies findings safely.",
    correctOptionId: "safe",
    options: [
      { id: "safe", emoji: "🔐", label: "Safe verification" },
      { id: "faster", emoji: "🛡️", label: "Faster internet" },
      { id: "seo", emoji: "⚔️", label: "Better SEO" },
      { id: "ads", emoji: "💀", label: "Higher ad reach" },
    ],
  },
  {
    id: "quiz-phishing",
    prompt: "What is the first operator question when investigating a suspected phishing email?",
    explanation: "Start by validating sender authenticity and delivery path before interacting with content.",
    correctOptionId: "sender",
    options: [
      { id: "sender", emoji: "🔐", label: "Is the sender authentic?" },
      { id: "delete", emoji: "🛡️", label: "Should I delete the browser?" },
      { id: "font", emoji: "⚔️", label: "Is the font stylish?" },
      { id: "theme", emoji: "💀", label: "Is dark mode enabled?" },
    ],
  },
];

const badgeCatalog: Record<string, Omit<GamificationBadge, "earnedAt">> = {
  "signal-hunter": { id: "signal-hunter", title: "Signal Hunter", detail: "Completed the daily recon sweep.", icon: "📡" },
  "intel-scribe": { id: "intel-scribe", title: "Intel Scribe", detail: "Converted a live CVE into actionable notes.", icon: "📚" },
  "ctf-raider": { id: "ctf-raider", title: "CTF Raider", detail: "Cleared the daily breach drill.", icon: "🏴‍☠️" },
  "daily-loop-cleared": { id: "daily-loop-cleared", title: "Mission Loop Cleared", detail: "All daily ops were deployed before midnight.", icon: "🕵️" },
  "weekly-elite": { id: "weekly-elite", title: "Week Cleared! You're Elite 🏴‍☠️", detail: "Every weekly challenge was closed cleanly.", icon: "👑" },
  "quiz-ace": { id: "quiz-ace", title: "Cipher Ace", detail: "Five correct answers in one briefing window.", icon: "🧠" },
  "chain-builder": { id: "chain-builder", title: "Chain Builder", detail: "Built a disciplined exploit chain.", icon: "⚔️" },
  "intel-architect": { id: "intel-architect", title: "Intel Architect", detail: "Turned raw signals into direction.", icon: "🛰️" },
  "surface-cartographer": { id: "surface-cartographer", title: "Surface Cartographer", detail: "Mapped the attack surface with precision.", icon: "🗺️" },
  "elite-raider": { id: "elite-raider", title: "Elite Raider", detail: "Closed a high-pressure weekly CTF sprint.", icon: "💀" },
  "blue-team-forge": { id: "blue-team-forge", title: "Blue Team Forge", detail: "Translated offense into defense.", icon: "🛡️" },
};

const defaultSnapshot = (userId: string): GamificationSnapshot => ({
  userId,
  handle: "operator",
  dailyKey: localDayKey(),
  weeklyKey: localWeekKey(),
  level: 1,
  totalXp: 0,
  xpIntoLevel: 0,
  xpToNextLevel: xpNeededForLevel(2),
  streakDays: 0,
  completedDays: 0,
  dailyMissions: [],
  weeklyMissions: [],
  quizQuestions: [],
  quizAnswers: {},
  badges: [],
  recentRewards: [],
  serviceStatus: "degraded",
  serviceMessage: MOTTO_DEGRADED,
});

const localDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const localWeekKey = (date = new Date()) => {
  const current = new Date(date);
  const day = current.getDay() || 7;
  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() + 4 - day);
  const yearStart = new Date(current.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((current.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${current.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const previousDayKey = (key: string) => {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return localDayKey(date);
};

const xpNeededForLevel = (level: number) => level * level * 150;

const computeLevelState = (totalXp: number) => {
  let level = 1;
  while (totalXp >= xpNeededForLevel(level + 1)) level += 1;
  const currentFloor = xpNeededForLevel(level);
  const nextGoal = xpNeededForLevel(level + 1);
  return {
    level,
    xpIntoLevel: Math.max(totalXp - currentFloor, 0),
    xpToNextLevel: Math.max(nextGoal - totalXp, 0),
  };
};

const seededOrder = <T,>(items: T[], seed: string) => {
  const copy = [...items];
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  for (let index = copy.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const swapIndex = hash % (index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildDailyMissions = (dayKey: string): GamifiedMission[] =>
  seededOrder(DAILY_MISSION_BLUEPRINTS, dayKey).map((item, index) => ({
    ...item,
    id: `${dayKey}-daily-${index + 1}-${item.kind}`,
    scope: "daily",
    completed: false,
    completedAt: null,
  }));

const buildWeeklyMissions = (weekKey: string): GamifiedMission[] =>
  seededOrder(WEEKLY_MISSION_BLUEPRINTS, weekKey).map((item, index) => ({
    ...item,
    id: `${weekKey}-weekly-${index + 1}-${item.kind}`,
    scope: "weekly",
    completed: false,
    completedAt: null,
  }));

const buildDailyQuiz = (dayKey: string): DailyQuizQuestion[] => seededOrder(QUIZ_BANK, dayKey).slice(0, 5);

const asIso = (value: unknown) => {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizeMission = (item: Partial<GamifiedMission>, scope: MissionScope): GamifiedMission => ({
  id: String(item.id || `${scope}-${Math.random().toString(36).slice(2, 10)}`),
  scope,
  kind: (item.kind || "lab_chain") as MissionKind,
  title: String(item.title || "Untitled mission"),
  briefing: String(item.briefing || "No briefing available."),
  cta: String(item.cta || "Deploy"),
  route: String(item.route || "/dashboard"),
  xp: Number(item.xp || 0),
  badgeId: item.badgeId ? String(item.badgeId) : undefined,
  completed: Boolean(item.completed),
  completedAt: item.completedAt ? asIso(item.completedAt) : null,
});

const normalizeQuizQuestion = (item: Partial<DailyQuizQuestion>): DailyQuizQuestion => ({
  id: String(item.id || `quiz-${Math.random().toString(36).slice(2, 10)}`),
  prompt: String(item.prompt || "No question loaded."),
  explanation: String(item.explanation || "No explanation available."),
  correctOptionId: String(item.correctOptionId || ""),
  options: Array.isArray(item.options)
    ? item.options.map((option) => ({
        id: String(option.id || ""),
        emoji: String(option.emoji || "🔐"),
        label: String(option.label || ""),
      }))
    : [],
});

const normalizeQuizAnswers = (value: unknown): Record<string, DailyQuizAnswer> => {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, answer]) => {
      const row = (answer || {}) as Partial<DailyQuizAnswer>;
      return [
        key,
        {
          questionId: String(row.questionId || key),
          selectedOptionId: String(row.selectedOptionId || ""),
          correct: Boolean(row.correct),
          explanation: String(row.explanation || ""),
          answeredAt: asIso(row.answeredAt),
          pointsAwarded: Number(row.pointsAwarded || 0),
        },
      ];
    })
  );
};

const normalizeBadge = (value: Partial<GamificationBadge>): GamificationBadge => ({
  id: String(value.id || "badge"),
  title: String(value.title || "Badge"),
  detail: String(value.detail || ""),
  icon: String(value.icon || "🏅"),
  earnedAt: asIso(value.earnedAt),
});

const normalizeReward = (value: Partial<GamificationReward>): GamificationReward => ({
  id: String(value.id || `reward-${Math.random().toString(36).slice(2, 10)}`),
  title: String(value.title || "Reward"),
  detail: String(value.detail || ""),
  xp: Number(value.xp || 0),
  tone: (value.tone || "deploy") as RewardTone,
  createdAt: asIso(value.createdAt),
});

const normalizeState = (userId: string, data?: DocumentData | null): PersistedGamificationState => {
  const fallback = defaultSnapshot(userId);
  const totalXp = Number(data?.totalXp || fallback.totalXp);
  const levelState = computeLevelState(totalXp);
  return {
    userId,
    handle: String(data?.handle || fallback.handle),
    dailyKey: String(data?.dailyKey || fallback.dailyKey),
    weeklyKey: String(data?.weeklyKey || fallback.weeklyKey),
    totalXp,
    level: Number(data?.level || levelState.level),
    xpIntoLevel: Number(data?.xpIntoLevel ?? levelState.xpIntoLevel),
    xpToNextLevel: Number(data?.xpToNextLevel ?? levelState.xpToNextLevel),
    streakDays: Number(data?.streakDays || 0),
    completedDays: Number(data?.completedDays || 0),
    dailyMissions: Array.isArray(data?.dailyMissions) ? data.dailyMissions.map((item: Partial<GamifiedMission>) => normalizeMission(item, "daily")) : buildDailyMissions(fallback.dailyKey),
    weeklyMissions: Array.isArray(data?.weeklyMissions) ? data.weeklyMissions.map((item: Partial<GamifiedMission>) => normalizeMission(item, "weekly")) : buildWeeklyMissions(fallback.weeklyKey),
    quizQuestions: Array.isArray(data?.quizQuestions) ? data.quizQuestions.map((item: Partial<DailyQuizQuestion>) => normalizeQuizQuestion(item)) : buildDailyQuiz(fallback.dailyKey),
    quizAnswers: normalizeQuizAnswers(data?.quizAnswers),
    badges: Array.isArray(data?.badges) ? data.badges.map((item: Partial<GamificationBadge>) => normalizeBadge(item)) : [],
    recentRewards: Array.isArray(data?.recentRewards) ? data.recentRewards.map((item: Partial<GamificationReward>) => normalizeReward(item)).slice(0, 12) : [],
    lastCompletedDailyKey: data?.lastCompletedDailyKey ? String(data.lastCompletedDailyKey) : null,
    updatedAt: data?.updatedAt ? asIso(data.updatedAt) : null,
  };
};

const persistableSnapshot = (state: PersistedGamificationState): PersistedGamificationState => {
  const levelState = computeLevelState(state.totalXp);
  return {
    ...state,
    level: levelState.level,
    xpIntoLevel: levelState.xpIntoLevel,
    xpToNextLevel: levelState.xpToNextLevel,
    recentRewards: state.recentRewards.slice(0, 12),
  };
};

const finalizeSnapshot = (state: PersistedGamificationState, serviceStatus: "ready" | "degraded", serviceMessage: string): GamificationSnapshot => ({
  ...state,
  serviceStatus,
  serviceMessage,
});

const buildReward = (title: string, detail: string, xp: number, tone: RewardTone): GamificationReward => ({
  id: `${tone}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title,
  detail,
  xp,
  tone,
  createdAt: new Date().toISOString(),
});

const awardBadgeIfMissing = (state: PersistedGamificationState, badgeId: string, detailOverride?: string) => {
  if (state.badges.some((badge) => badge.id === badgeId)) return null;
  const template = badgeCatalog[badgeId];
  if (!template) return null;
  const badge = normalizeBadge({
    ...template,
    detail: detailOverride || template.detail,
    earnedAt: new Date().toISOString(),
  });
  state.badges = [badge, ...state.badges].slice(0, 12);
  const reward = buildReward(badge.title, badge.detail, 0, "badge");
  state.recentRewards = [reward, ...state.recentRewards].slice(0, 12);
  return reward;
};

const getDb = () => {
  if (!isFirebaseConfigured || !firestoreDb) {
    throw new Error("Firebase is not configured for live gamification.");
  }
  return firestoreDb;
};

const getRef = (userId: string) => doc(getDb(), STORAGE_COLLECTION, userId);

const canUseFirestoreForUser = (userId: string) => {
  if (!isFirebaseConfigured || !firestoreDb) return false;
  const firebaseUid = firebaseAuth?.currentUser?.uid;
  return Boolean(firebaseUid && firebaseUid === userId);
};

const localStorageKey = (userId: string) => `${LOCAL_STORAGE_PREFIX}:${userId}`;

const permissionDeniedUsers = new Set<string>();

const isPermissionDeniedError = (error: unknown) => {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string }).code || "")
      : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    code === "permission-denied" ||
    code === "permission_denied" ||
    /permission[-_\s]?denied/i.test(message) ||
    /forbidden/i.test(message)
  );
};

const readLocalState = (userId: string): PersistedGamificationState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localStorageKey(userId));
    if (!raw) return null;
    return normalizeState(userId, JSON.parse(raw) as DocumentData);
  } catch {
    return null;
  }
};

const writeLocalState = (userId: string, state: PersistedGamificationState) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(localStorageKey(userId), JSON.stringify(state));
  } catch {
    // Keep gamification non-blocking when storage is unavailable.
  }
};

const syncStateToCurrentWindow = (incoming: PersistedGamificationState, handle?: string): PersistedGamificationState => {
  let state = { ...incoming };
  const today = localDayKey();
  const week = localWeekKey();

  if (handle && state.handle !== handle) {
    state.handle = handle;
  }

  if (state.dailyKey !== today) {
    state.dailyKey = today;
    state.dailyMissions = buildDailyMissions(today);
    state.quizQuestions = buildDailyQuiz(today);
    state.quizAnswers = {};
  }

  if (state.weeklyKey !== week) {
    state.weeklyKey = week;
    state.weeklyMissions = buildWeeklyMissions(week);
  }

  return persistableSnapshot(state);
};

const completeMissionInState = (
  incoming: PersistedGamificationState,
  scope: MissionScope,
  missionId: string
): { state: PersistedGamificationState; reward: GamificationReward | null } => {
  let state = { ...incoming };
  const list = scope === "daily" ? state.dailyMissions : state.weeklyMissions;
  const index = list.findIndex((item) => item.id === missionId);
  if (index < 0) {
    throw new Error("Mission not found.");
  }

  const mission = list[index];
  let latestReward: GamificationReward | null = null;
  if (!mission.completed) {
    mission.completed = true;
    mission.completedAt = new Date().toISOString();
    state.totalXp += mission.xp;
    latestReward = buildReward(
      scope === "daily" ? "Deploy Complete" : "Breach Complete",
      `${mission.title} cleared. ${mission.xp} XP banked.`,
      mission.xp,
      "deploy"
    );
    state.recentRewards = [latestReward, ...state.recentRewards].slice(0, 12);
    if (mission.badgeId) awardBadgeIfMissing(state, mission.badgeId);
  }

  const refreshedList = scope === "daily" ? state.dailyMissions : state.weeklyMissions;
  const allCleared = refreshedList.length > 0 && refreshedList.every((item) => item.completed);

  if (scope === "daily" && allCleared && state.lastCompletedDailyKey !== state.dailyKey) {
    state.completedDays += 1;
    state.streakDays = state.lastCompletedDailyKey === previousDayKey(state.dailyKey) ? state.streakDays + 1 : 1;
    state.lastCompletedDailyKey = state.dailyKey;
    awardBadgeIfMissing(state, "daily-loop-cleared", "Mission Briefing closed cleanly. Daily loop reset at midnight.");
  }

  if (scope === "weekly" && allCleared) {
    awardBadgeIfMissing(state, "weekly-elite");
  }

  const levelBefore = state.level;
  state = persistableSnapshot(state);
  if (state.level > levelBefore) {
    const levelReward = buildReward("Level Breach", `Level ${state.level} unlocked. New routes are now live.`, 0, "level_up");
    state.recentRewards = [levelReward, ...state.recentRewards].slice(0, 12);
    latestReward = levelReward;
  }

  return { state, reward: latestReward };
};

const submitQuizAnswerInState = (
  incoming: PersistedGamificationState,
  questionId: string,
  optionId: string
): { state: PersistedGamificationState; answer: DailyQuizAnswer | null; reward: GamificationReward | null } => {
  let state = { ...incoming };

  if (state.quizAnswers[questionId]) {
    return {
      state: persistableSnapshot(state),
      answer: state.quizAnswers[questionId],
      reward: null,
    };
  }

  const question = state.quizQuestions.find((item) => item.id === questionId);
  if (!question) throw new Error("Quiz question not found.");

  const correct = question.correctOptionId === optionId;
  const answer: DailyQuizAnswer = {
    questionId,
    selectedOptionId: optionId,
    correct,
    explanation: question.explanation,
    answeredAt: new Date().toISOString(),
    pointsAwarded: correct ? DAILY_XP_PER_QUIZ_CORRECT : 0,
  };
  state.quizAnswers = { ...state.quizAnswers, [questionId]: answer };

  let latestReward: GamificationReward | null = null;
  if (correct) {
    state.totalXp += DAILY_XP_PER_QUIZ_CORRECT;
    latestReward = buildReward("Intel Gathered", `Correct answer. +${DAILY_XP_PER_QUIZ_CORRECT} XP injected.`, DAILY_XP_PER_QUIZ_CORRECT, "quiz");
    state.recentRewards = [latestReward, ...state.recentRewards].slice(0, 12);
  }

  const correctCount = Object.values(state.quizAnswers).filter((item) => item.correct).length;
  if (correctCount === state.quizQuestions.length && state.quizQuestions.length >= 5) {
    awardBadgeIfMissing(state, "quiz-ace");
  }

  const levelBefore = state.level;
  state = persistableSnapshot(state);
  if (state.level > levelBefore) {
    const levelReward = buildReward("Level Breach", `Level ${state.level} unlocked. Keep deploying.`, 0, "level_up");
    state.recentRewards = [levelReward, ...state.recentRewards].slice(0, 12);
    latestReward = levelReward;
  }

  return { state, answer, reward: latestReward };
};

const loadLocalGamificationSnapshot = async (userId: string, handle?: string): Promise<GamificationSnapshot> => {
  const baseline = normalizeState(userId, readLocalState(userId));
  const state = syncStateToCurrentWindow(baseline, handle);
  writeLocalState(userId, state);
  return finalizeSnapshot(state, "degraded", MOTTO_DEGRADED);
};

const completeLocalGamifiedMission = async (
  userId: string,
  scope: MissionScope,
  missionId: string,
  handle?: string
): Promise<{ snapshot: GamificationSnapshot; reward: GamificationReward | null }> => {
  const baseline = syncStateToCurrentWindow(normalizeState(userId, readLocalState(userId)), handle);
  const result = completeMissionInState(baseline, scope, missionId);
  writeLocalState(userId, result.state);
  return {
    snapshot: finalizeSnapshot(result.state, "degraded", MOTTO_DEGRADED),
    reward: result.reward,
  };
};

const submitLocalGamifiedQuizAnswer = async (
  userId: string,
  questionId: string,
  optionId: string,
  handle?: string
): Promise<{ snapshot: GamificationSnapshot; answer: DailyQuizAnswer | null; reward: GamificationReward | null }> => {
  const baseline = syncStateToCurrentWindow(normalizeState(userId, readLocalState(userId)), handle);
  const result = submitQuizAnswerInState(baseline, questionId, optionId);
  writeLocalState(userId, result.state);
  return {
    snapshot: finalizeSnapshot(result.state, "degraded", MOTTO_DEGRADED),
    answer: result.answer,
    reward: result.reward,
  };
};

const syncPersistedState = (userId: string, handle?: string): Promise<PersistedGamificationState> =>
  runTransaction(getDb(), async (transaction) => {
    const ref = getRef(userId);
    const snapshot = await transaction.get(ref);
    let state = normalizeState(userId, snapshot.exists() ? snapshot.data() : null);
    const today = localDayKey();
    const week = localWeekKey();
    let mutated = !snapshot.exists();

    if (handle && state.handle !== handle) {
      state.handle = handle;
      mutated = true;
    }

    if (state.dailyKey !== today) {
      state.dailyKey = today;
      state.dailyMissions = buildDailyMissions(today);
      state.quizQuestions = buildDailyQuiz(today);
      state.quizAnswers = {};
      mutated = true;
    }

    if (state.weeklyKey !== week) {
      state.weeklyKey = week;
      state.weeklyMissions = buildWeeklyMissions(week);
      mutated = true;
    }

    state = persistableSnapshot(state);

    if (mutated) {
      transaction.set(
        ref,
        {
          ...state,
          updatedAt: new Date().toISOString(),
          syncedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return state;
  });

export const loadGamificationSnapshot = async (userId: string, handle?: string): Promise<GamificationSnapshot> => {
  if (permissionDeniedUsers.has(userId) || !canUseFirestoreForUser(userId)) {
    return loadLocalGamificationSnapshot(userId, handle);
  }

  try {
    const state = await syncPersistedState(userId, handle);
    return finalizeSnapshot(state, "ready", MOTTO_READY);
  } catch (error) {
    if (!isPermissionDeniedError(error)) throw error;
    permissionDeniedUsers.add(userId);
    return loadLocalGamificationSnapshot(userId, handle);
  }
};

export const completeGamifiedMission = async (
  userId: string,
  scope: MissionScope,
  missionId: string,
  handle?: string
): Promise<{ snapshot: GamificationSnapshot; reward: GamificationReward | null }> => {
  if (permissionDeniedUsers.has(userId) || !canUseFirestoreForUser(userId)) {
    return completeLocalGamifiedMission(userId, scope, missionId, handle);
  }

  try {
    return await runTransaction(getDb(), async (transaction) => {
    const ref = getRef(userId);
    const raw = await transaction.get(ref);
    let state = syncStateToCurrentWindow(normalizeState(userId, raw.exists() ? raw.data() : null), handle);
    const result = completeMissionInState(state, scope, missionId);
    state = result.state;

    transaction.set(
      ref,
      {
        ...state,
        updatedAt: new Date().toISOString(),
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      snapshot: finalizeSnapshot(state, "ready", MOTTO_READY),
      reward: result.reward,
    };
    });
  } catch (error) {
    if (!isPermissionDeniedError(error)) throw error;
    permissionDeniedUsers.add(userId);
    return completeLocalGamifiedMission(userId, scope, missionId, handle);
  }
};

export const submitGamifiedQuizAnswer = async (
  userId: string,
  questionId: string,
  optionId: string,
  handle?: string
): Promise<{ snapshot: GamificationSnapshot; answer: DailyQuizAnswer | null; reward: GamificationReward | null }> => {
  if (permissionDeniedUsers.has(userId) || !canUseFirestoreForUser(userId)) {
    return submitLocalGamifiedQuizAnswer(userId, questionId, optionId, handle);
  }

  try {
    return await runTransaction(getDb(), async (transaction) => {
    const ref = getRef(userId);
    const raw = await transaction.get(ref);
    let state = syncStateToCurrentWindow(normalizeState(userId, raw.exists() ? raw.data() : null), handle);
    const result = submitQuizAnswerInState(state, questionId, optionId);
    state = result.state;

    transaction.set(
      ref,
      {
        ...state,
        updatedAt: new Date().toISOString(),
        syncedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      snapshot: finalizeSnapshot(state, "ready", MOTTO_READY),
      answer: result.answer,
      reward: result.reward,
    };
    });
  } catch (error) {
    if (!isPermissionDeniedError(error)) throw error;
    permissionDeniedUsers.add(userId);
    return submitLocalGamifiedQuizAnswer(userId, questionId, optionId, handle);
  }
};

export const useGamificationSystem = (userId?: string | null, handle?: string | null): GamificationHook => {
  const [snapshot, setSnapshot] = useState<GamificationSnapshot>(() => defaultSnapshot(userId || "anonymous"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [latestReward, setLatestReward] = useState<GamificationReward | null>(null);

  const safeHandle = useMemo(() => String(handle || "operator"), [handle]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSnapshot(defaultSnapshot("anonymous"));
      setError("");
      return;
    }
    setLoading(true);
    try {
      const next = await loadGamificationSnapshot(userId, safeHandle);
      setSnapshot(next);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mission uplink failed.";
      setSnapshot((current) => ({
        ...current,
        userId,
        handle: safeHandle,
        serviceStatus: "degraded",
        serviceMessage: MOTTO_DEGRADED,
      }));
      setError(message);
      toast({
        title: "Mission uplink unstable",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [safeHandle, userId]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  const completeMission = useCallback(
    async (scope: MissionScope, missionId: string) => {
      if (!userId) return null;
      try {
        const result = await completeGamifiedMission(userId, scope, missionId, safeHandle);
        setSnapshot(result.snapshot);
        if (result.reward) setLatestReward(result.reward);
        setError("");
        return result.snapshot;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Mission deploy failed.";
        setError(message);
        toast({
          title: "Mission deploy failed",
          description: message,
        });
        return null;
      }
    },
    [safeHandle, userId]
  );

  const submitQuizAnswer = useCallback(
    async (questionId: string, optionId: string) => {
      if (!userId) return null;
      try {
        const result = await submitGamifiedQuizAnswer(userId, questionId, optionId, safeHandle);
        setSnapshot(result.snapshot);
        if (result.reward) setLatestReward(result.reward);
        setError("");
        return result.answer;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Quiz submission failed.";
        setError(message);
        toast({
          title: "Quiz uplink failed",
          description: message,
        });
        return null;
      }
    },
    [safeHandle, userId]
  );

  return {
    snapshot,
    loading,
    error,
    latestReward,
    refresh,
    clearLatestReward: () => setLatestReward(null),
    completeMission,
    submitQuizAnswer,
  };
};

export class GamificationSystem {
  static load = loadGamificationSnapshot;
  static completeMission = completeGamifiedMission;
  static submitQuizAnswer = submitGamifiedQuizAnswer;
}

export default GamificationSystem;
