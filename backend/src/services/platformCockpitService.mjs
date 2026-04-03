import { getDashboardIntelligence } from "../../services/ai-engine/intelligenceService.mjs";
import { getAdaptiveExperience } from "./adaptiveExperienceService.mjs";

const computeOffenseDefenseEngine = ({ adaptive = null, intelligence = null }) => {
  const dominantIntent = String(adaptive?.profile?.dominantIntents?.[0]?.intent || intelligence?.continueLearning?.intent || "guided_learning");
  const strongest = intelligence?.skillGraph?.strongest?.[0]?.label || "No dominant strength yet";
  const weakest = intelligence?.skillGraph?.weakest?.[0]?.label || "No weak spot detected";
  const offenseWeight =
    /investigation|recon|web-security|threat_hunting/i.test(dominantIntent) ||
    /web|simulation/i.test(String(intelligence?.skillGraph?.strongest?.[0]?.id || ""))
      ? 62
      : 38;
  const defenseWeight = 100 - offenseWeight;

  return {
    mode: offenseWeight >= defenseWeight ? "offense_lead" : "defense_lead",
    offenseWeight,
    defenseWeight,
    summary:
      offenseWeight >= defenseWeight
        ? `Current operator flow leans offensive. Press ${strongest} while containing the weak spot in ${weakest}.`
        : `Current operator flow leans defensive. Use ${strongest} as a control anchor and strengthen ${weakest}.`,
    nextShift:
      offenseWeight >= defenseWeight
        ? "Pair the next offensive move with one remediation or detection checkpoint."
        : "Pair the next defensive move with one attacker-perspective validation step.",
  };
};

const buildExecutiveLoop = ({ adaptive = null, intelligence = null, dashboardStats = null }) => {
  const totalScans = Number(dashboardStats?.totalScans || 0);
  const highRisk = Number(dashboardStats?.riskCounts?.high || 0);
  const xp = Number(intelligence?.xp || 0);
  const streak = Number(intelligence?.streak || 1);
  const mission = adaptive?.profile?.behavioralLoop?.adaptiveMission || null;

  return {
    maturity:
      xp >= 1600 && totalScans >= 8
        ? "elite_operator"
        : xp >= 700 || totalScans >= 4
          ? "scaling_operator"
          : "emerging_operator",
    summary:
      mission?.objective ||
      adaptive?.recommendations?.[0]?.action ||
      intelligence?.continueLearning?.action ||
      "Complete one verified loop and save the result.",
    metrics: {
      xp,
      streak,
      totalScans,
      highRisk,
      momentumScore: Number(adaptive?.profile?.behavioralLoop?.momentumScore || 0),
    },
  };
};

const buildPriorityBoard = ({ adaptive = null, intelligence = null }) => {
  const recommendations = adaptive?.recommendations || [];
  const path = intelligence?.skillGraph?.recommendedPath || [];
  const smartActions = adaptive?.smartActions || [];

  return [
    recommendations[0]
      ? {
          id: "adaptive_priority",
          title: recommendations[0].title,
          detail: recommendations[0].action,
          source: "adaptive_ai",
        }
      : null,
    path[0]
      ? {
          id: "skill_graph_priority",
          title: path[0].label,
          detail: path[0].action,
          source: "skill_graph",
        }
      : null,
    smartActions[0]
      ? {
          id: "smart_action_priority",
          title: smartActions[0].label,
          detail: smartActions[0].description,
          source: "smart_action",
        }
      : null,
  ].filter(Boolean);
};

export const getPlatformCockpit = async ({ actor, dashboardStats = null }) => {
  const [intelligence, adaptive] = await Promise.all([
    getDashboardIntelligence(actor),
    getAdaptiveExperience({ userId: String(actor.userId || ""), dashboardStats }),
  ]);

  return {
    generatedAt: Date.now(),
    operatorState: {
      rank: intelligence?.rank || "Recruit",
      xp: Number(intelligence?.xp || 0),
      streak: Number(intelligence?.streak || 1),
      strongestSkill: intelligence?.skillGraph?.strongest?.[0] || null,
      weakestSkill: intelligence?.skillGraph?.weakest?.[0] || null,
    },
    offenseDefenseEngine: computeOffenseDefenseEngine({ adaptive, intelligence }),
    executiveLoop: buildExecutiveLoop({ adaptive, intelligence, dashboardStats }),
    priorityBoard: buildPriorityBoard({ adaptive, intelligence }),
    adaptive,
    intelligence,
  };
};
