const dayMs = 86_400_000;

const todayIso = () => new Date().toISOString().slice(0, 10);

const daysBetweenIso = (fromIso = "", toIso = todayIso()) => {
  if (!fromIso) return 999;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 999;
  return Math.max(0, Math.floor((to - from) / dayMs));
};

const hoursAgo = (timestamp = 0) => {
  if (!timestamp) return 999;
  return Math.max(0, (Date.now() - Number(timestamp || 0)) / 3_600_000);
};

const normalizeMissionType = (intent = "", learningTrack = "") => {
  const text = `${intent} ${learningTrack}`.toLowerCase();
  if (/investigation|osint|intel/.test(text)) return "investigation";
  if (/hardening|web|scan/.test(text)) return "hardening";
  if (/threat|hunt|incident/.test(text)) return "threat_hunt";
  if (/learning|guided|lab|mentor/.test(text)) return "guided_lab";
  return "operator_loop";
};

const buildAdaptiveMission = ({
  dominantIntent = "",
  interestSignals = [],
  learningTrack = "",
  role = "learner",
  streak = 1,
  highRiskCount = 0,
}) => {
  const missionType = normalizeMissionType(dominantIntent, learningTrack);
  const focus = interestSignals[0] || missionType.replace(/_/g, " ");
  const urgency = highRiskCount > 0 ? "high" : streak >= 5 ? "medium" : "normal";

  const titleMap = {
    investigation: "Evidence Correlation Sprint",
    hardening: "Rapid Hardening Loop",
    threat_hunt: "Threat Hunt Mission",
    guided_lab: "Guided Skill Mission",
    operator_loop: "Operator Momentum Mission",
  };

  const objectiveMap = {
    investigation: "Pivot one verified lookup into one confirming signal and document the outcome.",
    hardening: "Run one scan, identify one fix, and re-check the same target.",
    threat_hunt: "Review one threat signal, triage it, and record the next analyst action.",
    guided_lab: "Complete one focused lab or mentor-guided step without switching context.",
    operator_loop: "Finish one complete security workflow before opening a new surface.",
  };

  return {
    missionType,
    title: titleMap[missionType] || titleMap.operator_loop,
    objective: objectiveMap[missionType] || objectiveMap.operator_loop,
    focus,
    urgency,
    recommendedDurationMin: urgency === "high" ? 12 : streak >= 5 ? 18 : 15,
    roleBias: role,
  };
};

const buildReengagementTriggers = ({
  streak = 1,
  daysSinceActive = 0,
  hoursSinceEvent = 0,
  momentumScore = 0,
  dominantIntent = "",
  adaptiveMission = null,
}) => {
  const triggers = [];

  if (daysSinceActive >= 1) {
    triggers.push({
      id: "streak_recovery",
      type: "streak_recovery",
      priority: "high",
      message: `Your streak is at risk. Come back with one short ${adaptiveMission?.missionType?.replace(/_/g, " ") || "security"} action.`,
      recommendedDelayMin: 0,
    });
  }

  if (hoursSinceEvent >= 18 && daysSinceActive === 0) {
    triggers.push({
      id: "same_day_reengage",
      type: "same_day_reengage",
      priority: "medium",
      message: "You still have same-day momentum. Finish one more focused action before the day closes.",
      recommendedDelayMin: 30,
    });
  }

  if (momentumScore < 45) {
    triggers.push({
      id: "low_momentum_nudge",
      type: "low_momentum_nudge",
      priority: "medium",
      message: `Momentum dropped. Re-enter through ${dominantIntent || "your strongest current flow"} with a short, guided step.`,
      recommendedDelayMin: 45,
    });
  }

  if (!triggers.length) {
    triggers.push({
      id: "maintenance_loop",
      type: "maintenance_loop",
      priority: "low",
      message: "Keep the loop alive with one small verified action and one saved takeaway.",
      recommendedDelayMin: 90,
    });
  }

  return triggers.slice(0, 3);
};

export const buildBehavioralLoop = ({
  profile = null,
  recentEvents = [],
  dominantIntents = [],
  interestSignals = [],
  learningTrack = "",
  role = "learner",
  highRiskCount = 0,
  completedLabs = 0,
}) => {
  const lastActiveDay = String(profile?.lastActiveDay || "");
  const streak = Math.max(1, Number(profile?.streak || 1));
  const weeklyPoints = Math.max(0, Number(profile?.weeklyPoints || 0));
  const lastEventAt = Number(recentEvents[0]?.createdAt || 0);
  const daysSinceActive = daysBetweenIso(lastActiveDay);
  const hoursSinceLastEvent = Number(hoursAgo(lastEventAt).toFixed(1));
  const dominantIntent = String(dominantIntents[0]?.intent || "guided_learning");
  const momentumScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        streak * 9 +
          Math.min(28, recentEvents.length * 3) +
          Math.min(18, completedLabs * 4) +
          Math.min(16, weeklyPoints / 20) -
          Math.min(34, daysSinceActive * 18) -
          Math.min(24, Math.floor(hoursSinceLastEvent / 10) * 4)
      )
    )
  );

  const streakState =
    daysSinceActive >= 2 ? "broken" :
    daysSinceActive === 1 ? "at_risk" :
    streak >= 7 ? "hot" :
    streak >= 3 ? "building" :
    "new";

  const adaptiveMission = buildAdaptiveMission({
    dominantIntent,
    interestSignals,
    learningTrack,
    role,
    streak,
    highRiskCount,
  });

  const reengagementTriggers = buildReengagementTriggers({
    streak,
    daysSinceActive,
    hoursSinceEvent: hoursSinceLastEvent,
    momentumScore,
    dominantIntent,
    adaptiveMission,
  });

  return {
    streakState,
    streak,
    momentumScore,
    daysSinceActive,
    hoursSinceLastEvent,
    adaptiveMission,
    reengagementTriggers,
    summary:
      streakState === "broken"
        ? "The user needs a low-friction re-entry path to restart the loop."
        : streakState === "at_risk"
          ? "The user is one missed day away from losing momentum."
          : momentumScore >= 75
            ? "Momentum is strong enough to push a harder adaptive mission."
            : "Keep the next step narrow so the loop stays alive.",
  };
};
