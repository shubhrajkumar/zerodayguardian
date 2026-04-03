import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import webpush from "web-push";
import { env } from "../config/env.mjs";
import { getDb } from "../config/db.mjs";
import { User } from "../models/User.mjs";
import { createNotification } from "./notificationService.mjs";
import { logInfo, logWarn, redact } from "../utils/logger.mjs";
import mongoose from "mongoose";

const PUSH_COLLECTION = "growth_push_subscriptions";
const DIGEST_COLLECTION = "growth_digest_preferences";
const FREEZE_COLLECTION = "growth_streak_freezes";
const CERT_COLLECTION = "growth_user_certifications";
const CTF_COLLECTION = "growth_ctf_events";
const CTF_SUBMISSION_COLLECTION = "growth_ctf_submissions";
const GITHUB_COLLECTION = "growth_github_integrations";
const BILLING_COLLECTION = "growth_billing_subscriptions";

const RETRYABLE_ERROR_CODES = new Set(["db_unavailable", "MongoNetworkError", "MongoServerSelectionError"]);
const PREMIUM_PLAN_FEATURES = {
  free: ["daily briefs", "guided labs", "basic referrals", "public profile"],
  premium: ["AI reviews", "weekly CTF priority", "advanced certification paths", "push alerts", "digest automations"],
  team: ["shared billing", "priority events", "operator digests", "team analytics", "managed automation"],
};

const CERTIFICATION_CATALOG = [
  {
    id: "ceh",
    title: "CEH Operator Path",
    provider: "EC-Council aligned",
    premium: false,
    summary: "Offensive workflow coverage for recon, exploitation logic, persistence, and reporting discipline.",
    milestones: [
      { id: "recon", title: "Recon & enumeration", xp: 120 },
      { id: "web", title: "Web exploitation labs", xp: 140 },
      { id: "reporting", title: "Reporting & remediation", xp: 100 },
    ],
  },
  {
    id: "cissp",
    title: "CISSP Strategic Path",
    provider: "ISC2 aligned",
    premium: true,
    summary: "Leadership-oriented track for risk, security operations, governance, and architecture decision making.",
    milestones: [
      { id: "risk", title: "Risk and governance", xp: 150 },
      { id: "ops", title: "Security operations", xp: 160 },
      { id: "architecture", title: "Architecture & identity", xp: 180 },
    ],
  },
  {
    id: "comptia",
    title: "CompTIA Defender Path",
    provider: "Security+ / CySA+ aligned",
    premium: false,
    summary: "Hands-on blue-team path across endpoint triage, alert handling, and defensive hardening.",
    milestones: [
      { id: "triage", title: "Incident triage", xp: 110 },
      { id: "hardening", title: "Hardening & controls", xp: 130 },
      { id: "detection", title: "Detection engineering", xp: 150 },
    ],
  },
];

const BILLING_PLANS = [
  { id: "free", name: "Free", priceMonthly: 0, priceId: "", features: PREMIUM_PLAN_FEATURES.free },
  { id: "premium", name: "Premium", priceMonthly: 24, priceId: env.stripePremiumPriceId, features: PREMIUM_PLAN_FEATURES.premium },
  { id: "team", name: "Team", priceMonthly: 99, priceId: env.stripeTeamPriceId, features: PREMIUM_PLAN_FEATURES.team },
];

const sha256 = (value = "") => createHash("sha256").update(String(value)).digest("hex");
const nowIso = () => new Date().toISOString();

const isoWeekKey = (date = new Date()) => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const startOfDayUtc = (date = new Date()) => {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
};

const withRetry = async (label, task, attempts = 3) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const code = String(error?.code || error?.name || "");
      if (attempt >= attempts || !RETRYABLE_ERROR_CODES.has(code)) throw error;
      logWarn(`${label} failed, retrying`, { attempt, code, message: error?.message || String(error) });
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }
  throw lastError;
};

const pushConfigured = () => Boolean(env.pushVapidPublicKey && env.pushVapidPrivateKey && env.pushVapidSubject);

if (pushConfigured()) {
  webpush.setVapidDetails(env.pushVapidSubject, env.pushVapidPublicKey, env.pushVapidPrivateKey);
}

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;
const digestTransport =
  env.digestEmailEnabled && env.digestEmailUser && env.digestEmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.digestEmailUser, pass: env.digestEmailAppPassword },
      })
    : null;

const mapMilestones = (path, progress = {}) =>
  path.milestones.map((milestone) => ({
    ...milestone,
    completed: Boolean(progress?.[milestone.id]?.completed),
    completedAt: progress?.[milestone.id]?.completedAt || null,
  }));

const getUser = async (userId) => {
  const subject = String(userId || "").trim();
  if (!subject) return null;
  if (mongoose.Types.ObjectId.isValid(subject)) {
    const byId = await User.findById(subject).lean();
    if (byId) return byId;
  }
  return null;
};

const getBillingRecord = async (userId) => {
  const db = getDb();
  const existing = await db.collection(BILLING_COLLECTION).findOne({ userId: String(userId) });
  if (existing) return existing;
  const created = {
    userId: String(userId),
    planId: "free",
    status: "active",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    lastCheckoutSessionId: "",
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };
  await db.collection(BILLING_COLLECTION).insertOne(created);
  return created;
};

const withGrowthFallback = async (task, fallback) => {
  try {
    return await task();
  } catch (error) {
    logWarn("Growth overview dependency degraded", {
      code: String(error?.code || error?.name || "unknown"),
      message: String(error?.message || error || "unknown_error"),
    });
    return typeof fallback === "function" ? fallback() : fallback;
  }
};

export const getPushConfig = () => ({
  enabled: pushConfigured(),
  publicKey: env.pushVapidPublicKey || "",
});

export const savePushSubscription = async ({ userId, subscription }) =>
  withRetry("save_push_subscription", async () => {
    if (!pushConfigured()) {
      const error = new Error("Push notifications are not configured");
      error.statusCode = 424;
      error.code = "push_not_configured";
      throw error;
    }
    const db = getDb();
    await db.collection(PUSH_COLLECTION).updateOne(
      { userId: String(userId), endpoint: String(subscription?.endpoint || "") },
      {
        $set: {
          userId: String(userId),
          endpoint: String(subscription?.endpoint || ""),
          keys: subscription?.keys || {},
          expirationTime: subscription?.expirationTime || null,
          updatedAt: nowIso(),
        },
        $setOnInsert: { createdAt: nowIso() },
      },
      { upsert: true }
    );
    return { ok: true };
  });

export const sendPushToUser = async ({ userId, title, body, url = "/dashboard" }) =>
  withRetry("send_push_to_user", async () => {
    if (!pushConfigured()) {
      const error = new Error("Push notifications are not configured");
      error.statusCode = 424;
      error.code = "push_not_configured";
      throw error;
    }
    const db = getDb();
    const subscriptions = await db.collection(PUSH_COLLECTION).find({ userId: String(userId) }).toArray();
    if (!subscriptions.length) {
      const error = new Error("No push subscription found for user");
      error.statusCode = 404;
      error.code = "push_subscription_missing";
      throw error;
    }

    const payload = JSON.stringify({ title, body, url, icon: "/favicon.ico", badge: "/favicon.ico", ts: nowIso() });
    let delivered = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, expirationTime: subscription.expirationTime || null, keys: subscription.keys || {} },
          payload
        );
        delivered += 1;
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        logWarn("Push delivery failed", { userId: String(userId), endpoint: redact(subscription.endpoint), statusCode });
        if ([404, 410].includes(statusCode)) await db.collection(PUSH_COLLECTION).deleteOne({ _id: subscription._id });
      }
    }

    await createNotification({
      userId,
      title,
      message: body,
      type: "push",
      severity: "info",
      metadata: { delivered, url },
    });
    return { delivered };
  });

export const getDigestPreference = async ({ userId, fallbackEmail = "" }) =>
  withRetry("get_digest_preference", async () => {
    const db = getDb();
    const existing = await db.collection(DIGEST_COLLECTION).findOne({ userId: String(userId) });
    if (existing) return existing;
    const created = {
      userId: String(userId),
      enabled: true,
      email: fallbackEmail || "",
      lastSentAt: null,
      updatedAt: nowIso(),
      createdAt: nowIso(),
    };
    await db.collection(DIGEST_COLLECTION).insertOne(created);
    return created;
  });

export const updateDigestPreference = async ({ userId, email, enabled }) =>
  withRetry("update_digest_preference", async () => {
    const db = getDb();
    const next = {
      userId: String(userId),
      email: String(email || "").trim(),
      enabled: Boolean(enabled),
      updatedAt: nowIso(),
    };
    await db.collection(DIGEST_COLLECTION).updateOne(
      { userId: String(userId) },
      { $set: next, $setOnInsert: { createdAt: nowIso(), lastSentAt: null } },
      { upsert: true }
    );
    return getDigestPreference({ userId, fallbackEmail: next.email });
  });

const buildDigestHtml = ({ name, ctfEvent, certificationSummary, streakState, billing }) => `
  <div style="font-family:Arial,sans-serif;background:#07111f;color:#eef6ff;padding:24px">
    <h1 style="margin:0 0 12px;color:#7dd3fc">ZeroDay Guardian Weekly Brief</h1>
    <p style="margin:0 0 16px">Hello ${name || "Operator"}, here is your weekly cyber briefing.</p>
    <ul>
      <li>Streak freezes available: ${Number(streakState?.available || 0)}</li>
      <li>Current plan: ${String(billing?.planId || "free")}</li>
      <li>Active CTF: ${ctfEvent?.title || "No live event"}</li>
      <li>Recommended certification focus: ${certificationSummary || "Continue your current path"}</li>
    </ul>
    <p style="margin-top:16px">Log in to review new missions, claim rewards, and keep momentum alive.</p>
  </div>
`;

export const sendWeeklyDigestToUser = async ({ userId }) =>
  withRetry("send_weekly_digest_to_user", async () => {
    if (!digestTransport) {
      const error = new Error("Digest email is not configured");
      error.statusCode = 424;
      error.code = "digest_not_configured";
      throw error;
    }

    const user = await getUser(userId);
    const preference = await getDigestPreference({ userId, fallbackEmail: user?.email || "" });
    if (!preference.enabled) {
      const error = new Error("Weekly digest is disabled");
      error.statusCode = 409;
      error.code = "digest_disabled";
      throw error;
    }
    if (!preference.email) {
      const error = new Error("No digest email set for user");
      error.statusCode = 400;
      error.code = "digest_email_missing";
      throw error;
    }

    const streakState = await getStreakFreezeState({ userId });
    const certifications = await getCertificationPaths({ userId });
    const ctfEvent = await getWeeklyCtfEvent({ userId });
    const billing = await getBillingRecord(userId);
    const activePath = certifications.find((item) => item.enrolledAt) || certifications[0];

    await digestTransport.sendMail({
      from: `${env.digestEmailFromName} <${env.digestEmailFrom || env.digestEmailUser}>`,
      to: preference.email,
      subject: "Your ZeroDay Guardian Weekly Brief",
      html: buildDigestHtml({
        name: user?.name || "Operator",
        ctfEvent,
        certificationSummary: activePath?.title || "",
        streakState,
        billing,
      }),
    });

    const db = getDb();
    await db.collection(DIGEST_COLLECTION).updateOne(
      { userId: String(userId) },
      { $set: { lastSentAt: nowIso(), updatedAt: nowIso() } }
    );
    await createNotification({
      userId,
      title: "Weekly digest sent",
      message: `Your digest was delivered to ${preference.email}.`,
      type: "digest",
      severity: "success",
    });
    return { ok: true, email: preference.email, sentAt: nowIso() };
  });

export const processWeeklyDigests = async () =>
  withRetry("process_weekly_digests", async () => {
    const db = getDb();
    const prefs = await db.collection(DIGEST_COLLECTION).find({ enabled: true, email: { $ne: "" } }).toArray();
    const results = [];
    for (const preference of prefs) {
      try {
        const sent = await sendWeeklyDigestToUser({ userId: preference.userId });
        results.push({ userId: preference.userId, ok: true, sent });
      } catch (error) {
        results.push({ userId: preference.userId, ok: false, reason: error?.message || String(error) });
      }
    }
    return { processed: results.length, results };
  });

export const getStreakFreezeState = async ({ userId }) =>
  withRetry("get_streak_freeze_state", async () => {
    const db = getDb();
    const weekKey = isoWeekKey();
    const existing = await db.collection(FREEZE_COLLECTION).findOne({ userId: String(userId) });
    if (!existing) {
      const created = {
        userId: String(userId),
        available: 1,
        grantedWeekKey: weekKey,
        history: [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await db.collection(FREEZE_COLLECTION).insertOne(created);
      return created;
    }
    if (existing.grantedWeekKey !== weekKey) {
      const available = Math.min(1, Number(existing.available || 0) + 1);
      await db.collection(FREEZE_COLLECTION).updateOne(
        { userId: String(userId) },
        { $set: { available, grantedWeekKey: weekKey, updatedAt: nowIso() } }
      );
      existing.available = available;
      existing.grantedWeekKey = weekKey;
    }
    return existing;
  });

export const consumeStreakFreeze = async ({ userId, reason = "manual_protection" }) =>
  withRetry("consume_streak_freeze", async () => {
    const db = getDb();
    const state = await getStreakFreezeState({ userId });
    if (Number(state.available || 0) < 1) {
      const error = new Error("No streak freeze available this week");
      error.statusCode = 409;
      error.code = "streak_freeze_unavailable";
      throw error;
    }
    const entry = { at: nowIso(), reason: String(reason || "manual_protection") };
    await db.collection(FREEZE_COLLECTION).updateOne(
      { userId: String(userId) },
      { $inc: { available: -1 }, $push: { history: entry }, $set: { updatedAt: nowIso() } }
    );
    await createNotification({
      userId,
      title: "Streak freeze activated",
      message: "Your weekly freeze has been reserved to protect momentum.",
      type: "streak",
      severity: "success",
    });
    return getStreakFreezeState({ userId });
  });

export const getCertificationPaths = async ({ userId }) =>
  withRetry("get_certification_paths", async () => {
    const db = getDb();
    const progressDocs = await db.collection(CERT_COLLECTION).find({ userId: String(userId) }).toArray();
    const byPath = new Map(progressDocs.map((item) => [item.pathId, item]));
    return CERTIFICATION_CATALOG.map((path) => {
      const progress = byPath.get(path.id);
      const milestones = mapMilestones(path, progress?.milestones || {});
      const completedCount = milestones.filter((item) => item.completed).length;
      return {
        ...path,
        milestones,
        completedCount,
        completionPct: Math.round((completedCount / path.milestones.length) * 100),
        enrolledAt: progress?.enrolledAt || null,
        premiumLocked: path.premium,
      };
    });
  });

export const enrollCertificationPath = async ({ userId, pathId }) =>
  withRetry("enroll_certification_path", async () => {
    const path = CERTIFICATION_CATALOG.find((item) => item.id === pathId);
    if (!path) {
      const error = new Error("Certification path not found");
      error.statusCode = 404;
      error.code = "certification_path_not_found";
      throw error;
    }
    const db = getDb();
    await db.collection(CERT_COLLECTION).updateOne(
      { userId: String(userId), pathId: String(pathId) },
      {
        $setOnInsert: {
          userId: String(userId),
          pathId: String(pathId),
          milestones: {},
          enrolledAt: nowIso(),
          createdAt: nowIso(),
        },
        $set: { updatedAt: nowIso() },
      },
      { upsert: true }
    );
    await createNotification({
      userId,
      title: "Certification path started",
      message: `${path.title} is now active in your roadmap.`,
      type: "achievement",
      severity: "success",
    });
    return getCertificationPaths({ userId });
  });

export const updateCertificationMilestone = async ({ userId, pathId, milestoneId, completed }) =>
  withRetry("update_certification_milestone", async () => {
    const path = CERTIFICATION_CATALOG.find((item) => item.id === pathId);
    const milestone = path?.milestones.find((item) => item.id === milestoneId);
    if (!path || !milestone) {
      const error = new Error("Certification milestone not found");
      error.statusCode = 404;
      error.code = "certification_milestone_not_found";
      throw error;
    }
    const db = getDb();
    await db.collection(CERT_COLLECTION).updateOne(
      { userId: String(userId), pathId: String(pathId) },
      {
        $set: { [`milestones.${milestoneId}`]: { completed: Boolean(completed), completedAt: completed ? nowIso() : null }, updatedAt: nowIso() },
        $setOnInsert: { userId: String(userId), pathId: String(pathId), enrolledAt: nowIso(), createdAt: nowIso() },
      },
      { upsert: true }
    );
    if (completed) {
      await createNotification({
        userId,
        title: "Certification milestone cleared",
        message: `${milestone.title} is complete in ${path.title}.`,
        type: "achievement",
        severity: "success",
      });
    }
    return getCertificationPaths({ userId });
  });

const defaultCtfChallenges = (weekKey) => [
  {
    id: `${weekKey}-web`,
    title: "Web foothold",
    category: "web",
    prompt: "Identify the vulnerable request pattern and recover the operator flag.",
    flagHash: sha256(`ZDG{${weekKey}-WEB-FOOTHOLD}`),
    points: 150,
  },
  {
    id: `${weekKey}-osint`,
    title: "OSINT pivot",
    category: "osint",
    prompt: "Correlate the leaked alias with infrastructure evidence and submit the flag.",
    flagHash: sha256(`ZDG{${weekKey}-OSINT-PIVOT}`),
    points: 120,
  },
  {
    id: `${weekKey}-forensics`,
    title: "Forensics chain",
    category: "forensics",
    prompt: "Trace the execution chain from the memory clue and recover the final flag.",
    flagHash: sha256(`ZDG{${weekKey}-FORENSICS-CHAIN}`),
    points: 180,
  },
];

const sanitizeCtfEvent = (event, submissionSummary = []) => ({
  id: String(event._id || ""),
  weekKey: event.weekKey,
  title: event.title,
  summary: event.summary,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  joined: Boolean(event.participants?.includes?.(String(submissionSummary.userId || ""))),
  challenges: (event.challenges || []).map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    prompt: item.prompt,
    points: item.points,
  })),
  submissions: submissionSummary.items || [],
  leaderboard: event.leaderboard || [],
});

const ensureWeeklyCtfEventInternal = async () => {
  const db = getDb();
  const weekKey = isoWeekKey();
  const existing = await db.collection(CTF_COLLECTION).findOne({ weekKey });
  if (existing) return existing;
  const now = new Date();
  const start = startOfDayUtc(now);
  const end = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000) - 1000);
  const created = {
    weekKey,
    title: `Weekly CTF ${weekKey}`,
    summary: "Fresh weekly competitive range with verified flags, real submissions, and leaderboard pressure.",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    challenges: defaultCtfChallenges(weekKey),
    participants: [],
    leaderboard: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await db.collection(CTF_COLLECTION).insertOne(created);
  return db.collection(CTF_COLLECTION).findOne({ weekKey });
};

export const getWeeklyCtfEvent = async ({ userId }) =>
  withRetry("get_weekly_ctf_event", async () => {
    const db = getDb();
    const event = await ensureWeeklyCtfEventInternal();
    const submissions = await db
      .collection(CTF_SUBMISSION_COLLECTION)
      .find({ userId: String(userId), eventId: String(event._id) })
      .sort({ createdAt: -1 })
      .toArray();
    return sanitizeCtfEvent(event, {
      userId: String(userId),
      items: submissions.map((item) => ({
        challengeId: item.challengeId,
        correct: item.correct,
        submittedAt: item.createdAt,
        pointsAwarded: item.pointsAwarded || 0,
      })),
    });
  });

export const joinWeeklyCtfEvent = async ({ userId }) =>
  withRetry("join_weekly_ctf_event", async () => {
    const db = getDb();
    const event = await ensureWeeklyCtfEventInternal();
    await db.collection(CTF_COLLECTION).updateOne(
      { _id: event._id },
      { $addToSet: { participants: String(userId) }, $set: { updatedAt: nowIso() } }
    );
    await createNotification({
      userId,
      title: "Weekly CTF joined",
      message: `${event.title} is now live in your dashboard.`,
      type: "mission",
      severity: "success",
    });
    return getWeeklyCtfEvent({ userId });
  });

export const submitWeeklyCtfFlag = async ({ userId, challengeId, flag }) =>
  withRetry("submit_weekly_ctf_flag", async () => {
    const db = getDb();
    const event = await ensureWeeklyCtfEventInternal();
    const challenge = (event.challenges || []).find((item) => item.id === challengeId);
    if (!challenge) {
      const error = new Error("Challenge not found");
      error.statusCode = 404;
      error.code = "ctf_challenge_not_found";
      throw error;
    }
    const normalizedFlag = String(flag || "").trim();
    const correct = sha256(normalizedFlag) === challenge.flagHash;
    const alreadyCorrect = await db.collection(CTF_SUBMISSION_COLLECTION).findOne({
      userId: String(userId),
      eventId: String(event._id),
      challengeId: String(challengeId),
      correct: true,
    });

    const pointsAwarded = correct && !alreadyCorrect ? Number(challenge.points || 0) : 0;
    await db.collection(CTF_SUBMISSION_COLLECTION).insertOne({
      userId: String(userId),
      eventId: String(event._id),
      challengeId: String(challengeId),
      correct,
      pointsAwarded,
      createdAt: nowIso(),
    });

    if (pointsAwarded > 0) {
      const user = await getUser(userId);
      const currentLeaderboard = Array.isArray(event.leaderboard) ? [...event.leaderboard] : [];
      const existingIndex = currentLeaderboard.findIndex((item) => item.userId === String(userId));
      if (existingIndex >= 0) currentLeaderboard[existingIndex].score += pointsAwarded;
      else currentLeaderboard.push({ userId: String(userId), name: user?.name || "Operator", score: pointsAwarded });
      currentLeaderboard.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
      await db.collection(CTF_COLLECTION).updateOne(
        { _id: event._id },
        { $set: { leaderboard: currentLeaderboard.slice(0, 20), updatedAt: nowIso() } }
      );
      await createNotification({
        userId,
        title: "CTF flag accepted",
        message: `${challenge.title} cleared for ${pointsAwarded} points.`,
        type: "achievement",
        severity: "success",
      });
    }

    return { correct, pointsAwarded, event: await getWeeklyCtfEvent({ userId }) };
  });

export const getGithubIntegration = async ({ userId }) =>
  withRetry("get_github_integration", async () => {
    const db = getDb();
    return (
      (await db.collection(GITHUB_COLLECTION).findOne({ userId: String(userId) })) || {
        userId: String(userId),
        owner: "",
        repo: "",
        defaultBranch: "main",
        updatedAt: null,
      }
    );
  });

export const saveGithubIntegration = async ({ userId, owner, repo, defaultBranch = "main" }) =>
  withRetry("save_github_integration", async () => {
    const db = getDb();
    const payload = {
      userId: String(userId),
      owner: String(owner || "").trim(),
      repo: String(repo || "").trim(),
      defaultBranch: String(defaultBranch || "main").trim(),
      updatedAt: nowIso(),
    };
    await db.collection(GITHUB_COLLECTION).updateOne(
      { userId: String(userId) },
      { $set: payload, $setOnInsert: { createdAt: nowIso() } },
      { upsert: true }
    );
    return payload;
  });

export const reviewGithubPullRequest = async ({ userId, pullNumber }) =>
  withRetry("review_github_pull_request", async () => {
    if (!env.githubApiToken) {
      const error = new Error("GitHub API token is not configured");
      error.statusCode = 424;
      error.code = "github_not_configured";
      throw error;
    }
    const integration = await getGithubIntegration({ userId });
    if (!integration.owner || !integration.repo) {
      const error = new Error("GitHub repository is not connected");
      error.statusCode = 400;
      error.code = "github_repo_missing";
      throw error;
    }

    const headers = {
      Authorization: `Bearer ${env.githubApiToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ZeroDayGuardian",
    };
    const prResponse = await fetch(
      `https://api.github.com/repos/${integration.owner}/${integration.repo}/pulls/${Number(pullNumber)}`,
      { headers }
    );
    if (!prResponse.ok) {
      const error = new Error(`GitHub PR fetch failed with ${prResponse.status}`);
      error.statusCode = prResponse.status;
      error.code = "github_pr_fetch_failed";
      throw error;
    }
    const filesResponse = await fetch(
      `https://api.github.com/repos/${integration.owner}/${integration.repo}/pulls/${Number(pullNumber)}/files`,
      { headers }
    );
    if (!filesResponse.ok) {
      const error = new Error(`GitHub files fetch failed with ${filesResponse.status}`);
      error.statusCode = filesResponse.status;
      error.code = "github_pr_files_failed";
      throw error;
    }

    const pr = await prResponse.json();
    const files = await filesResponse.json();
    const touchedSecrets = files.filter((item) => /env|secret|auth|token|config/i.test(String(item.filename || "")));
    const touchedInfra = files.filter((item) => /docker|terraform|workflow|deploy|ci/i.test(String(item.filename || "")));
    const riskScore = Math.min(100, touchedSecrets.length * 30 + touchedInfra.length * 20 + Math.min(30, files.length * 3));
    const findings = [
      ...(touchedSecrets.length ? [`Security-sensitive files changed: ${touchedSecrets.map((item) => item.filename).slice(0, 4).join(", ")}`] : []),
      ...(touchedInfra.length ? [`Deployment-impacting files changed: ${touchedInfra.map((item) => item.filename).slice(0, 4).join(", ")}`] : []),
      ...(files.length > 15 ? ["Large PR surface area increases regression risk and review latency."] : []),
    ];

    const review = {
      repository: `${integration.owner}/${integration.repo}`,
      pullNumber: Number(pullNumber),
      title: String(pr.title || ""),
      url: String(pr.html_url || ""),
      riskScore,
      summary:
        findings[0] ||
        "No high-risk file categories were detected, but you should still validate authentication, secrets, and rollout behavior.",
      findings,
      files: files.slice(0, 20).map((item) => ({
        filename: item.filename,
        status: item.status,
        additions: item.additions,
        deletions: item.deletions,
      })),
      reviewedAt: nowIso(),
    };

    await createNotification({
      userId,
      title: "GitHub review generated",
      message: `PR #${Number(pullNumber)} was analyzed with a risk score of ${riskScore}.`,
      type: "mission",
      severity: riskScore >= 60 ? "warning" : "info",
      metadata: { review },
    });
    return review;
  });

export const getBillingPlans = async ({ userId }) => {
  const current = await getBillingRecord(userId);
  return {
    plans: BILLING_PLANS.map((plan) => ({
      ...plan,
      current: current.planId === plan.id,
      checkoutReady: plan.id === "free" ? true : Boolean(plan.priceId && stripe),
    })),
    subscription: current,
  };
};

export const createBillingCheckoutSession = async ({ userId, planId }) =>
  withRetry("create_billing_checkout_session", async () => {
    const plan = BILLING_PLANS.find((item) => item.id === planId);
    if (!plan || plan.id === "free") {
      const error = new Error("A paid plan is required for checkout");
      error.statusCode = 400;
      error.code = "billing_plan_invalid";
      throw error;
    }
    if (!stripe || !plan.priceId) {
      const error = new Error("Stripe billing is not configured");
      error.statusCode = 424;
      error.code = "billing_not_configured";
      throw error;
    }
    const user = await getUser(userId);
    const current = await getBillingRecord(userId);
    let customerId = current.stripeCustomerId || "";
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        name: user?.name || undefined,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${env.appBaseUrl.replace(/\/+$/, "")}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appBaseUrl.replace(/\/+$/, "")}/dashboard?checkout=cancelled`,
      metadata: { userId: String(userId), planId: String(planId) },
      allow_promotion_codes: true,
    });
    const db = getDb();
    await db.collection(BILLING_COLLECTION).updateOne(
      { userId: String(userId) },
      {
        $set: {
          stripeCustomerId: customerId,
          lastCheckoutSessionId: session.id,
          pendingPlanId: plan.id,
          status: "checkout_pending",
          updatedAt: nowIso(),
        },
        $setOnInsert: { createdAt: nowIso(), planId: "free" },
      },
      { upsert: true }
    );
    return { url: session.url, sessionId: session.id };
  });

export const syncBillingCheckoutSession = async ({ userId, sessionId }) =>
  withRetry("sync_billing_checkout_session", async () => {
    if (!stripe) {
      const error = new Error("Stripe billing is not configured");
      error.statusCode = 424;
      error.code = "billing_not_configured";
      throw error;
    }
    const session = await stripe.checkout.sessions.retrieve(String(sessionId), { expand: ["subscription"] });
    if (String(session.metadata?.userId || "") !== String(userId)) {
      const error = new Error("Checkout session does not belong to this user");
      error.statusCode = 403;
      error.code = "billing_session_forbidden";
      throw error;
    }
    const paid = session.status === "complete" && session.mode === "subscription";
    const nextPlan = String(session.metadata?.planId || "free");
    const db = getDb();
    await db.collection(BILLING_COLLECTION).updateOne(
      { userId: String(userId) },
      {
        $set: {
          planId: paid ? nextPlan : "free",
          status: paid ? "active" : "checkout_pending",
          stripeCustomerId: String(session.customer || ""),
          stripeSubscriptionId: String(session.subscription?.id || session.subscription || ""),
          lastCheckoutSessionId: String(session.id || ""),
          updatedAt: nowIso(),
        },
        $unset: { pendingPlanId: "" },
      },
      { upsert: true }
    );
    if (paid) {
      await createNotification({
        userId,
        title: "Subscription activated",
        message: `Your ${nextPlan} subscription is now active.`,
        type: "achievement",
        severity: "success",
      });
    }
    return getBillingRecord(userId);
  });

export const createBillingPortalSession = async ({ userId }) =>
  withRetry("create_billing_portal_session", async () => {
    if (!stripe) {
      const error = new Error("Stripe billing is not configured");
      error.statusCode = 424;
      error.code = "billing_not_configured";
      throw error;
    }
    const billing = await getBillingRecord(userId);
    if (!billing.stripeCustomerId) {
      const error = new Error("No Stripe customer exists for this user");
      error.statusCode = 404;
      error.code = "billing_customer_missing";
      throw error;
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: env.stripePortalReturnUrl || `${env.appBaseUrl.replace(/\/+$/, "")}/dashboard`,
    });
    return { url: session.url };
  });

export const getPlatformGrowthOverview = async ({ userId }) => {
  const defaultBilling = {
    userId: String(userId),
    planId: "free",
    status: "active",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    lastCheckoutSessionId: "",
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };
  const defaultDigest = {
    userId: String(userId),
    enabled: false,
    email: "",
    lastSentAt: null,
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };
  const defaultFreeze = {
    userId: String(userId),
    available: 0,
    grantedWeekKey: isoWeekKey(),
    history: [],
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };
  const defaultCtf = {
    id: "",
    weekKey: isoWeekKey(),
    title: "Weekly CTF unavailable",
    summary: "CTF data is temporarily unavailable.",
    startsAt: nowIso(),
    endsAt: nowIso(),
    joined: false,
    challenges: [],
    submissions: [],
    leaderboard: [],
  };
  const defaultGithub = {
    userId: String(userId),
    owner: "",
    repo: "",
    defaultBranch: "main",
    updatedAt: null,
  };

  const [user, pushPreference, digestPreference, streakFreeze, certifications, ctfEvent, github, billing] = await Promise.all([
    withGrowthFallback(() => getUser(userId), null),
    withGrowthFallback(
      () => withRetry("count_push_subscriptions", async () => getDb().collection(PUSH_COLLECTION).countDocuments({ userId: String(userId) })),
      0
    ),
    withGrowthFallback(() => getDigestPreference({ userId }), defaultDigest),
    withGrowthFallback(() => getStreakFreezeState({ userId }), defaultFreeze),
    withGrowthFallback(() => getCertificationPaths({ userId }), []),
    withGrowthFallback(() => getWeeklyCtfEvent({ userId }), defaultCtf),
    withGrowthFallback(() => getGithubIntegration({ userId }), defaultGithub),
    withGrowthFallback(() => getBillingRecord(userId), defaultBilling),
  ]);

  return {
    user: {
      id: String(user?._id || userId),
      name: String(user?.name || "Operator"),
      email: String(user?.email || ""),
    },
    push: {
      configured: pushConfigured(),
      subscriptions: Number(pushPreference || 0),
      publicKey: env.pushVapidPublicKey || "",
    },
    digest: {
      enabled: Boolean(digestPreference.enabled),
      email: String(digestPreference.email || user?.email || ""),
      lastSentAt: digestPreference.lastSentAt || null,
      configured: Boolean(digestTransport),
    },
    streakFreeze: {
      available: Number(streakFreeze.available || 0),
      grantedWeekKey: streakFreeze.grantedWeekKey,
      history: Array.isArray(streakFreeze.history) ? streakFreeze.history : [],
    },
    certifications,
    ctfEvent,
    github: {
      connected: Boolean(github.owner && github.repo),
      owner: github.owner || "",
      repo: github.repo || "",
      defaultBranch: github.defaultBranch || "main",
      reviewConfigured: Boolean(env.githubApiToken),
    },
    billing: {
      ...billing,
      plans: BILLING_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        features: plan.features,
        current: billing.planId === plan.id,
        checkoutReady: plan.id === "free" ? true : Boolean(plan.priceId && stripe),
      })),
    },
  };
};

export const generateAdminGrowthSnapshot = async () => {
  const db = getDb();
  const [pushSubscriptions, digestEnabled, activeBilling, activeGithub, ctfCount] = await Promise.all([
    db.collection(PUSH_COLLECTION).countDocuments({}),
    db.collection(DIGEST_COLLECTION).countDocuments({ enabled: true }),
    db.collection(BILLING_COLLECTION).countDocuments({ status: "active", planId: { $ne: "free" } }),
    db.collection(GITHUB_COLLECTION).countDocuments({ owner: { $ne: "" }, repo: { $ne: "" } }),
    db.collection(CTF_COLLECTION).countDocuments({}),
  ]);
  return { pushSubscriptions, digestEnabled, activeBilling, activeGithub, ctfCount, generatedAt: nowIso() };
};

logInfo("Platform growth service ready", {
  pushConfigured: pushConfigured(),
  digestConfigured: Boolean(digestTransport),
  stripeConfigured: Boolean(stripe),
  githubConfigured: Boolean(env.githubApiToken),
});
