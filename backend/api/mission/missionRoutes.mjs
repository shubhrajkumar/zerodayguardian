import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../src/middleware/auth.mjs";
import { validateBody } from "../../src/middleware/validate.mjs";
import { User } from "../../src/models/User.mjs";

const router = Router();

const RANKS = [
  { name: "Initiate", minScore: 0 },
  { name: "Operator", minScore: 250 },
  { name: "Analyst", minScore: 700 },
  { name: "Guardian", minScore: 1400 },
  { name: "Elite", minScore: 2600 },
];

const MISSIONS = [
  {
    id: "mission-recon-01",
    title: "Surface Mapping",
    objective: "Identify the highest-risk external signal before deeper action.",
    decisionPrompt: "Choose the first move: recon, validation, or containment.",
    evaluationRule: {
      accepted: ["recon", "enumerate", "map", "surface"],
      reason: "Good operators start by reducing uncertainty before acting.",
      risk: "Skipping reconnaissance increases the chance of acting on assumptions.",
      next: "Document the exposed surface and move to validation.",
      scoreDelta: 120,
    },
  },
  {
    id: "mission-validate-02",
    title: "Evidence Check",
    objective: "Validate the strongest hypothesis using the cleanest available evidence.",
    decisionPrompt: "Choose the next move: validate, exploit, or ignore.",
    evaluationRule: {
      accepted: ["validate", "verify", "evidence", "confirm"],
      reason: "Validated signals prevent wasted effort and false confidence.",
      risk: "Jumping ahead without proof can create noisy or unsafe outcomes.",
      next: "Confirm the signal and decide whether escalation is justified.",
      scoreDelta: 150,
    },
  },
  {
    id: "mission-respond-03",
    title: "Controlled Response",
    objective: "Take the smallest decisive action that improves security posture.",
    decisionPrompt: "Choose the response: contain, escalate, or postpone.",
    evaluationRule: {
      accepted: ["contain", "escalate", "respond", "mitigate"],
      reason: "A controlled response protects the environment without unnecessary churn.",
      risk: "Postponing action after validation can increase blast radius.",
      next: "Record the outcome and roll into the next mission.",
      scoreDelta: 180,
    },
  },
];

const decisionSchema = z.object({
  missionId: z.string().min(1).max(120),
  decision: z.string().min(1).max(500),
});

const normalize = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase();

const calcRank = (score = 0) => {
  let rank = RANKS[0].name;
  for (const item of RANKS) {
    if (score >= item.minScore) rank = item.name;
  }
  return rank;
};

const ensureMissionState = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  const progress = user.productProgress || {};
  const mission = progress.mission || {};
  const nextIndex = Math.max(0, Math.min(MISSIONS.length - 1, Number(mission.currentIndex || 0)));
  const completedMissionIds = Array.isArray(mission.completedMissionIds) ? mission.completedMissionIds : [];
  const totalScore = Number(mission.totalScore || 0);

  user.productProgress = {
    ...progress,
    mission: {
      currentIndex: nextIndex,
      currentMissionId: mission.currentMissionId || MISSIONS[nextIndex].id,
      completedMissionIds,
      lastDecision: mission.lastDecision || "",
      lastEvaluation: mission.lastEvaluation || null,
      totalScore,
      rank: mission.rank || calcRank(totalScore),
      updatedAt: mission.updatedAt || new Date().toISOString(),
    },
  };
  await user.save();
  return user;
};

const serializeMissionState = (userDoc) => {
  const mission = userDoc.productProgress?.mission || {};
  const index = Math.max(0, Math.min(MISSIONS.length - 1, Number(mission.currentIndex || 0)));
  const active = MISSIONS[index];
  const completedMissionIds = Array.isArray(mission.completedMissionIds) ? mission.completedMissionIds : [];
  const totalScore = Number(mission.totalScore || 0);
  return {
    status: "ok",
    brand: {
      product: "ZeroDay Guardian",
      assistant: "ZORVIX AI",
    },
    mission: {
      step: `${Math.min(index + 1, MISSIONS.length)}/${MISSIONS.length}`,
      objective: active.objective,
      current: {
        id: active.id,
        title: active.title,
        decisionPrompt: active.decisionPrompt,
      },
      completedMissionIds,
      lastDecision: mission.lastDecision || "",
      lastEvaluation: mission.lastEvaluation || null,
      nextAction: mission.lastEvaluation?.next || active.decisionPrompt,
    },
    progress: {
      totalScore,
      rank: calcRank(totalScore),
      completedCount: completedMissionIds.length,
      percent: Math.round((completedMissionIds.length / MISSIONS.length) * 100),
    },
  };
};

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const user = await ensureMissionState(req.user.sub);
    res.json(serializeMissionState(user));
  } catch (error) {
    next(error);
  }
});

router.post("/decision", requireAuth, validateBody(decisionSchema), async (req, res, next) => {
  try {
    const user = await ensureMissionState(req.user.sub);
    const missionState = user.productProgress?.mission || {};
    const currentIndex = Math.max(0, Math.min(MISSIONS.length - 1, Number(missionState.currentIndex || 0)));
    const current = MISSIONS[currentIndex];

    if (req.validatedBody.missionId !== current.id) {
      res.status(409).json({
        status: "error",
        code: "mission_out_of_sync",
        message: "Mission state changed. Refresh mission status and retry.",
      });
      return;
    }

    const decision = normalize(req.validatedBody.decision);
    const accepted = current.evaluationRule.accepted.some((term) => decision.includes(term));
    const scoreDelta = accepted ? current.evaluationRule.scoreDelta : 0;
    const completedMissionIds = Array.isArray(missionState.completedMissionIds) ? [...missionState.completedMissionIds] : [];
    if (accepted && !completedMissionIds.includes(current.id)) completedMissionIds.push(current.id);

    const nextIndex = accepted ? Math.min(currentIndex + 1, MISSIONS.length - 1) : currentIndex;
    const totalScore = Number(missionState.totalScore || 0) + scoreDelta;
    const evaluation = {
      accepted,
      reasoning: accepted
        ? current.evaluationRule.reason
        : `That move is weak for ${current.title}. Start with the action that reduces uncertainty first.`,
      risk: accepted
        ? current.evaluationRule.risk
        : "This choice leaves the mission without a verified signal and lowers confidence in the next step.",
      next: accepted
        ? current.evaluationRule.next
        : `Retry ${current.title} by choosing a move closer to ${current.evaluationRule.accepted.join(", ")}.`,
      scoreDelta,
    };

    user.productProgress = {
      ...(user.productProgress || {}),
      mission: {
        currentIndex: nextIndex,
        currentMissionId: MISSIONS[nextIndex].id,
        completedMissionIds,
        lastDecision: req.validatedBody.decision,
        lastEvaluation: evaluation,
        totalScore,
        rank: calcRank(totalScore),
        updatedAt: new Date().toISOString(),
      },
    };
    await user.save();

    res.json({
      ...serializeMissionState(user),
      evaluation,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
