import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lightbulb, Lock, TerminalSquare } from "lucide-react";
import PlatformHero from "@/components/platform/PlatformHero";
import { getPyApiUserMessage, pyGetJson, pyPostJson } from "@/lib/pyApiClient";
import { useAuth } from "@/context/AuthContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useUserProgress } from "@/context/UserProgressContext";

type LabTask = {
  id: string;
  title: string;
  instruction: string;
  expected_type: string;
  hint: string;
  interaction_type: string;
  options: Array<{ label: string; value: string }>;
  validation_focus: string[];
  score: number;
  xp: number;
  completed: boolean;
  attempt_count: number;
};

type LabLearnCard = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  proof_point: string;
  action_label: string;
};

type LabMissionAsset = {
  id: string;
  label: string;
  value: string;
  tone: string;
};

type LabModule = {
  day: number;
  title: string;
  objective: string;
  scenario: string;
  mentor_intro: string;
  example_story: string;
  scenario_tagline: string;
  operator_role: string;
  threat_level: string;
  difficulty: string;
  environment: string;
  mission_brief: string;
  learn_points: string[];
  learn_cards: LabLearnCard[];
  mission_assets: LabMissionAsset[];
  console_boot_lines: string[];
  completion_badge: string;
  primary_action_label: string;
  success_criteria: string[];
  tasks: LabTask[];
  solution_explanation: string[];
  debrief_points: string[];
  next_steps: string[];
  kali_tools: string[];
};

type LabState = {
  day: number;
  unlocked: boolean;
  completed: boolean;
  score: number;
  xp_earned: number;
  attempts: number;
  completed_task_ids: string[];
  terminal_log: string[];
  last_feedback?: string | null;
  difficulty_band: string;
};

type LabDetailResponse = {
  module: LabModule;
  state: LabState;
  recommendation: string;
  mentor_guidance: string;
  current_task_id?: string | null;
  current_stage: string;
};

type LabSubmitResponse = {
  accepted: boolean;
  score_delta: number;
  xp_delta: number;
  task_completed: boolean;
  lab_completed: boolean;
  feedback: string;
  hint?: string | null;
  mentor_guidance: string;
  state: LabState;
  unlocked_next_day?: number | null;
  progress_percent: number;
  next_task_title?: string | null;
  celebration?: string | null;
  terminal_output: string[];
};

type FlowStage = "learn" | "task" | "execute" | "validate" | "completed";

type FlowSnapshot = {
  stage: FlowStage;
  currentTaskId: string | null;
  completedCount: number;
  accepted?: boolean;
  feedback?: string;
  mentorGuidance?: string;
  hint?: string;
  celebration?: string;
  terminalOutput?: string[];
};

type StageFlash = {
  tone: "info" | "success" | "alert";
  title: string;
  detail: string;
};

const ProgramLabPage = () => {
  const navigate = useNavigate();
  const { authState, user } = useAuth();
  const { refreshMissionData, recordAction } = useMissionSystem();
  const { refreshProgress } = useUserProgress();
  const params = useParams();
  const day = Math.max(1, Math.min(60, Number(params.day || "1")));
  const lastCompletionKeyRef = useRef("");
  const [detail, setDetail] = useState<LabDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [mentorGuidance, setMentorGuidance] = useState("");
  const [hint, setHint] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState("");
  const [flowStage, setFlowStage] = useState<FlowStage>("learn");
  const [rewardPulse, setRewardPulse] = useState<{ xp: number; score: number; label: string } | null>(null);
  const [stageFlash, setStageFlash] = useState<StageFlash | null>(null);
  const [lastValidation, setLastValidation] = useState<{ accepted: boolean; title: string; detail: string; terminalOutput: string[] } | null>(null);
  const [incidentElapsed, setIncidentElapsed] = useState(0);
  const [arenaElapsed, setArenaElapsed] = useState(0);
  const [arenaHintedTasks, setArenaHintedTasks] = useState<string[]>([]);
  const [arenaDebriefText, setArenaDebriefText] = useState("");
  const [exfilElapsed, setExfilElapsed] = useState(0);
  const [exfilHintedTasks, setExfilHintedTasks] = useState<string[]>([]);
  const [vectorElapsed, setVectorElapsed] = useState(0);
  const [vectorHintedTasks, setVectorHintedTasks] = useState<string[]>([]);
  const [battleElapsed, setBattleElapsed] = useState(0);
  const [battleHintedTasks, setBattleHintedTasks] = useState<string[]>([]);
  const flowStorageKey = `day-lab-flow:${user?.id || "anon"}:day-${day}`;
  const submitGuardRef = useRef("");

  const resolveFlowStage = (stage?: string | null, completed = false, completedTasks = 0): FlowStage => {
    if (completed) return "completed";
    if (stage === "learn" || stage === "task" || stage === "execute" || stage === "validate") return stage;
    return completedTasks > 0 ? "task" : "learn";
  };

  const readFlowSnapshot = (): FlowSnapshot | null => {
    try {
      const raw = localStorage.getItem(flowStorageKey);
      return raw ? (JSON.parse(raw) as FlowSnapshot) : null;
    } catch {
      return null;
    }
  };

  const writeFlowSnapshot = (snapshot: FlowSnapshot) => {
    try {
      localStorage.setItem(flowStorageKey, JSON.stringify(snapshot));
    } catch {
      return;
    }
  };

  const normalizeFlowSnapshot = (payload: LabDetailResponse, snapshot: FlowSnapshot | null): FlowSnapshot => {
    const completedCount = payload.state.completed_task_ids.length;
    const currentTaskId = payload.current_task_id || payload.module.tasks?.find((task) => !payload.state.completed_task_ids.includes(task.id))?.id || null;

    if (payload.state.completed) {
      return {
        stage: "completed",
        currentTaskId: null,
        completedCount,
        celebration: snapshot?.celebration,
      };
    }

    if (!snapshot) {
      return {
        stage: resolveFlowStage(payload.current_stage, payload.state.completed, completedCount),
        currentTaskId,
        completedCount,
      };
    }

    if (snapshot.stage === "learn" && completedCount === 0) {
      return { ...snapshot, currentTaskId, completedCount };
    }

    if (snapshot.stage === "validate") {
      if (snapshot.currentTaskId === currentTaskId && snapshot.completedCount === completedCount) {
        return { ...snapshot, currentTaskId, completedCount };
      }
      return {
        stage: completedCount > 0 ? "task" : "learn",
        currentTaskId,
        completedCount,
      };
    }

    if (snapshot.stage === "execute" && snapshot.currentTaskId === currentTaskId) {
      return { ...snapshot, completedCount };
    }

    if (snapshot.stage === "task") {
      return { ...snapshot, currentTaskId, completedCount };
    }

    return {
      stage: completedCount > 0 ? "task" : "learn",
      currentTaskId,
      completedCount,
    };
  };

  const trackDayEvent = async (eventType: string, target: string, metadata?: Record<string, unknown>) => {
    await pyPostJson("/events", {
      event_type: eventType,
      surface: "day_lab_ui",
      target,
      metadata: {
        day,
        ...metadata,
      },
    });
  };

  useEffect(() => {
    let active = true;
    const ensurePyUser = async () => {
      if (!user?.email) return;
      await pyPostJson("/users", {
        email: user.email,
        name: user.name || user.email,
        external_id: user.id,
      });
    };

    const load = async () => {
      if (authState === "loading") return;
      setLoading(true);
      setError("");
      try {
        const payload = await pyGetJson<LabDetailResponse>(`/labs/day/${day}`);
        if (!active) return;
        const snapshot = normalizeFlowSnapshot(payload, readFlowSnapshot());
        setDetail(payload);
        setFeedback(snapshot.feedback || payload.state.last_feedback || payload.recommendation);
        setMentorGuidance(snapshot.mentorGuidance || payload.mentor_guidance || "");
        setHint(snapshot.hint || "");
        setAnswer("");
        setCelebration(snapshot.celebration || "");
        setLastValidation(
          snapshot.stage === "validate" && typeof snapshot.accepted === "boolean"
            ? {
                accepted: snapshot.accepted,
                title: snapshot.accepted ? "Validation passed" : "Validation blocked",
                detail: snapshot.accepted
                  ? "Backend scoring recorded this step and advanced the mission."
                  : "The validator rejected this answer. Refine the input and resubmit.",
                terminalOutput: snapshot.terminalOutput || [],
              }
            : null
        );
        setFlowStage(snapshot.stage);
        writeFlowSnapshot(snapshot);
        trackDayEvent("day_lab_open", `day-${day}`, { current_stage: payload.current_stage }).catch(() => undefined);
      } catch (err) {
        const error = err as Error & { status?: number };
        if (error.status === 404) {
          await ensurePyUser();
          const retryPayload = await pyGetJson<LabDetailResponse>(`/labs/day/${day}`);
          if (!active) return;
          const snapshot = normalizeFlowSnapshot(retryPayload, readFlowSnapshot());
          setDetail(retryPayload);
          setFeedback(snapshot.feedback || retryPayload.state.last_feedback || retryPayload.recommendation);
          setMentorGuidance(snapshot.mentorGuidance || retryPayload.mentor_guidance || "");
          setHint(snapshot.hint || "");
          setAnswer("");
          setCelebration(snapshot.celebration || "");
          setLastValidation(
            snapshot.stage === "validate" && typeof snapshot.accepted === "boolean"
              ? {
                  accepted: snapshot.accepted,
                  title: snapshot.accepted ? "Validation passed" : "Validation blocked",
                  detail: snapshot.accepted
                    ? "Backend scoring recorded this step and advanced the mission."
                    : "The validator rejected this answer. Refine the input and resubmit.",
                  terminalOutput: snapshot.terminalOutput || [],
                }
              : null
          );
          setFlowStage(snapshot.stage);
          writeFlowSnapshot(snapshot);
          trackDayEvent("day_lab_open", `day-${day}`, { current_stage: retryPayload.current_stage }).catch(() => undefined);
        } else {
          if (!active) return;
          setDetail(null);
          setError(getPyApiUserMessage(error, "We couldn't load this lab right now."));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch((error) => {
      if (!active) return;
      setError(getPyApiUserMessage(error, "We couldn't load this lab right now."));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authState, day, user]);

  useEffect(() => {
    if (day !== 9) return;
    setIncidentElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setIncidentElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [day]);

  const currentTask = useMemo(() => {
    if (!detail) return null;
    const tasks = detail.module.tasks || [];
    if (detail.current_task_id) {
      return tasks.find((task) => task.id === detail.current_task_id) || null;
    }
    return tasks.find((task) => !detail.state.completed_task_ids.includes(task.id)) || null;
  }, [detail]);

  const kaliTools = detail?.module.kali_tools || [];
  const successCriteria = detail?.module.success_criteria || [];
  const moduleTasks = detail?.module.tasks || [];
  const solutionExplanation = detail?.module.solution_explanation || [];
  const missionAssets = detail?.module.mission_assets || [];
  const debriefPoints = detail?.module.debrief_points || [];
  const consoleBootLines = detail?.module.console_boot_lines || [];
  const terminalLog = detail?.state.terminal_log || [];
  const isDayOne = day === 1;
  const isDayTwo = day === 2;
  const isDayThree = day === 3;
  const isDayFour = day === 4;
  const isDayFive = day === 5;
  const isDaySix = day === 6;
  const isDaySeven = day === 7;
  const isDayEight = day === 8;
  const isDayNine = day === 9;
  const isDayTen = day === 10;
  const isDayEleven = day === 11;
  const isDayTwelve = day === 12;
  const isDayThirteen = day === 13;
  const isDayFourteen = day === 14;
  const isDayFifteen = day === 15;
  const arenaMissionLimits: Record<string, number> = {
    "arena-sigma": 360,
    "arena-apex": 300,
    "arena-omega": 240,
  };
  const exfilMissionLimits: Record<string, number> = {
    "exfil-role-quiz": 300,
    "exfil-command": 270,
    "exfil-risk-quiz": 240,
    "exfil-debrief": 240,
  };
  const vectorMissionLimits: Record<string, number> = {
    "vector-open-quiz": 300,
    "vector-command": 270,
    "vector-logic-quiz": 240,
    "vector-debrief": 240,
  };
  const battleMissionLimits: Record<string, number> = {
    "battle-stage-quiz": 300,
    "battle-command": 270,
    "battle-branch-quiz": 240,
    "battle-debrief": 240,
  };
  const currentArenaLimit = isDayTen && currentTask ? arenaMissionLimits[currentTask.id] || 300 : 0;
  const currentArenaRemaining = isDayTen && currentArenaLimit ? Math.max(0, currentArenaLimit - arenaElapsed) : 0;
  const arenaHintPenalty = isDayTen ? arenaHintedTasks.length * 0.2 : 0;
  const arenaAdjustedScore = isDayTen && detail ? Math.max(0, Math.round(detail.state.score * Math.max(0, 1 - arenaHintPenalty))) : 0;
  const currentExfilLimit = isDayThirteen && currentTask ? exfilMissionLimits[currentTask.id] || 240 : 0;
  const currentExfilRemaining = isDayThirteen && currentExfilLimit ? Math.max(0, currentExfilLimit - exfilElapsed) : 0;
  const exfilHintPenalty = isDayThirteen ? exfilHintedTasks.length * 10 : 0;
  const exfilSpeedPenalty = isDayThirteen ? Math.max(0, Math.floor(exfilElapsed / 120) * 4) : 0;
  const exfilPerformanceScore = isDayThirteen && detail ? Math.max(0, detail.state.score - exfilHintPenalty - exfilSpeedPenalty) : 0;
  const currentVectorLimit = isDayFourteen && currentTask ? vectorMissionLimits[currentTask.id] || 240 : 0;
  const currentVectorRemaining = isDayFourteen && currentVectorLimit ? Math.max(0, currentVectorLimit - vectorElapsed) : 0;
  const vectorHintPenalty = isDayFourteen ? vectorHintedTasks.length * 12 : 0;
  const vectorSpeedPenalty = isDayFourteen ? Math.max(0, Math.floor(vectorElapsed / 120) * 5) : 0;
  const vectorPerformanceScore = isDayFourteen && detail ? Math.max(0, detail.state.score - vectorHintPenalty - vectorSpeedPenalty) : 0;
  const currentBattleLimit = isDayFifteen && currentTask ? battleMissionLimits[currentTask.id] || 240 : 0;
  const currentBattleRemaining = isDayFifteen && currentBattleLimit ? Math.max(0, currentBattleLimit - battleElapsed) : 0;
  const battleHintPenalty = isDayFifteen ? battleHintedTasks.length * 15 : 0;
  const battleSpeedPenalty = isDayFifteen ? Math.max(0, Math.floor(battleElapsed / 120) * 6) : 0;
  const battlePerformanceScore = isDayFifteen && detail ? Math.max(0, detail.state.score - battleHintPenalty - battleSpeedPenalty) : 0;
  const arenaRank = !isDayTen
    ? ""
    : arenaAdjustedScore >= 130
      ? "SIGMA ELITE"
      : arenaAdjustedScore >= 110
        ? "OMEGA"
        : arenaAdjustedScore >= 90
          ? "APEX"
          : arenaAdjustedScore >= 70
            ? "SIGMA"
            : arenaAdjustedScore >= 50
              ? "OPERATOR"
              : "INITIATE";
  const exfilRank = !isDayThirteen
    ? ""
    : exfilPerformanceScore >= 92
      ? "SEAL BREAKER"
      : exfilPerformanceScore >= 76
        ? "LEAK INTERCEPTOR"
        : exfilPerformanceScore >= 60
        ? "DATA HUNTER"
        : "PATH WATCHER";
  const vectorRank = !isDayFourteen
    ? ""
    : vectorPerformanceScore >= 96
      ? "CHAIN SUPREME"
      : vectorPerformanceScore >= 82
        ? "VECTOR ELITE"
        : vectorPerformanceScore >= 66
        ? "CHAIN OPERATOR"
          : "SURFACE READER";
  const battleRank = !isDayFifteen
    ? ""
    : battlePerformanceScore >= 98
      ? "WARMASTER"
      : battlePerformanceScore >= 84
        ? "STRATEGIC ELITE"
        : battlePerformanceScore >= 68
          ? "CONTROL OPERATOR"
          : "TACTICAL NOVICE";
  const arenaDebriefFullText = !isDayTen || !detail?.state.completed
    ? ""
    : `ZORVIX evaluator mode engaged. Strengths: you sustained a validated chain across SIGMA, APEX, and OMEGA with clean operator intent. Failures: every hint request reduced arena confidence and any vague language would have collapsed the rank ceiling. Optimal approach: identify the decisive signal faster, state the leverage change with less filler, and finish with a colder final judgment.`;
  const progressPercent = detail ? Math.round((detail.state.completed_task_ids.length / Math.max(1, moduleTasks.length)) * 100) : 0;
  useEffect(() => {
    if (day !== 10 || !currentTask) return;
    setArenaElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setArenaElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [day, currentTask?.id]);
  useEffect(() => {
    if (day !== 13 || !currentTask) return;
    setExfilElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setExfilElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [day, currentTask?.id]);
  useEffect(() => {
    if (day !== 14 || !currentTask) return;
    setVectorElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setVectorElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [day, currentTask?.id]);
  useEffect(() => {
    if (day !== 15 || !currentTask) return;
    setBattleElapsed(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setBattleElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [day, currentTask?.id]);
  useEffect(() => {
    if (!isDayTen || !detail?.state.completed || !arenaDebriefFullText) {
      setArenaDebriefText("");
      return;
    }
    let index = 0;
    setArenaDebriefText("");
    const timer = window.setInterval(() => {
      index += 1;
      setArenaDebriefText(arenaDebriefFullText.slice(0, index));
      if (index >= arenaDebriefFullText.length) window.clearInterval(timer);
    }, 14);
    return () => window.clearInterval(timer);
  }, [arenaDebriefFullText, detail?.state.completed, isDayTen]);
  const dayElevenRank = !isDayEleven || !detail
    ? ""
    : detail.state.score >= 88
      ? "ADAPTIVE PREDATOR"
      : detail.state.score >= 72
        ? "CALCULATED OPERATOR"
        : detail.state.score >= 56
          ? "UNCERTAINTY HANDLER"
          : "REACTIVE NOVICE";

  const learnCards = detail?.module.learn_cards?.length
    ? detail.module.learn_cards
    : (detail?.module.learn_points || []).map((point, index) => ({
        id: `fallback-learn-${index + 1}`,
        eyebrow: `Core concept ${index + 1}`,
        title: point.split(".")[0]?.trim() || `Concept ${index + 1}`,
        detail: point,
        proof_point: "This concept is validated by the active backend-scored task flow.",
        action_label: `Apply concept ${index + 1}`,
      }));
  const currentActionLabel = currentTask?.interaction_type === "single-select"
    ? "Quiz"
    : currentTask?.expected_type === "terminal"
      ? "Command"
      : "Response";
  const guidedSequence = useMemo(
    () => [
      { label: "Intro", detail: "Get the mentor framing before you move." },
      { label: "Concept", detail: "Understand what signal actually matters." },
      { label: "Example", detail: "See how this looks in a real-world situation." },
      { label: "Task", detail: currentTask ? currentTask.title : "Review the active objective." },
      { label: currentActionLabel, detail: currentTask?.instruction || "Complete the active step." },
      { label: "Validate", detail: "Backend scoring decides whether the step holds." },
    ],
    [currentActionLabel, currentTask]
  );

  const flowSteps: Array<{ id: typeof flowStage; label: string }> = [
    { id: "learn", label: "Learn" },
    { id: "task", label: "Task" },
    { id: "execute", label: currentTask?.interaction_type === "single-select" ? "Quiz" : "Execute" },
    { id: "validate", label: "Validate" },
    { id: "completed", label: "Unlock" },
  ];

  useEffect(() => {
    if (!detail?.state.completed) return;
    writeFlowSnapshot({
      stage: "completed",
      currentTaskId: null,
      completedCount: detail.state.completed_task_ids.length,
      celebration,
      feedback,
      mentorGuidance,
    });
    const today = new Date().toISOString().slice(0, 10);
    const completionKey = `mission:program-complete:${today}:day-${day}`;
    if (lastCompletionKeyRef.current === completionKey || localStorage.getItem(completionKey) === "1") return;
    lastCompletionKeyRef.current = completionKey;
    localStorage.setItem(completionKey, "1");
    recordAction("program_day_complete", {
      target: `day-${day}`,
      metadata: {
        title: `Validated Day ${day}`,
        detail: `+40 XP awarded for completing Day ${day} through the validated lab flow.`,
        day,
        score: detail.state.score,
        xp_earned: detail.state.xp_earned,
      },
    }).catch(() => undefined);
  }, [celebration, day, detail?.state.completed, detail?.state.completed_task_ids.length, detail?.state.score, detail?.state.xp_earned, feedback, mentorGuidance, recordAction]);

  const openTaskFlow = () => {
    if (!detail || detail.state.completed || flowStage !== "learn") return;
    setFlowStage("task");
    setStageFlash({
      tone: "info",
      title: "Task flow unlocked",
      detail: "You’ve finished the briefing. Now focus on one step at a time and let ZORVIX keep the path clean.",
    });
    writeFlowSnapshot({
      stage: "task",
      currentTaskId: currentTask?.id || null,
      completedCount: detail.state.completed_task_ids.length,
      feedback,
      mentorGuidance,
      celebration,
    });
    trackDayEvent("day_lab_stage_change", `day-${day}`, { stage: "task" }).catch(() => undefined);
  };

  const openExecution = () => {
    if (!detail || !currentTask || detail.state.completed || flowStage !== "task") return;
    setFlowStage("execute");
    setStageFlash({
      tone: "info",
      title: `${currentActionLabel} ready`,
      detail:
        currentTask.interaction_type === "single-select"
          ? "Read each option like an analyst, not a test-taker. Pick the one you could defend out loud."
          : currentTask.expected_type === "terminal"
            ? "Use the smallest safe command that proves the signal. Clean evidence beats noisy ambition."
            : "Keep the answer short, evidence-based, and tied to the scenario.",
    });
    writeFlowSnapshot({
      stage: "execute",
      currentTaskId: currentTask.id,
      completedCount: detail.state.completed_task_ids.length,
      feedback,
      mentorGuidance,
      celebration,
    });
    trackDayEvent("day_lab_stage_change", `day-${day}`, {
      stage: currentTask?.interaction_type === "single-select" ? "quiz" : "execute",
      task_id: currentTask?.id,
    }).catch(() => undefined);
  };

  const continueAfterValidation = () => {
    if (!detail) return;
    const nextStage: FlowStage = detail.state.completed ? "completed" : lastValidation?.accepted ? "task" : "execute";
    setFlowStage(nextStage);
    setStageFlash(
      detail.state.completed
        ? {
            tone: "success",
            title: `Day ${day} unlocked`,
            detail: "Beautiful work. The score is recorded, the reward is live, and the next day is ready.",
          }
        : lastValidation?.accepted
          ? {
              tone: "success",
              title: "Step cleared",
              detail: "That one holds. Carry the momentum forward and attack the next step with the same discipline.",
            }
          : {
              tone: "alert",
              title: "Refine and retry",
              detail: "You’re close, but the validator needs a cleaner signal. Tighten the evidence and go again.",
            }
    );
    writeFlowSnapshot({
      stage: nextStage,
      currentTaskId: nextStage === "completed" ? null : currentTask?.id || null,
      completedCount: detail.state.completed_task_ids.length,
      feedback,
      mentorGuidance,
      celebration,
    });
    trackDayEvent("day_lab_stage_change", `day-${day}`, { stage: nextStage }).catch(() => undefined);
  };

  const openMentorAssist = () => {
    const taskContext = currentTask
      ? `Current task: ${currentTask.title}. Instruction: ${currentTask.instruction}.`
      : `Day ${day} mission is currently in ${flowStage} stage.`;
    const guidanceContext = mentorGuidance || feedback || detail?.recommendation || "Guide me through the most important next step.";
    recordAction("mentor_open", {
      target: `day-${day}`,
      metadata: {
        day,
        stage: flowStage,
        task_id: currentTask?.id || null,
      },
    }).catch(() => undefined);
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: `day-lab-mentor-${Date.now()}`,
          title: `Day ${day} Mission Assist`,
          query: `You are ZORVIX. Help me with Day ${day}. ${taskContext} Guidance so far: ${guidanceContext} ${isDayOne ? "This is the user's first cybersecurity lesson. Act like a warm senior mentor. Use simple language, one short real-life example, one practical next step, and explain why the move matters without sounding robotic or academic." : ""}${isDayTwo ? " This is a reconnaissance lesson. Act like a smart, friendly mentor. Explain why attackers quietly use WHOIS, DNS, and subdomain checks before touching a target. Use simple language, one short real-world example, and one clean next recon step with what output to pay attention to." : ""}${isDayThree ? " This is a web attack surface discovery lesson. Act like a patient mentor. Use the hidden-doors-in-a-building analogy, explain why login panels, admin routes, backups, and health endpoints matter, and suggest one clean next discovery move with what signal to watch for." : ""}${isDayFour ? " This is a vulnerability identification lesson. Act like a clear, friendly security mentor. Explain auth weakness, reflected input, and misconfiguration in simple language, use a real-life trust analogy, and suggest one safe evidence-gathering step with what proof to watch for." : ""}${isDayFive ? " This is a controlled exploitation simulation. Coach me like a live mentor: check my chain logic, warn me about unsafe assumptions, and suggest the smallest safe next move." : ""}${isDaySix ? " This is a live defense-thinking drill. Coach me like a senior SOC analyst: explain the timeline, tell me which alert matters, and adapt your hints to my mistakes without solving the whole task immediately." : ""}${isDaySeven ? " This is a full attack-chain simulation. React dynamically to my choices: explain how recon creates the opening, how entry changes leverage, and how exploit impact follows from the previous step." : ""}${isDayEight ? " This is a branching decision lab. Act like an intelligent coach: compare attack and defense paths, explain tradeoffs, and tell me how my choice changes the likely outcome and difficulty." : ""}${isDayNine ? " This is a live incident response simulation. Act like a senior incident commander: explain the timeline, evaluate containment and recovery choices, and judge performance under urgency." : ""}${isDayEleven ? " This is an active threat simulation. Stay silent during thinking, then after the decision deliver a cold judgment on decision quality under uncertainty, including risk and likely scenario evolution." : ""}${isDayThirteen ? " This is a data exfiltration versus defense mission. Act like a precise incident mentor: identify the sensitive path, compare extraction versus containment logic, warn about weak risk calls, and give a no-fluff next action with one clean reason." : ""}${isDayFourteen ? " This is a multi-vector attack simulation. Give zero soft guidance, think like an elite operator, compare web, network, and logic leverage, and after each action react to whether the chain is actually becoming credible." : ""}${isDayFifteen ? " This is a strategic cyber battle arena. Stay silent during execution, think in terms of board position and resources, and after completion deliver a cold evaluation of the whole sequence." : ""} Give me the next precise operator action, what evidence to look for, and how to avoid common mistakes.`,
          tags: ["mentor", "day-lab", `day-${day}`],
          mentorMode: true,
        },
      })
    );
    window.dispatchEvent(new CustomEvent("neurobot:open"));
  };

  const submit = async () => {
    if (!detail || !currentTask || !answer.trim() || submitting || flowStage !== "execute") return;
    if (isDayTen && currentArenaRemaining <= 0) {
      setFeedback("Mission failed. Arena timer expired before validation.");
      setLastValidation({
        accepted: false,
        title: "Mission failed",
        detail: "The arena timer expired. No partial credit awarded.",
        terminalOutput: ["[arena] Timer expired.", "[evaluator] Mission failed before validation window closed."],
      });
      setFlowStage("validate");
      return;
    }
    if (isDayThirteen && currentExfilRemaining <= 0) {
      setFeedback("Mission failed. The exfiltration window closed before validation.");
      setLastValidation({
        accepted: false,
        title: "Window missed",
        detail: "Timed action expired. The transfer or containment window is gone, so the validator rejected the step.",
        terminalOutput: ["[mission] Timed exfiltration window expired.", "[zorvix] Decision delay converted into score loss and mission failure on this step."],
      });
      setFlowStage("validate");
      return;
    }
    if (isDayFourteen && currentVectorRemaining <= 0) {
      setFeedback("Mission failed. The multi-vector window closed before validation.");
      setLastValidation({
        accepted: false,
        title: "Chain collapsed",
        detail: "Timed execution expired. The validator rejected the exploit path because the action window closed first.",
        terminalOutput: ["[mission] Multi-vector timer expired.", "[zorvix] Delay broke the chain before it became actionable."],
      });
      setFlowStage("validate");
      return;
    }
    if (isDayFifteen && currentBattleRemaining <= 0) {
      setFeedback("Mission failed. The battle window closed before validation.");
      setLastValidation({
        accepted: false,
        title: "Arena lost",
        detail: "Timed execution expired. The strategic sequence failed before the board could be secured.",
        terminalOutput: ["[arena] Battle timer expired.", "[zorvix] Board control lost before the sequence could validate."],
      });
      setFlowStage("validate");
      return;
    }
    if (detail.state.completed_task_ids.includes(currentTask.id)) return;
    const submitGuardKey = `${day}:${currentTask.id}:${answer.trim()}`;
    if (submitGuardRef.current === submitGuardKey) return;
    submitGuardRef.current = submitGuardKey;
    setSubmitting(true);
    try {
      await trackDayEvent("day_lab_validate_started", `day-${day}`, { task_id: currentTask.id, expected_type: currentTask.expected_type });
      const payload = await pyPostJson<LabSubmitResponse>(`/labs/day/${day}/submit`, {
        task_id: currentTask.id,
        answer: answer.trim(),
      });
      const refreshed = await pyGetJson<LabDetailResponse>(`/labs/day/${day}`);
      setDetail(refreshed);
      setFeedback(payload.feedback);
      setMentorGuidance(payload.mentor_guidance);
      setHint(payload.hint || "");
      setCelebration(payload.celebration || "");
      setFlowStage(payload.lab_completed ? "completed" : "validate");
      const validationState = {
        accepted: payload.accepted,
        title: payload.accepted ? "Validation passed" : "Validation blocked",
        detail: payload.accepted
          ? payload.task_completed
            ? "Backend scoring recorded this step and advanced the mission."
            : "This task was already validated earlier in the module."
          : "The validator rejected this answer. Refine the input and resubmit.",
        terminalOutput: payload.terminal_output,
      };
      setLastValidation(validationState);
      setStageFlash(
        payload.accepted
          ? {
              tone: "success",
              title: payload.lab_completed ? `Day ${day} completed` : "Validation passed",
              detail: payload.lab_completed
                ? "Every required step validated cleanly. XP, score, and unlock state all moved together."
                : "Nice. That answer was accepted and the mission advanced exactly once.",
            }
          : {
              tone: "alert",
              title: "Validation blocked",
              detail: "The system rejected that step. Use the feedback, sharpen the signal, and resubmit with less noise.",
            }
      );
      writeFlowSnapshot({
        stage: payload.lab_completed ? "completed" : "validate",
        currentTaskId: currentTask.id,
        completedCount: payload.state.completed_task_ids.length,
        accepted: payload.accepted,
        feedback: payload.feedback,
        mentorGuidance: payload.mentor_guidance,
        hint: payload.hint || "",
        celebration: payload.celebration || "",
        terminalOutput: payload.terminal_output,
      });
      setRewardPulse(
        payload.accepted
          ? {
              xp: payload.xp_delta,
              score: payload.score_delta,
              label: payload.lab_completed ? `Day ${day} cleared` : currentTask.title,
            }
          : null
      );
      await trackDayEvent(payload.accepted ? "day_lab_validate_pass" : "day_lab_validate_retry", `day-${day}`, {
        task_id: currentTask.id,
        accepted: payload.accepted,
        progress_percent: payload.progress_percent,
        score_delta: payload.score_delta,
        xp_delta: payload.xp_delta,
      });
      if (payload.accepted) {
        setAnswer("");
        setShowHint(false);
      }
      refreshMissionData().catch(() => undefined);
      refreshProgress().catch(() => undefined);
    } catch (err) {
      setFeedback((err as Error).message || "Submission failed.");
    } finally {
      submitGuardRef.current = "";
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 page-shell">
      <div className="mx-auto max-w-5xl space-y-6">
          <PlatformHero
            eyebrow={`Day ${day} Lab`}
            title={
              <>
                {isDayOne ? "Think like a hacker. " : isDayTwo ? "Recon like an analyst. " : isDayThree ? "Map the surface. " : isDayFour ? "Spot the weakness. " : isDayFive ? "Break the chain safely. " : isDaySix ? "Defend the breach. " : isDaySeven ? "Chain the mission. " : isDayEight ? "Choose the path. " : isDayNine ? "Run the incident. " : isDayTen ? "Enter the arena. " : isDayEleven ? "Think under uncertainty. " : isDayThirteen ? "Control the data path. " : isDayFourteen ? "Chain every vector. " : isDayFifteen ? "Win the board. " : "Do the task. "}
                <span className="brand-gradient-text-animated">{isDayOne || isDayTwo || isDayThree || isDayFour || isDayFive || isDaySix || isDaySeven || isDayEight || isDayNine || isDayTen || isDayEleven || isDayThirteen || isDayFourteen || isDayFifteen ? "Validate the signal" : "Get validated"}</span>
                {isDayOne ? ". Unlock Day 2." : isDayTwo ? ". Unlock Day 3." : isDayThree ? ". Unlock Day 4." : isDayFour ? ". Unlock Day 5." : isDayFive ? ". Unlock Day 6." : isDaySix ? ". Unlock Day 7." : isDaySeven ? ". Unlock Day 8." : isDayEight ? ". Unlock Day 9." : isDayNine ? ". Unlock Day 10." : isDayTen ? ". Unlock Day 11." : isDayEleven ? ". Unlock Day 12." : isDayTwelve ? ". Unlock Day 13." : isDayThirteen ? ". Unlock Day 14." : isDayFourteen ? ". Unlock Day 15." : isDayFifteen ? ". Unlock Day 16." : ". Unlock next."}
              </>
            }
            description={
              isDayOne
                ? "Day 1 teaches the hacker mindset in a calm, human way: understand what failed, connect it to CIA, run one safe command for context, and explain the evidence before the system unlocks Day 2."
                : isDayTwo
                  ? "Day 2 is a premium reconnaissance mission: learn why attackers gather quiet external facts first, practice `whois` and `nslookup` like a real operator, follow a subdomain clue, and unlock Day 3 only after strict backend validation."
                  : isDayThree
                    ? "Day 3 is a premium web attack-surface mission: learn how hidden endpoints work like hidden doors in a building, simulate `dirsearch`-style discovery, prioritize the routes that matter, and unlock Day 4 only after strict backend validation."
                  : isDayFour
                    ? "Day 4 is a premium vulnerability lesson: learn how broken trust shows up in auth, inputs, and misconfiguration, inspect safe evidence with command simulation, and unlock Day 5 only after strict backend validation."
                  : isDayFive
                    ? "Day 5 is a controlled exploitation simulation: step through breach logic, run a safe proof command, analyze impact, and unlock Day 6 only after strict backend validation."
                  : isDaySix
                    ? "Day 6 is a defense-thinking drill: detect the breach sequence, inspect live telemetry, choose the first response action, and unlock Day 7 only after strict backend validation."
                  : isDaySeven
                    ? "Day 7 is a full attack-chain simulation: turn recon into entry, turn entry into exploit impact, and unlock Day 8 only after strict backend validation."
                  : isDayEight
                    ? "Day 8 is a branching decision lab: choose attack or defense paths, evaluate risk, and unlock Day 9 only after strict backend validation."
                  : isDayNine
                    ? "Day 9 is a live incident response drill: investigate the timeline, contain the attack, define recovery, and unlock Day 10 only after strict backend validation."
                  : isDayTen
                    ? "Day 10 is the elite arena: clear SIGMA, APEX, and OMEGA under strict countdowns and cold evaluation."
                  : isDayEleven
                    ? "Day 11 is an active threat simulation: observe partial signals, decide under uncertainty, and let ZORVIX judge how you think after each move."
                  : isDayTwelve
                    ? "Day 12 is a lateral movement simulation: choose the right node, validate the credential path, explain the privilege gain, and unlock Day 13 only after strict backend validation."
                  : isDayThirteen
                    ? "Day 13 is a data exfiltration-versus-defense mission: identify the sensitive path, act under a timed window, accept hint penalties if needed, and let ZORVIX score the quality of your judgment."
                  : isDayFourteen
                    ? "Day 14 is a multi-vector attack simulation: identify the web, network, and logic flaws, prove the shortest credible chain under a timer, and let ZORVIX grade the tactical quality of the exploit path."
                  : isDayFifteen
                    ? "Day 15 is a strategic cyber battle arena: balance attack and defense decisions across multiple stages, spend limited resources under pressure, and let ZORVIX grade the whole sequence only after the board is settled."
                : "Every day lab is a strict product loop: read the scenario, complete the active task, submit for backend validation, and unlock the next stage only when the result is real."
            }
          pills={[
            detail?.module.difficulty || "guided",
            detail ? `${detail.state.score} score` : "score",
            detail ? `${detail.state.xp_earned} XP` : "xp",
          ]}
          aside={
            <div className="space-y-3 text-sm text-slate-200">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Execution model</p>
              <p className="text-slate-100">One active task, one answer surface, one validation result.</p>
              <div className="flex flex-wrap gap-2">
                {["Execute", "Validate", "Score", "Unlock"].map((item) => (
                  <span key={item} className="premium-metric-pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          }
        />

        {loading ? <div className="glass-card rounded-2xl p-5 text-sm text-cyan-100/72">Loading lab…</div> : null}
        {error ? <div className="glass-card rounded-2xl p-5 text-sm text-rose-300">{error}</div> : null}

        {detail ? (
          <>
            <section className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <div className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Progress</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(94,234,212,0.9),rgba(56,189,248,0.95))] transition-all duration-500"
                    style={{ width: `${Math.round((detail.state.completed_task_ids.length / Math.max(1, moduleTasks.length)) * 100)}%` }}
                  />
                </div>
              <div className="mt-4 flex flex-wrap gap-2">
                  <span className="premium-metric-pill">{detail.state.completed_task_ids.length}/{moduleTasks.length} tasks cleared</span>
                  <span className="premium-metric-pill">{detail.state.score} score</span>
                  <span className="premium-metric-pill">{detail.state.xp_earned} XP</span>
                </div>
                {rewardPulse ? (
                  <div className="mission-celebration-shell mission-celebration-shell--burst mt-4 rounded-2xl border border-cyan-300/16 bg-cyan-500/10 p-4">
                    <div className="mission-confetti">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">XP reward</p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{rewardPulse.label}</p>
                        <p className="mt-1 text-sm text-slate-300/76">Validated operator step recorded in backend state.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-semibold text-cyan-100">+{rewardPulse.xp} XP</p>
                        <p className="text-xs text-cyan-100/68">+{rewardPulse.score} score</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {celebration ? (
                  <div className="mission-celebration-shell mt-4 rounded-2xl border border-emerald-300/16 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    {celebration}
                  </div>
                ) : null}
              </div>

              <div className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Lab stack</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {kaliTools.map((tool) => (
                    <span key={tool} className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-200/82">
                      {tool}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-300/78">Current flow is strict: only the next unlocked task can be submitted. Correct validation updates score, XP, terminal log, and unlock state immediately.</p>
              </div>
            </section>

            <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Mission Flow</p>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                {flowSteps.map((step, index) => {
                  const active = flowStage === step.id;
                  const reached =
                    (flowStage === "task" && index <= 1) ||
                    (flowStage === "execute" && index <= 2) ||
                    (flowStage === "validate" && index <= 3) ||
                    flowStage === "completed";
                  return (
                    <div
                      key={step.id}
                      className={`rounded-2xl border p-4 transition ${
                        active
                          ? "border-cyan-300/36 bg-cyan-500/10"
                          : reached
                            ? "border-emerald-300/20 bg-emerald-500/10"
                            : "border-white/8 bg-white/[0.03]"
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">0{index + 1}</p>
                      <p className="mt-3 text-sm font-semibold text-white">{step.label}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {stageFlash ? (
              <section
                className={`mission-stage-flash rounded-2xl p-5 ${
                  stageFlash.tone === "success"
                    ? "mission-stage-flash--success"
                    : stageFlash.tone === "alert"
                      ? "mission-stage-flash--alert"
                      : ""
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/68">Live guidance</p>
                <p className="mt-3 text-lg font-semibold text-white">{stageFlash.title}</p>
                <p className="mt-2 text-sm text-white/80">{stageFlash.detail}</p>
              </section>
            ) : null}

            {flowStage === "learn" ? (
            <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
              {isDayOne ? (
                <div className="day-one-intro-shell mb-5">
                  <div className="day-one-intro-shell__pulse" />
                  <div className="day-one-intro-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Animated intro</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Public page defaced. Trust is broken. Your thinking has to be cleaner than the attacker’s.</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/82">
                      Imagine a customer opening a page that still loads perfectly, but the information on it was changed by someone unauthorized. That is the feeling we want you to notice here: trust can break before a system goes down. ZORBIX will guide you, but the unlock is earned only if your classification, command choice, and evidence chain all validate cleanly.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { label: "Confidentiality", tone: "neutral" },
                        { label: "Integrity", tone: "active" },
                        { label: "Availability", tone: "neutral" },
                      ].map((item) => (
                        <span key={item.label} className={`day-one-cia-chip ${item.tone === "active" ? "day-one-cia-chip--active" : ""}`}>
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayTwo ? (
                <div className="day-two-recon-shell mb-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Recon board</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Good recon feels quiet, fast, and believable.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/82">
                    Before an attacker scans loudly, they often gather simple facts first: who owns the domain, where the nameservers point, and whether subdomains like <span className="text-cyan-100">api</span> or <span className="text-cyan-100">staging</span> exist. Day 2 teaches that habit in a clean order so every command has a reason behind it.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      { label: "WHOIS", detail: "Start from registrar, ownership, and nameserver context." },
                      { label: "DNS", detail: "Validate A, NS, MX, or subdomain clues like api or staging." },
                      { label: "Brief", detail: "Turn one verified signal into a clean next recon move." },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-cyan-300/14 bg-cyan-500/8 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">{item.label}</p>
                        <p className="mt-3 text-sm text-slate-200">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {isDayThree ? (
                <div className="day-three-surface-shell mb-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Surface map</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Attack surface discovery is really door-finding with context.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/82">
                    Imagine walking around a building. The front door is obvious, but the risky doors are often side entries, maintenance doors, staff entrances, or unlabeled rooms. Websites work the same way. Pages like <span className="text-cyan-100">/login</span>, <span className="text-cyan-100">/admin</span>, and hidden API endpoints tell you where the important functionality actually lives.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    {[
                      { label: "/login", detail: "Front-facing auth door" },
                      { label: "/admin", detail: "Privileged staff entrance" },
                      { label: "/backup", detail: "Forgotten storage room" },
                      { label: "/admin/api/health", detail: "Hidden service doorway" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-cyan-300/14 bg-cyan-500/8 p-4">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="mt-2 text-xs text-slate-300/80">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Observe", "Enumerate", "Prioritize", "Validate"].map((item) => (
                      <span key={item} className="rounded-full border border-white/8 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300/78">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {isDayFour ? (
                <div className="day-four-vuln-shell mb-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Vulnerability triage board</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">A vulnerability is usually just trust breaking in a specific place.</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/82">
                    Think of a building again: one door opens with a default key, one receptionist repeats anything you whisper, and one maintenance room was left unlocked. Web apps fail in similar ways. Day 4 trains you to see whether the app is trusting the wrong user, the wrong input, or the wrong configuration.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      { label: "Weak Auth", detail: "Default credentials or weak login controls break identity trust fast." },
                      { label: "Input Risk", detail: "Reflected user input means the app may trust attacker-controlled data too far." },
                      { label: "Misconfig", detail: "Debug routes and missing headers leave hidden doors open." },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-cyan-300/14 bg-cyan-500/8 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">{item.label}</p>
                        <p className="mt-3 text-sm text-slate-200">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Observe", "Classify", "Validate", "Remediate"].map((item) => (
                      <span key={item} className="rounded-full border border-white/8 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300/78">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {isDayFive ? (
                <div className="day-five-breach-shell mb-5">
                  <div className="day-five-breach-shell__glow" />
                  <div className="day-five-breach-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/72">Controlled exploitation sim</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Entry", detail: "Weak admin auth is the shortest path to meaningful impact." },
                        { label: "Proof", detail: "Use one safe request to prove the chain without changing state." },
                        { label: "Consequence", detail: "Name attacker gain, tension level, and first containment move." },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-amber-300/16 bg-amber-500/10 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/72">{item.label}</p>
                          <p className="mt-3 text-sm text-slate-200">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Pressure high", "Impact visible", "ZORVIX live", "Range safe"].map((item) => (
                        <span key={item} className="day-five-pressure-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDaySix ? (
                <div className="day-six-defense-shell mb-5">
                  <div className="day-six-defense-shell__scan" />
                  <div className="day-six-defense-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">Live security dashboard</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      {[
                        { label: "Auth Failures", detail: "11 spikes in 4 min", tone: "alert" },
                        { label: "Privileged Session", detail: "admin token issued", tone: "critical" },
                        { label: "Outbound Beacon", detail: "198.51.100.24:443", tone: "alert" },
                        { label: "ZORVIX", detail: "Senior analyst assist live", tone: "info" },
                      ].map((item) => (
                        <div key={item.label} className={`day-six-defense-card ${item.tone === "critical" ? "day-six-defense-card--critical" : item.tone === "alert" ? "day-six-defense-card--alert" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Detect", "Correlate", "Contain", "Preserve evidence"].map((item) => (
                        <span key={item} className="day-six-defense-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDaySeven ? (
                <div className="day-seven-chain-shell mb-5">
                  <div className="day-seven-chain-shell__beam" />
                  <div className="day-seven-chain-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-fuchsia-100/72">Cinematic mission chain</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Recon", detail: "High-value route identified", tone: "ready" },
                        { label: "Entry", detail: "Weak trust boundary confirmed", tone: "active" },
                        { label: "Exploit", detail: "Impact path waiting for proof", tone: "pending" },
                      ].map((item) => (
                        <div key={item.label} className={`day-seven-chain-card ${item.tone === "active" ? "day-seven-chain-card--active" : item.tone === "ready" ? "day-seven-chain-card--ready" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-fuchsia-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Intensity rising", "Chain connected", "ZORVIX adaptive", "Strict consequences"].map((item) => (
                        <span key={item} className="day-seven-chain-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayEight ? (
                <div className="day-eight-decision-shell mb-5">
                  <div className="day-eight-decision-shell__pulse" />
                  <div className="day-eight-decision-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/72">Decision matrix</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Exploit Path", detail: "High leverage, higher detection risk", tone: "alert" },
                        { label: "Containment Path", detail: "Lower attacker dwell time, less visibility", tone: "ready" },
                        { label: "Evidence Path", detail: "Richer story, slower action", tone: "neutral" },
                      ].map((item) => (
                        <div key={item.label} className={`day-eight-decision-card ${item.tone === "alert" ? "day-eight-decision-card--alert" : item.tone === "ready" ? "day-eight-decision-card--ready" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Risk scored", "Branching live", "ZORVIX adaptive", "Outcome reactive"].map((item) => (
                        <span key={item} className="day-eight-decision-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayNine ? (
                <div className="day-nine-ir-shell mb-5">
                  <div className="day-nine-ir-shell__sweep" />
                  <div className="day-nine-ir-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-rose-100/72">Live incident dashboard</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      {[
                        { label: "09:09", detail: "Auth failures spike", tone: "alert" },
                        { label: "09:12", detail: "Admin session created", tone: "critical" },
                        { label: "09:14", detail: "Beacon leaves host", tone: "critical" },
                        { label: "ZORVIX", detail: "Commander assist live", tone: "info" },
                      ].map((item) => (
                        <div key={item.label} className={`day-nine-ir-card ${item.tone === "critical" ? "day-nine-ir-card--critical" : item.tone === "alert" ? "day-nine-ir-card--alert" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-rose-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Investigate", "Contain", "Recover", "Score under pressure"].map((item) => (
                        <span key={item} className="day-nine-ir-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayEleven ? (
                <div className="day-eleven-threat-shell mb-5">
                  <div className="day-eleven-threat-shell__drift" />
                  <div className="day-eleven-threat-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">Active threat simulation</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Scenario A", detail: "Workstation beaconing", tone: "alert" },
                        { label: "Scenario B", detail: "Privileged token issued", tone: "critical" },
                        { label: "Scenario C", detail: "Cloud action out of pattern", tone: "neutral" },
                      ].map((item) => (
                        <div key={item.label} className={`day-eleven-threat-card ${item.tone === "critical" ? "day-eleven-threat-card--critical" : item.tone === "alert" ? "day-eleven-threat-card--alert" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Permanent choices", "No neutral path", "Inaction scored", "Attacker adapts"].map((item) => (
                        <span key={item} className="day-eleven-threat-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayTwelve ? (
                <div className="day-twelve-lateral-shell mb-5">
                  <div className="day-twelve-lateral-shell__mesh" />
                  <div className="day-twelve-lateral-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">Lateral movement map</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      {[
                        { label: "WKSTN-04", detail: "Compromised foothold", tone: "alert" },
                        { label: "APP-01", detail: "Shared app node and service path", tone: "active" },
                        { label: "FILE-02", detail: "Lower leverage file target", tone: "neutral" },
                        { label: "DC-CORE", detail: "High-value privilege objective", tone: "critical" },
                      ].map((item) => (
                        <div key={item.label} className={`day-twelve-lateral-card ${item.tone === "critical" ? "day-twelve-lateral-card--critical" : item.tone === "active" ? "day-twelve-lateral-card--active" : item.tone === "alert" ? "day-twelve-lateral-card--alert" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Foothold live", "Credential clue", "Pivot required", "Privilege path scored"].map((item) => (
                        <span key={item} className="day-twelve-lateral-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayThirteen ? (
                <div className="day-thirteen-exfil-shell mb-5">
                  <div className="day-thirteen-exfil-shell__mesh" />
                  <div className="day-thirteen-exfil-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">Exfiltration pressure board</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      {[
                        { label: "/srv/finance/exports", detail: "High-value CSV export path", tone: "critical" },
                        { label: "legal-archive.zip", detail: "Compressed archive staged for movement", tone: "alert" },
                        { label: "198.51.100.44", detail: "Outbound sync destination", tone: "active" },
                        { label: "DLP-GATE", detail: "Containment window still open", tone: "success" },
                      ].map((item) => (
                        <div key={item.label} className={`day-thirteen-exfil-card ${item.tone === "critical" ? "day-thirteen-exfil-card--critical" : item.tone === "active" ? "day-thirteen-exfil-card--active" : item.tone === "alert" ? "day-thirteen-exfil-card--alert" : item.tone === "success" ? "day-thirteen-exfil-card--success" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Attack or defend", "Timed actions", "Hint penalty", "No-fluff scoring"].map((item) => (
                        <span key={item} className="day-thirteen-exfil-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayFourteen ? (
                <div className="day-fourteen-vector-shell mb-5">
                  <div className="day-fourteen-vector-shell__mesh" />
                  <div className="day-fourteen-vector-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">Multi-vector pressure board</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      {[
                        { label: "/partner/login", detail: "Session-trust opening", tone: "active" },
                        { label: "10.10.22.17:8443", detail: "Internal metrics pivot", tone: "critical" },
                        { label: "role=approver", detail: "Client-side logic trust", tone: "alert" },
                        { label: "Exploit chain", detail: "Shortest credible path wins", tone: "success" },
                      ].map((item) => (
                        <div key={item.label} className={`day-fourteen-vector-card ${item.tone === "critical" ? "day-fourteen-vector-card--critical" : item.tone === "active" ? "day-fourteen-vector-card--active" : item.tone === "alert" ? "day-fourteen-vector-card--alert" : item.tone === "success" ? "day-fourteen-vector-card--success" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Zero guidance", "Strict validation", "Timed chain", "Adaptive difficulty"].map((item) => (
                        <span key={item} className="day-fourteen-vector-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayFifteen ? (
                <div className="day-fifteen-battle-shell mb-5">
                  <div className="day-fifteen-battle-shell__mesh" />
                  <div className="day-fifteen-battle-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/72">Strategic battle board</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      {[
                        { label: "Attack pressure", detail: "Partner-session leverage live", tone: "active" },
                        { label: "Defense integrity", detail: "One burn action remains", tone: "success" },
                        { label: "Command node", detail: "Reachable through exception path", tone: "critical" },
                        { label: "Reserve", detail: "Spend carefully or lose tempo", tone: "alert" },
                      ].map((item) => (
                        <div key={item.label} className={`day-fifteen-battle-card ${item.tone === "critical" ? "day-fifteen-battle-card--critical" : item.tone === "active" ? "day-fifteen-battle-card--active" : item.tone === "alert" ? "day-fifteen-battle-card--alert" : item.tone === "success" ? "day-fifteen-battle-card--success" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Silent observer", "Resource scoring", "Timed stages", "Cold evaluation"].map((item) => (
                        <span key={item} className="day-fifteen-battle-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayTen ? (
                <div className="day-ten-arena-shell mb-5">
                  <div className="day-ten-arena-shell__flare" />
                  <div className="day-ten-arena-shell__content">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/72">Elite challenge arena</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "SIGMA", detail: "06:00 limit | opening move", tone: "ready" },
                        { label: "APEX", detail: "05:00 limit | leverage judgment", tone: "active" },
                        { label: "OMEGA", detail: "04:00 limit | final verdict", tone: "critical" },
                      ].map((item) => (
                        <div key={item.label} className={`day-ten-arena-card ${item.tone === "active" ? "day-ten-arena-card--active" : item.tone === "critical" ? "day-ten-arena-card--critical" : ""}`}>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/70">{item.label}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["No guidance", "Hint costs 20%", "No partial credit", "Cold evaluator"].map((item) => (
                        <span key={item} className="day-ten-arena-chip">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="mentor-brief-grid mb-5 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="mentor-brief-card">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Intro</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Learn this like a guided mission, not a lecture.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300/82">{detail.module.mentor_intro}</p>
                </div>
                <div className="mentor-brief-card mentor-brief-card--example">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100/66">Example</p>
                  <p className="mt-3 text-sm leading-6 text-slate-200/86">{detail.module.example_story}</p>
                </div>
              </div>
              <div className="mentor-sequence-grid mb-5 grid gap-3 md:grid-cols-3">
                {guidedSequence.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="mentor-sequence-card">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">0{index + 1}</p>
                    <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-300/78">{item.detail}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Mission briefing</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{detail.module.title}</h2>
              <p className="mt-2 text-sm text-cyan-100/72">{detail.module.scenario_tagline}</p>
              <p className="mt-2 text-sm text-slate-300/82">{detail.module.scenario}</p>
              <div className="mt-4 rounded-xl border border-cyan-300/16 bg-black/25 p-4 text-sm text-cyan-100/78">
                {detail.module.mission_brief}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  { label: "Operator Role", value: detail.module.operator_role },
                  { label: "Threat Level", value: detail.module.threat_level },
                  { label: "Primary Objective", value: detail.module.objective },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {missionAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className={`rounded-2xl border p-4 ${
                      asset.tone === "warning"
                        ? "border-amber-300/18 bg-amber-500/10"
                        : asset.tone === "success"
                          ? "border-emerald-300/18 bg-emerald-500/10"
                          : "border-white/8 bg-white/[0.03]"
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{asset.label}</p>
                    <p className="mt-3 text-sm font-semibold text-white">{asset.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {learnCards.map((card, index) => (
                  <div
                    key={card.id}
                    className={`premium-card-lift rounded-[1.4rem] border p-5 ${
                      day === 1
                        ? "border-cyan-300/18 bg-[linear-gradient(180deg,rgba(14,116,144,0.16),rgba(2,6,23,0.5))]"
                        : "border-white/8 bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">{card.eyebrow}</p>
                      <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300/72">
                        0{index + 1}
                      </span>
                    </div>
                    <p className="mt-4 text-lg font-semibold text-white">{card.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300/82">{card.detail}</p>
                    <div className="mt-4 rounded-2xl border border-cyan-300/14 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Proof point</p>
                      <p className="mt-2 text-sm text-cyan-50/84">{card.proof_point}</p>
                    </div>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-emerald-200/68">{card.action_label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Success criteria</p>
                <div className="mt-3 grid gap-2">
                  {successCriteria.map((item) => (
                    <p key={item} className="text-sm text-slate-300/78">{item}</p>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  { label: "Environment", value: detail.module.environment },
                  { label: "Difficulty", value: detail.module.difficulty },
                  { label: "Tasks Cleared", value: `${detail.state.completed_task_ids.length}/${moduleTasks.length}` },
                  { label: "Attempts", value: `${detail.state.attempts}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="home-clean-mini-cta-link" onClick={openTaskFlow}>
                    <ArrowRight className="h-4 w-4" />
                    {detail.module.primary_action_label}
                  </button>
                  <button type="button" className="home-clean-mini-cta-link" onClick={openMentorAssist}>
                    <Lightbulb className="h-4 w-4" />
                    Ask ZORVIX
                  </button>
                </div>
              </div>
            </section>
            ) : null}

            {flowStage !== "learn" ? (
            <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
              {!detail.state.unlocked ? (
                <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="inline-flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Locked</p>
                  <p className="mt-2">Complete the previous day to unlock this lab.</p>
                </div>
              ) : null}

              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">{isDayEleven && flowStage !== "validate" && flowStage !== "completed" ? "Thinking phase" : "What should I do next?"}</p>
              <div className="mt-3 rounded-xl border border-cyan-300/16 bg-black/25 p-4">
                <p className="text-sm text-slate-300/82">
                  {isDayEleven && flowStage !== "validate" && flowStage !== "completed"
                    ? "ZORVIX is silent. Observe, analyze, decide, and own the consequence before the system responds."
                    : isDayTwelve
                      ? "ZORVIX is reading the movement chain like a senior operator: source host, credential, pivot node, privilege gain, and defender consequence."
                    : isDayThirteen
                      ? "ZORVIX is reading the data path like an incident operator: sensitive file location, outbound route, role choice, risk level, and the one move that changes business impact first."
                    : isDayFourteen
                      ? "ZORVIX is scoring the chain cold: web opening, network reach, logic abuse, shortest exploit path, and which tactical fix would break the sequence first."
                      : isDayFifteen
                        ? "ZORVIX is silent during execution. Read the board, manage resources, and own the sequence before the evaluator speaks."
                    : mentorGuidance || detail.recommendation}
                </p>
              </div>

              <div className="mentor-sequence-grid mt-4 grid gap-3 md:grid-cols-3">
                <div className="mentor-sequence-card">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Task</p>
                  <p className="mt-3 text-sm font-semibold text-white">Understand the objective</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300/78">Read the active step closely and decide what kind of proof the validator will actually accept.</p>
                </div>
                <div className="mentor-sequence-card">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">{currentActionLabel}</p>
                  <p className="mt-3 text-sm font-semibold text-white">Make one clean move</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300/78">Choose the smallest command, answer, or note that changes confidence for a real reason.</p>
                </div>
                <div className="mentor-sequence-card">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Validate</p>
                  <p className="mt-3 text-sm font-semibold text-white">Let the backend score it</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300/78">Progress only advances when the evidence, logic, and wording hold up together.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {moduleTasks.map((task, index) => {
                  const active = currentTask?.id === task.id;
                  const done = detail.state.completed_task_ids.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`premium-card-lift rounded-2xl border p-4 ${
                        done ? "border-emerald-300/24 bg-emerald-500/10" : active ? "border-cyan-300/36 bg-cyan-500/10" : "border-cyan-300/12 bg-white/[0.03]"
                      }`}
                    >
                      <p className="text-xs text-cyan-100/60">Step {index + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{task.title}</p>
                      <p className="mt-2 text-sm text-slate-300/82">{task.instruction}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300/72">
                          {task.interaction_type === "single-select" ? "Validated Quiz" : task.expected_type === "terminal" ? "Terminal Task" : "Operator Response"}
                        </span>
                        <span className="rounded-full border border-emerald-300/14 bg-emerald-500/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100/72">
                          +{task.xp} XP
                        </span>
                        <span className="rounded-full border border-cyan-300/14 bg-cyan-500/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
                          +{task.score} score
                        </span>
                      </div>
                      {task.validation_focus?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {task.validation_focus.map((focus) => (
                            <span key={focus} className="rounded-full border border-cyan-300/14 bg-cyan-500/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
                              {focus}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-[11px] text-cyan-100/60">Attempts: {task.attempt_count}</p>
                    </div>
                  );
                })}
              </div>
              {currentTask ? (
                <div className="mt-5 rounded-2xl border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(6,182,212,0.08),rgba(2,6,23,0.36))] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Active mission</p>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-white">{currentTask.title}</p>
                      <p className="mt-2 max-w-2xl text-sm text-slate-300/80">{currentTask.instruction}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="premium-metric-pill">+{currentTask.xp} XP</span>
                      <span className="premium-metric-pill">+{currentTask.score} score</span>
                    </div>
                  </div>
                </div>
              ) : null}
              {currentTask && flowStage === "task" ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className="home-clean-mini-cta-link" onClick={openExecution}>
                    <ArrowRight className="h-4 w-4" />
                    {currentTask.interaction_type === "single-select" ? "Open quiz" : "Open execution"}
                  </button>
                  {!isDayEleven && !isDayFifteen ? (
                    <button type="button" className="home-clean-mini-cta-link" onClick={openMentorAssist}>
                      <Lightbulb className="h-4 w-4" />
                      Ask ZORVIX
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
            ) : null}

            {currentTask && !detail.state.completed && flowStage === "execute" ? (
              <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Submit your answer</p>
                <div className="mentor-execution-shell mt-3 rounded-2xl p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Mentor checkpoint</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300/82">
                    Keep it simple: spot the signal, make the smallest safe move that proves it, then explain the result like you would to a teammate on shift.
                  </p>
                </div>
                {isDayOne ? (
                  <div className="day-one-task-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">{"Learn -> task -> command -> quiz -> validate"}</p>
                    <p className="mt-2 text-sm text-slate-300/80">
                      Move like an analyst under pressure: answer the current step, read the feedback, and let ZORBIX help only when needed.
                    </p>
                  </div>
                ) : null}
                {isDayFive ? (
                  <div className="day-five-pressure-shell mt-3 rounded-2xl border border-amber-300/18 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/72">Live pressure state</p>
                    <p className="mt-2 text-sm text-slate-300/82">
                      ZORVIX is watching the chain logic in real time. Use the smallest safe command that proves impact, then let the validator decide whether the breach path is credible.
                    </p>
                  </div>
                ) : null}
                {isDaySix ? (
                  <div className="day-six-response-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">SOC response state</p>
                    <p className="mt-2 text-sm text-slate-300/82">
                      Read the dashboard like an on-shift defender: prove the timeline, call the incident, and choose the first containment move without destroying evidence.
                    </p>
                  </div>
                ) : null}
                {isDaySeven ? (
                  <div className="day-seven-intensity-shell mt-3 rounded-2xl border border-fuchsia-300/16 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-fuchsia-100/72">Mission intensity</p>
                    <p className="mt-2 text-sm text-slate-300/82">
                      Each validated move deepens the chain. Choose clean signals, prove the foothold, and let ZORVIX pressure-test whether the exploit outcome really follows.
                    </p>
                  </div>
                ) : null}
                {isDayEight ? (
                  <div className="day-eight-feedback-shell mt-3 rounded-2xl border border-emerald-300/16 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/72">Choice pressure</p>
                    <p className="mt-2 text-sm text-slate-300/82">
                      Your selected branch changes the outcome logic. Pick a path, support it with evidence, and let ZORVIX tell you whether the tradeoff actually holds up.
                    </p>
                  </div>
                ) : null}
                {isDayNine ? (
                  <div className="day-nine-response-shell mt-3 rounded-2xl border border-rose-300/16 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-rose-100/72">Incident urgency</p>
                        <p className="mt-2 text-sm text-slate-300/82">
                          Investigate the timeline, choose the first control, and only then move toward recovery. ZORVIX is grading response quality under live pressure.
                        </p>
                      </div>
                      <div className="day-nine-timer">
                        T+{Math.floor(incidentElapsed / 60).toString().padStart(2, "0")}:{(incidentElapsed % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                  </div>
                ) : null}
                {isDayEleven ? (
                  <div className="day-eleven-silence-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">ZORVIX status</p>
                    <p className="mt-2 text-sm text-slate-300/82">
                      Silent during thinking phase. Your choice is permanent. The response comes only after you commit.
                    </p>
                  </div>
                ) : null}
                {isDayTwelve ? (
                  <div className="day-twelve-execution-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">Privilege path state</p>
                    <p className="mt-2 text-sm text-slate-300/82">
                      Think in sequence: compromised source, best pivot, credential or share proof, then the privilege gain that makes the move worth it.
                    </p>
                  </div>
                ) : null}
                {isDayThirteen ? (
                  <div className="day-thirteen-execution-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">Exfiltration window</p>
                        <p className="mt-2 text-sm text-slate-300/82">
                          Pick the role, prove the sensitive path, and act before the transfer or containment window closes. Hint requests cost performance score.
                        </p>
                      </div>
                      <div className={`day-thirteen-timer ${currentExfilRemaining <= 60 ? "day-thirteen-timer--critical" : ""}`}>
                        {Math.floor(currentExfilRemaining / 60).toString().padStart(2, "0")}:{(currentExfilRemaining % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="day-thirteen-exfil-chip">Penalty: -{exfilHintPenalty} score</span>
                      <span className="day-thirteen-exfil-chip">Speed drift: -{exfilSpeedPenalty}</span>
                      <span className="day-thirteen-exfil-chip">Live performance: {exfilPerformanceScore}</span>
                    </div>
                  </div>
                ) : null}
                {isDayFourteen ? (
                  <div className="day-fourteen-execution-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">Multi-vector clock</p>
                        <p className="mt-2 text-sm text-slate-300/82">
                          No soft guidance. Prove the shortest web-to-network-to-logic chain before the timer kills the path. Hints cost score immediately.
                        </p>
                      </div>
                      <div className={`day-fourteen-timer ${currentVectorRemaining <= 60 ? "day-fourteen-timer--critical" : ""}`}>
                        {Math.floor(currentVectorRemaining / 60).toString().padStart(2, "0")}:{(currentVectorRemaining % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="day-fourteen-vector-chip">Penalty: -{vectorHintPenalty} score</span>
                      <span className="day-fourteen-vector-chip">Speed drift: -{vectorSpeedPenalty}</span>
                      <span className="day-fourteen-vector-chip">Live performance: {vectorPerformanceScore}</span>
                    </div>
                  </div>
                ) : null}
                {isDayFifteen ? (
                  <div className="day-fifteen-execution-shell mt-3 rounded-2xl border border-cyan-300/16 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">Battle clock</p>
                        <p className="mt-2 text-sm text-slate-300/82">
                          ZORVIX stays silent here. Validate the board, spend the right resource, and finish the sequence before tempo collapses.
                        </p>
                      </div>
                      <div className={`day-fifteen-timer ${currentBattleRemaining <= 60 ? "day-fifteen-timer--critical" : ""}`}>
                        {Math.floor(currentBattleRemaining / 60).toString().padStart(2, "0")}:{(currentBattleRemaining % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="day-fifteen-battle-chip">Hint penalty: -{battleHintPenalty}</span>
                      <span className="day-fifteen-battle-chip">Tempo drift: -{battleSpeedPenalty}</span>
                      <span className="day-fifteen-battle-chip">Live board score: {battlePerformanceScore}</span>
                    </div>
                  </div>
                ) : null}
                {isDayTen ? (
                  <div className="day-ten-pressure-shell mt-3 rounded-2xl border border-amber-300/16 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/72">Arena clock</p>
                        <p className="mt-2 text-sm text-slate-300/82">
                          No coaching. No filler. Mission fails if the clock hits zero before validation.
                        </p>
                      </div>
                      <div className={`day-ten-timer ${currentArenaRemaining <= 60 ? "day-ten-timer--critical" : ""}`}>
                        {Math.floor(currentArenaRemaining / 60).toString().padStart(2, "0")}:{(currentArenaRemaining % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 rounded-2xl border border-cyan-300/16 bg-cyan-500/8 p-4">
                  <p className="text-sm font-semibold text-white">{currentTask.title}</p>
                  <p className="mt-2 text-sm text-slate-300/78">{currentTask.instruction}</p>
                </div>
                {currentTask.interaction_type === "single-select" && currentTask.options?.length ? (
                  <div className="mt-3 grid gap-3">
                    {currentTask.options.map((option) => {
                      const selected = answer === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setAnswer(option.value)}
                          className={`premium-card-lift rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-cyan-300/40 bg-cyan-500/12"
                              : "border-cyan-300/14 bg-black/20 hover:border-cyan-300/26 hover:bg-cyan-500/8"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm text-white">{option.label}</span>
                            {selected ? <CheckCircle2 className="h-4 w-4 text-cyan-300" /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : currentTask.expected_type === "terminal" ? (
                  <div className="mt-3 rounded-2xl border border-cyan-300/16 bg-[#050816] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Terminal-style execution</p>
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 px-3 py-3">
                      <span className="text-sm text-cyan-300">$</span>
                      <input
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder="Enter the command you would run..."
                        className="w-full bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-100/34"
                      />
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Enter the command, analysis, or decision..."
                    className="mt-3 min-h-[8rem] w-full rounded-2xl border border-cyan-300/16 bg-[#050816] p-4 text-sm text-cyan-50 outline-none placeholder:text-cyan-100/34"
                  />
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="home-clean-mini-cta-link" onClick={submit} disabled={submitting || !answer.trim()}>
                    <TerminalSquare className="h-4 w-4" />
                    {submitting ? "Validating..." : "Validate answer"}
                  </button>
      <button
        type="button"
        className="home-clean-mini-cta-link"
        onClick={() => {
          if (isDayTen && currentTask && !arenaHintedTasks.includes(currentTask.id)) {
            setArenaHintedTasks((current) => [...current, currentTask.id]);
          }
          if (isDayThirteen && currentTask && !exfilHintedTasks.includes(currentTask.id)) {
            setExfilHintedTasks((current) => [...current, currentTask.id]);
          }
          if (isDayFourteen && currentTask && !vectorHintedTasks.includes(currentTask.id)) {
            setVectorHintedTasks((current) => [...current, currentTask.id]);
          }
          if (isDayFifteen && currentTask && !battleHintedTasks.includes(currentTask.id)) {
            setBattleHintedTasks((current) => [...current, currentTask.id]);
          }
          setShowHint((current) => !current);
        }}
      >
        <Lightbulb className="h-4 w-4" />
        {showHint ? "Hide hint" : isDayTen ? "Cryptic hint (-20%)" : isDayThirteen ? "Hint (-10 score)" : isDayFourteen ? "Hint (-12 score)" : isDayFifteen ? "Hint (-15 score)" : "Show hint"}
      </button>
                  {!isDayEleven && !isDayFifteen ? (
                    <button type="button" className="home-clean-mini-cta-link" onClick={openMentorAssist}>
                      <Lightbulb className="h-4 w-4" />
                      Ask ZORVIX
                    </button>
                  ) : null}
                </div>
                {showHint ? (
                  <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {hint || currentTask.hint}
                  </div>
                ) : null}
              </section>
            ) : null}

            {(flowStage === "validate" || flowStage === "completed") ? (
            <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Validation result</p>
              {lastValidation ? (
                <div
                  className={`mt-3 rounded-2xl border p-4 ${
                    lastValidation.accepted
                      ? "border-emerald-300/16 bg-emerald-500/10 text-emerald-100"
                      : "border-rose-300/16 bg-rose-500/10 text-rose-100"
                  }`}
                >
                  <p className="text-sm font-semibold">{lastValidation.title}</p>
                  <p className="mt-2 text-sm opacity-90">{lastValidation.detail}</p>
                  {isDayFive ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Tension converted into proof. Chain contained and scored." : "Pressure rising. Refine the chain before the breach story holds."}
                    </p>
                  ) : null}
                  {isDaySix ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Alert validated. Response path scored and evidence preserved." : "Alert not yet proven. Correlate the sequence before you escalate."}
                    </p>
                  ) : null}
                  {isDaySeven ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Chain step locked. Mission leverage increased." : "Chain broken. Rebuild the sequence before the validator will carry it forward."}
                    </p>
                  ) : null}
                  {isDayEight ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Decision accepted. Branch consequence updated." : "Decision rejected. Re-evaluate the path and its risk."}
                    </p>
                  ) : null}
                  {isDayNine ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Incident response step accepted. Pressure score holding." : "Incident response step rejected. The timeline or control choice is not credible yet."}
                    </p>
                  ) : null}
                  {isDayTen ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Arena gate cleared. Zero partial credit, full mission pass." : "Arena gate closed. No partial credit awarded."}
                    </p>
                  ) : null}
                  {isDayEleven ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Decision locked. Scenario evolution updated." : "Decision quality failed the gate. The threat state still moves."}
                    </p>
                  ) : null}
                  {isDayThirteen ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Sensitive path confirmed. Performance score updated and next branch unlocked." : "Data-path judgment failed. Tighten the route, risk, or action logic before the leak window closes."}
                    </p>
                  ) : null}
                  {isDayFourteen ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Vector chain confirmed. Tactical score updated and the exploit path advanced." : "Vector chain failed. The web, network, or logic sequence is not credible enough yet."}
                    </p>
                  ) : null}
                  {isDayFifteen ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-80">
                      {lastValidation.accepted ? "Battle stage cleared. Board position improved and arena score updated." : "Battle stage failed. The sequence or resource tradeoff did not hold."}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 text-sm text-slate-300/82">{feedback}</p>
              <div className="mt-3 rounded-xl border border-cyan-300/12 bg-white/[0.03] p-3 text-xs text-cyan-100/70">
                Difficulty band: {detail.state.difficulty_band} | Attempts: {detail.state.attempts} | Score: {detail.state.score} | XP: {detail.state.xp_earned}
              </div>
              {lastValidation?.terminalOutput?.length ? (
                <div className="mt-4 rounded-2xl border border-cyan-300/16 bg-[#040915] p-4 font-mono text-xs text-cyan-100/82">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Execution response</p>
                  <div className="mt-3 space-y-2">
                    {lastValidation.terminalOutput.map((line, index) => (
                      <p key={`${line}-${index}`} className="break-words leading-6">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {mentorGuidance ? (
                <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300/78">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">ZORVIX guidance</p>
                  <p className="mt-2">{mentorGuidance}</p>
                </div>
              ) : null}
              {isDayFive ? (
                <div className="day-five-emotion-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "ZORVIX confirms the exploit chain is credible, evidenced, and safely contained inside the training range."
                    : "ZORVIX has not cleared this chain yet. Slow down, tighten the evidence, and prove the consequence with less noise."}
                </div>
              ) : null}
              {isDaySix ? (
                <div className="day-six-emotion-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "ZORVIX confirms the incident reasoning holds: the alert sequence is credible, containment is justified, and the evidence trail remains intact."
                    : "ZORVIX wants a cleaner SOC story here. Tie the alert, the privileged session, and the outbound signal together before choosing response."}
                </div>
              ) : null}
              {isDaySeven ? (
                <div className="day-seven-emotion-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "ZORVIX confirms the chain still holds. Recon, entry, and exploit logic are lining up into one credible mission path."
                    : "ZORVIX is pushing back on this chain. Tighten the sequence and show why the next step truly follows from the last one."}
                </div>
              ) : null}
              {isDayEight ? (
                <div className="day-eight-emotion-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "ZORVIX confirms the chosen branch is defensible: the risk tradeoff is clear and the consequence follows from the evidence."
                    : "ZORVIX is not convinced by this branch yet. Compare the alternatives, strengthen the evidence, and justify the tradeoff more clearly."}
                </div>
              ) : null}
              {isDayNine ? (
                <div className="day-nine-emotion-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? `ZORVIX confirms the incident response is holding together. ${incidentElapsed < 180 ? "Rapid-response score remains high." : "Response stayed disciplined under pressure."}`
                    : "ZORVIX wants a cleaner incident story: anchor the timeline, justify containment, and only then approve recovery."}
                </div>
              ) : null}
              {isDayTen ? (
                <div className="day-ten-emotion-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "Arena evaluator notes: mission pass accepted. Precision held."
                    : "Arena evaluator notes: this answer did not clear the gate."}
                </div>
              ) : null}
              {isDayEleven ? (
                <div className="day-eleven-judgment-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "What you did right: you committed under uncertainty and supported the move with a credible signal. Where your thinking failed: any untested assumption still narrows your margin. Risk level: elevated but defensible. Next scenario evolution: the attacker now adapts to the pressure you created."
                    : "What you did right: you moved instead of hiding behind certainty. Where your thinking failed: the signal, risk, or next-state logic did not hold together. Risk level: unstable. Next scenario evolution: the attacker keeps the initiative until your reasoning improves."}
                </div>
              ) : null}
              {isDayTwelve ? (
                <div className="day-twelve-debrief-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? "ZORVIX debrief: strong path. You chose a pivot that increased leverage, validated the credential route, and explained the privilege gain instead of just naming a host."
                    : "ZORVIX debrief: the movement chain is still loose. Tighten the source node, the access proof, and the privilege outcome before you call it a real lateral path."}
                </div>
              ) : null}
              {isDayThirteen ? (
                <div className="day-thirteen-debrief-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? `ZORVIX breakdown: strengths: you identified the sensitive path and acted on the route that actually changes impact. failures: any extra hint use or timing drift reduced confidence. risk level: high but controlled. optimal path: ${detail.state.completed ? "lock the route, preserve evidence, and hand off a tight data-loss judgment." : "keep the role logic tight, prove the route once, and move to the next scored decision."}`
                    : "ZORVIX breakdown: strengths: you engaged the right problem instead of drifting. failures: the data path, role choice, or risk explanation did not hold together. risk level: unstable. optimal path: identify the export or sync route first, then justify whether extraction or containment changes impact sooner."}
                </div>
              ) : null}
              {isDayFourteen ? (
                <div className="day-fourteen-debrief-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? `ZORVIX tactical read: strengths: you found a credible opening, used the internal reach correctly, and turned the logic flaw into a real impact chain. failures: every extra hint or slow transition lowered confidence. rank pressure: ${vectorRank}. optimal path: keep the chain short, server-side trust should fail closed, and segmenting the internal node breaks the exploit path early.`
                    : "ZORVIX tactical read: strengths: you targeted the right class of weaknesses. failures: the chain still lacks one decisive bridge between web access, network reach, and logic abuse. optimal path: prove session leverage first, then the internal service, then the logic trust break with less filler."}
                </div>
              ) : null}
              {isDayFifteen ? (
                <div className="day-fifteen-debrief-shell mt-4 rounded-2xl p-4 text-sm">
                  {lastValidation?.accepted
                    ? `ZORVIX cold evaluation: strengths: you managed tempo, spent the decisive resource at the right stage, and preserved enough board control to finish the sequence. failures: every hint and slow transition reduced strategic confidence. rank pressure: ${battleRank}. optimal approach: validate once, commit cleanly, and never spend the final reserve unless it changes the board immediately.`
                    : "ZORVIX cold evaluation: strengths: you saw the board instead of chasing a single tactic. failures: the stage sequence, resource cost, or final board advantage did not hold together. optimal approach: validate the state, commit one high-value move, and preserve one answer for the next stage."}
                </div>
              ) : null}
              {isDayThirteen ? (
                <div className="mt-4 rounded-xl border border-cyan-300/12 bg-white/[0.03] p-4 text-sm text-cyan-100/78">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Performance scoring</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Base score</p>
                      <p className="mt-2 text-lg font-semibold text-white">{detail.state.score}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Hint penalty</p>
                      <p className="mt-2 text-lg font-semibold text-white">-{exfilHintPenalty}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Speed penalty</p>
                      <p className="mt-2 text-lg font-semibold text-white">-{exfilSpeedPenalty}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-300/18 bg-emerald-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/70">Rank</p>
                      <p className="mt-2 text-lg font-semibold text-white">{exfilRank} | {exfilPerformanceScore}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayFourteen ? (
                <div className="mt-4 rounded-xl border border-cyan-300/12 bg-white/[0.03] p-4 text-sm text-cyan-100/78">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Tactical scoring</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Base score</p>
                      <p className="mt-2 text-lg font-semibold text-white">{detail.state.score}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Hint penalty</p>
                      <p className="mt-2 text-lg font-semibold text-white">-{vectorHintPenalty}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Speed penalty</p>
                      <p className="mt-2 text-lg font-semibold text-white">-{vectorSpeedPenalty}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-300/18 bg-emerald-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/70">Rank</p>
                      <p className="mt-2 text-lg font-semibold text-white">{vectorRank} | {vectorPerformanceScore}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayFifteen ? (
                <div className="mt-4 rounded-xl border border-cyan-300/12 bg-white/[0.03] p-4 text-sm text-cyan-100/78">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Battle scoring</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Base score</p>
                      <p className="mt-2 text-lg font-semibold text-white">{detail.state.score}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Hint penalty</p>
                      <p className="mt-2 text-lg font-semibold text-white">-{battleHintPenalty}</p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Tempo penalty</p>
                      <p className="mt-2 text-lg font-semibold text-white">-{battleSpeedPenalty}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-300/18 bg-emerald-500/10 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-100/70">Rank</p>
                      <p className="mt-2 text-lg font-semibold text-white">{battleRank} | {battlePerformanceScore}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              {isDayOne && lastValidation?.accepted ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/16 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Nice work. You identified the right security pillar, used the shell the right way, and explained the output like a real analyst. That is exactly the habit Day 1 is meant to build.
                </div>
              ) : null}
              {!detail.state.completed ? (
                <button type="button" className="home-clean-mini-cta-link mt-4" onClick={continueAfterValidation}>
                  <ArrowRight className="h-4 w-4" />
                  {lastValidation?.accepted ? (currentTask ? "Continue to next task" : "Review progress") : "Retry task"}
                </button>
              ) : null}
            </section>
            ) : null}

            <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Live Lab Console</p>
              <div className="mt-4 rounded-2xl border border-cyan-300/16 bg-[#040915] p-4 font-mono text-xs text-cyan-100/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="space-y-2">
                  {(terminalLog.length ? terminalLog : consoleBootLines.length ? consoleBootLines : ["[console] Waiting for the first validated action."]).slice(-12).map((line, index) => (
                    <p key={`${line}-${index}`} className="break-words leading-6">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            {detail.state.completed ? (
              <section className="glass-card premium-fade-up premium-sheen rounded-2xl p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/70">Complete</p>
                <p className="mt-2 text-sm text-emerald-100/90">Day {day} validated. You can now unlock the next day.</p>
                <div className="mission-celebration-shell mission-celebration-shell--burst mt-4 rounded-2xl border border-emerald-300/16 bg-emerald-500/10 p-4">
                  {isDayOne ? <div className="mission-complete-ribbon">Day 1 cleared</div> : null}
                  <div className="mission-confetti">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/72">Mission badge</p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-white">{detail.module.completion_badge || `Day ${day} Cleared`}</p>
                      <p className="mt-1 text-sm text-slate-300/82">Validated progression recorded. Reward, badge, and unlock state are now live.</p>
                    </div>
                    <span className="rounded-full border border-emerald-300/18 bg-emerald-500/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-50">
                      Unlocked
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-emerald-100/80">
                  {solutionExplanation.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                {isDayTen ? (
                  <div className="day-ten-debrief-shell mt-4 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/72">ZORVIX evaluator mode</p>
                    <p className="mt-3 font-mono text-sm leading-6 text-amber-50/90">{arenaDebriefText || "Preparing evaluator debrief..."}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Base Score", value: `${detail.state.score}` },
                        { label: "Penalty", value: `-${Math.round(arenaHintPenalty * 100)}%` },
                        { label: "Final Score", value: `${arenaAdjustedScore}` },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-amber-300/14 bg-amber-500/8 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/72">{item.label}</p>
                          <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-amber-300/14 bg-black/20 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/72">Rank</p>
                      <p className="mt-3 text-2xl font-semibold text-white">{arenaRank}</p>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {moduleTasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{task.title}</p>
                          <p className="mt-3 text-sm font-semibold text-white">{task.completed ? "Pass" : "Fail"}</p>
                          <p className="mt-2 text-xs text-slate-300/74">Score: {task.score}</p>
                          <p className="mt-1 text-xs text-slate-300/74">Hint used: {arenaHintedTasks.includes(task.id) ? "Yes" : "No"}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["Recon Domain", "Exploit Logic", "Incident Judgment"].map((badge) => (
                        <span key={badge} className="day-ten-badge-chip">
                          {badge}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 text-sm text-amber-100/82">Day 11 - Adversarial Scenarios unlocked.</p>
                  </div>
                ) : null}
                {isDayEleven ? (
                  <div className="day-eleven-result-shell mt-4 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">ZORVIX final judgment</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Judgment Rank", value: dayElevenRank },
                        { label: "Decision Score", value: `${detail.state.score}` },
                        { label: "Profile", value: "How you think under uncertainty" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-cyan-300/14 bg-cyan-500/8 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/72">{item.label}</p>
                          <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {debriefPoints.length ? (
                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/72">Debrief prompts</p>
                    <div className="mt-3 grid gap-2">
                      {debriefPoints.map((point) => (
                        <p key={point} className="text-sm text-slate-300/82">
                          {point}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Status", value: "Validated" },
                    { label: "Final Score", value: `${detail.state.score}` },
                    { label: "XP Earned", value: `${detail.state.xp_earned}` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-emerald-300/16 bg-emerald-500/10 p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100/72">{item.label}</p>
                      <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="home-clean-mini-cta-link"
                    onClick={() => {
                      trackDayEvent("day_lab_open_next", `day-${day}`, { unlocked_next_day: day < 60 ? day + 1 : null, progress_percent: progressPercent }).catch(() => undefined);
                      navigate(day < 60 ? `/program/day/${day + 1}` : "/program");
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                    {day < 60 ? `Open Day ${day + 1}` : "Return to program"}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ProgramLabPage;
