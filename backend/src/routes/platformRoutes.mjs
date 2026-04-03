import express from "express";
import { z } from "zod";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.mjs";
import { requireRole } from "../middleware/auth.mjs";
import { platformArchitecture } from "../config/platform.mjs";
import {
  consumeStreakFreeze,
  createBillingCheckoutSession,
  createBillingPortalSession,
  enrollCertificationPath,
  generateAdminGrowthSnapshot,
  getBillingPlans,
  getPlatformGrowthOverview,
  getPushConfig,
  joinWeeklyCtfEvent,
  processWeeklyDigests,
  reviewGithubPullRequest,
  saveGithubIntegration,
  savePushSubscription,
  sendPushToUser,
  sendWeeklyDigestToUser,
  submitWeeklyCtfFlag,
  syncBillingCheckoutSession,
  updateCertificationMilestone,
  updateDigestPreference,
} from "../services/platformGrowthService.mjs";

const router = express.Router();

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16),
    auth: z.string().min(8),
  }),
});

const digestPreferenceSchema = z.object({
  email: z.string().email(),
  enabled: z.boolean(),
});

const certificationParamsSchema = z.object({
  pathId: z.string().trim().min(2).max(40),
});

const certificationMilestoneParamsSchema = z.object({
  pathId: z.string().trim().min(2).max(40),
  milestoneId: z.string().trim().min(2).max(40),
});

const certificationMilestoneBodySchema = z.object({
  completed: z.boolean(),
});

const ctfSubmissionSchema = z.object({
  challengeId: z.string().trim().min(6).max(120),
  flag: z.string().trim().min(4).max(200),
});

const githubConnectSchema = z.object({
  owner: z.string().trim().min(1).max(120),
  repo: z.string().trim().min(1).max(120),
  defaultBranch: z.string().trim().min(1).max(80).optional().default("main"),
});

const githubReviewSchema = z.object({
  pullNumber: z.number().int().positive(),
});

const checkoutSchema = z.object({
  planId: z.enum(["premium", "team"]),
});

const checkoutSyncSchema = z.object({
  sessionId: z.string().trim().min(8).max(200),
});

const pushTestSchema = z.object({
  title: z.string().trim().min(3).max(120).optional().default("ZeroDay Guardian Push Test"),
  body: z.string().trim().min(3).max(240).optional().default("Your live push pipeline is connected."),
  url: z.string().trim().min(1).max(200).optional().default("/dashboard"),
});

const buildDegradedOverview = (userId = "") => ({
  user: {
    id: String(userId || ""),
    name: "Operator",
    email: "",
  },
  push: {
    configured: false,
    subscriptions: 0,
    publicKey: "",
  },
  digest: {
    enabled: false,
    email: "",
    lastSentAt: null,
    configured: false,
  },
  streakFreeze: {
    available: 0,
    grantedWeekKey: "",
    history: [],
  },
  certifications: [],
  ctfEvent: {
    id: "",
    weekKey: "",
    title: "Weekly CTF unavailable",
    summary: "Platform growth data is temporarily unavailable.",
    startsAt: "",
    endsAt: "",
    joined: false,
    challenges: [],
    submissions: [],
    leaderboard: [],
  },
  github: {
    connected: false,
    owner: "",
    repo: "",
    defaultBranch: "main",
    reviewConfigured: false,
  },
  billing: {
    planId: "free",
    status: "active",
    plans: [],
  },
});

router.get("/architecture", (_req, res) => {
  res.setHeader("Cache-Control", "private, max-age=60");
  res.json({ status: "ok", architecture: platformArchitecture });
});

router.get("/growth/overview", async (req, res, next) => {
  try {
    const overview = await getPlatformGrowthOverview({ userId: req.user.sub });
    res.json({ status: "ok", overview });
  } catch (error) {
    res.json({
      status: "ok",
      degraded: true,
      overview: buildDegradedOverview(req.user?.sub),
    });
  }
});

router.get("/push/config", (_req, res) => {
  res.json({ status: "ok", push: getPushConfig() });
});

router.post("/push/subscribe", validateBody(pushSubscriptionSchema), async (req, res, next) => {
  try {
    const result = await savePushSubscription({ userId: req.user.sub, subscription: req.validatedBody });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/push/test", validateBody(pushTestSchema), async (req, res, next) => {
  try {
    const result = await sendPushToUser({ userId: req.user.sub, ...req.validatedBody });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/digest/preferences", validateBody(digestPreferenceSchema), async (req, res, next) => {
  try {
    const preference = await updateDigestPreference({ userId: req.user.sub, ...req.validatedBody });
    res.json({ status: "ok", preference });
  } catch (error) {
    next(error);
  }
});

router.post("/digest/send-now", async (req, res, next) => {
  try {
    const result = await sendWeeklyDigestToUser({ userId: req.user.sub });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/digest/process", requireRole("admin"), async (req, res, next) => {
  try {
    const result = await processWeeklyDigests();
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/streak-freeze/use", async (req, res, next) => {
  try {
    const result = await consumeStreakFreeze({ userId: req.user.sub });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/certifications/:pathId/enroll", validateParams(certificationParamsSchema), async (req, res, next) => {
  try {
    const result = await enrollCertificationPath({ userId: req.user.sub, pathId: req.validatedParams.pathId });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/certifications/:pathId/milestones/:milestoneId",
  validateParams(certificationMilestoneParamsSchema),
  validateBody(certificationMilestoneBodySchema),
  async (req, res, next) => {
    try {
      const result = await updateCertificationMilestone({
        userId: req.user.sub,
        pathId: req.validatedParams.pathId,
        milestoneId: req.validatedParams.milestoneId,
        completed: req.validatedBody.completed,
      });
      res.json({ status: "ok", result });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/ctf/weekly/join", async (req, res, next) => {
  try {
    const result = await joinWeeklyCtfEvent({ userId: req.user.sub });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/ctf/weekly/submit", validateBody(ctfSubmissionSchema), async (req, res, next) => {
  try {
    const result = await submitWeeklyCtfFlag({ userId: req.user.sub, ...req.validatedBody });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/github/connect", validateBody(githubConnectSchema), async (req, res, next) => {
  try {
    const result = await saveGithubIntegration({ userId: req.user.sub, ...req.validatedBody });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/github/review-pr", validateBody(githubReviewSchema), async (req, res, next) => {
  try {
    const result = await reviewGithubPullRequest({ userId: req.user.sub, pullNumber: req.validatedBody.pullNumber });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.get("/billing/plans", async (req, res, next) => {
  try {
    const result = await getBillingPlans({ userId: req.user.sub });
    res.json({ status: "ok", ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/billing/checkout", validateBody(checkoutSchema), async (req, res, next) => {
  try {
    const result = await createBillingCheckoutSession({ userId: req.user.sub, planId: req.validatedBody.planId });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/billing/sync", validateBody(checkoutSyncSchema), async (req, res, next) => {
  try {
    const result = await syncBillingCheckoutSession({ userId: req.user.sub, sessionId: req.validatedBody.sessionId });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.post("/billing/portal", async (req, res, next) => {
  try {
    const result = await createBillingPortalSession({ userId: req.user.sub });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

router.get("/ops/growth-snapshot", requireRole("admin"), async (req, res, next) => {
  try {
    const snapshot = await generateAdminGrowthSnapshot();
    res.json({ status: "ok", snapshot });
  } catch (error) {
    next(error);
  }
});

router.get("/ops/checkout", validateQuery(z.object({ sessionId: z.string().trim().min(8).max(200) })), async (req, res, next) => {
  try {
    const result = await syncBillingCheckoutSession({ userId: req.user.sub, sessionId: req.validatedQuery.sessionId });
    res.json({ status: "ok", result });
  } catch (error) {
    next(error);
  }
});

export default router;
