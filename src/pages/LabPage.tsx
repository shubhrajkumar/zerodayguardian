import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bot, Fingerprint, Flag, Globe, PlayCircle, Radar, Search, Shield } from "lucide-react";
import { apiGetJson, apiPostJson } from "@/lib/apiClient";
import { getPyApiUserMessage, pyGetJson, pyPostJson } from "@/lib/pyApiClient";
import PlatformHero from "@/components/platform/PlatformHero";
import LabExecutionModal from "@/components/LabExecutionModal";
import { useLearningMode } from "@/context/LearningModeContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useAuth } from "@/context/AuthContext";
import { useUserProgress } from "@/context/UserProgressContext";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface LabModel {
  id: string;
  title: string;
  description: string;
  objective: string;
  practiceEnvironment: string;
  steps: string[];
  recommendedTools: string[];
  challengeModeHint: string;
  allowedCommands: string[];
  tips: string[];
  mode?: string;
  verified?: boolean;
  separationNotice?: string;
  level?: "beginner" | "intermediate" | "advanced" | "pro";
  track?: string;
  estimatedMinutes?: number;
  objectives?: string[];
  stepHints?: string[];
  scoring?: { maxPoints: number; commandPoints: number; completionBonus: number; badges: string[] };
  mentorFocus?: string;
  scenarioType?: string;
  vulnerabilityClass?: string;
  operatorRole?: string;
  attackNarrative?: string;
  realtimeSignals?: string[];
  timerMinutes?: number;
  branchOutcomes?: Array<{ id: string; title: string; condition: string; reward: string }>;
  state?: {
    score: number;
    xp_earned: number;
    attempts: number;
    completed: boolean;
    completed_objectives: string[];
    last_feedback?: string | null;
    updated_at?: string | null;
  };
}

interface MissionFeedback {
  status: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | string;
  confidence: number;
  evidenceCount: number;
  operatorAction: string;
  realtimeSignals: string[];
  mistakes?: string[];
  betterApproach?: string[];
  nextAction?: string;
  urgency?: string;
  scenarioType?: string;
  vulnerabilityClass?: string;
  operatorRole?: string;
  branchOutcome?: { id: string; title: string; condition: string; reward: string } | null;
}

interface SandboxMissionState {
  step_index: number;
  total_steps: number;
  current_objective: string;
  next_action: string;
  expected_outcome: string;
  cleared_objectives: string[];
  available_actions: string[];
}

interface RunResult {
  ok: boolean;
  code: string;
  output: string;
  tips?: string[];
  mentorHint?: string;
  explanation?: string;
  feedback?: MissionFeedback;
  mission?: SandboxMissionState;
  state?: {
    score: number;
    xp_earned: number;
    attempts: number;
    completed: boolean;
    completed_objectives: string[];
  };
  rewards?: Array<{ id: string; title: string; detail: string; earnedAt?: number }>;
}

interface ProgressionProfile {
  points: number;
  rank: string;
  level: number;
  streak: number;
  completedLabs: number;
  weeklyPoints: number;
}

interface LeaderboardRow {
  position: number;
  alias: string;
  rank: string;
  points: number;
  streak: number;
  level: number;
  completedLabs: number;
}

interface MissionReward {
  id: string;
  title: string;
  detail: string;
  earnedAt: number;
}

type PyRecommendationResponse = {
  recommendations: Array<{ title: string; reason: string; action: string; priority?: number }>;
};

type LabSandboxStatus = {
  enabled: boolean;
  ready: boolean;
  message: string;
};

type DashboardLite = {
  intelligence: {
    completedLabs: number;
    totalLabsTouched: number;
  };
};

type LabCategory = "All" | "Web App" | "Network" | "Forensics" | "OSINT" | "CTF";

const levelWeight = (value?: string) => ({ beginner: 1, intermediate: 2, advanced: 3, pro: 4 }[String(value || "").toLowerCase()] || 2);

const getLabCategory = (lab: Pick<LabModel, "id" | "title" | "track" | "objective" | "description">): LabCategory => {
  const text = `${lab.id} ${lab.title} ${lab.track || ""} ${lab.objective} ${lab.description}`.toLowerCase();
  if (/web|xss|csrf|sqli|header|http|tls|token|auth|api/.test(text)) return "Web App";
  if (/network|nmap|port|service|dns|packet|subdomain|scan/.test(text)) return "Network";
  if (/forensic|incident|log|timeline|triage|artifact|response|hunt/.test(text)) return "Forensics";
  if (/osint|whois|recon|intel|domain|mx/.test(text)) return "OSINT";
  if (/ctf|challenge|exploit|bypass|flag/.test(text)) return "CTF";
  return "Network";
};

const getCategoryIcon = (category: LabCategory) => {
  if (category === "Web App") return Globe;
  if (category === "Network") return Radar;
  if (category === "Forensics") return Fingerprint;
  if (category === "OSINT") return Search;
  if (category === "CTF") return Flag;
  return Shield;
};

const normalizeSandboxLab = (lab: Record<string, unknown>): LabModel => ({
  id: String(lab.id || ""),
  title: String(lab.title || ""),
  description: String(lab.description || ""),
  objective: String(lab.objective || ""),
  practiceEnvironment: String((lab as { practice_environment?: string }).practice_environment || (lab as { practiceEnvironment?: string }).practiceEnvironment || ""),
  steps: ((lab as { steps?: string[] }).steps as string[]) || [],
  recommendedTools: ((lab as { recommended_tools?: string[] }).recommended_tools as string[]) || (lab as { recommendedTools?: string[] }).recommendedTools || [],
  challengeModeHint: String((lab as { challenge_hint?: string }).challenge_hint || (lab as { challengeModeHint?: string }).challengeModeHint || ""),
  allowedCommands: ((lab as { allowed_commands?: string[] }).allowed_commands as string[]) || (lab as { allowedCommands?: string[] }).allowedCommands || [],
  tips: ((lab as { tips?: string[] }).tips as string[]) || [],
  level: (lab as { level?: LabModel["level"] }).level,
  track: (lab as { track?: string }).track,
  estimatedMinutes: Number((lab as { estimated_minutes?: number }).estimated_minutes || (lab as { estimatedMinutes?: number }).estimatedMinutes || 0),
  objectives: ((lab as { objectives?: string[] }).objectives as string[]) || [],
  stepHints: ((lab as { step_hints?: string[] }).step_hints as string[]) || (lab as { stepHints?: string[] }).stepHints || [],
  scoring: (lab as { scoring?: LabModel["scoring"] }).scoring,
  mentorFocus: (lab as { mentor_focus?: string }).mentor_focus || (lab as { mentorFocus?: string }).mentorFocus,
  scenarioType: (lab as { scenario_type?: string }).scenario_type || (lab as { scenarioType?: string }).scenarioType,
  vulnerabilityClass: (lab as { vulnerability_class?: string }).vulnerability_class || (lab as { vulnerabilityClass?: string }).vulnerabilityClass,
  operatorRole: (lab as { operator_role?: string }).operator_role || (lab as { operatorRole?: string }).operatorRole,
  attackNarrative: (lab as { attack_narrative?: string }).attack_narrative || (lab as { attackNarrative?: string }).attackNarrative,
  realtimeSignals: (lab as { realtime_signals?: string[] }).realtime_signals || (lab as { realtimeSignals?: string[] }).realtimeSignals || [],
  timerMinutes: Number((lab as { timer_minutes?: number }).timer_minutes || (lab as { timerMinutes?: number }).timerMinutes || 0),
  branchOutcomes: (lab as { branch_outcomes?: LabModel["branchOutcomes"] }).branch_outcomes || (lab as { branchOutcomes?: LabModel["branchOutcomes"] }).branchOutcomes || [],
  mode: (lab as { mode?: string }).mode,
  verified: (lab as { verified?: boolean }).verified,
  separationNotice: (lab as { separation_notice?: string }).separation_notice || (lab as { separationNotice?: string }).separationNotice,
  state: (lab as { state?: LabModel["state"] }).state,
});

const LabPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toolParam = searchParams.get("tool");
  const { authState, isAuthenticated } = useAuth();
  const { refreshProgress } = useUserProgress();
  const { mindset, setMindset, isDefense, accentLabel } = useLearningMode();
  const { refreshMissionData, recordAction } = useMissionSystem();

  const [labs, setLabs] = useState<LabModel[]>([]);
  const [activeLabId, setActiveLabId] = useState<string>(() => localStorage.getItem("lab:active-id") || "");
  const [activeCategory, setActiveCategory] = useState<LabCategory>("All");
  const [command, setCommand] = useState("help");
  const [consoleLines, setConsoleLines] = useState<string[]>(["Practice console ready. Type `help` to see allowed commands."]);
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mentorPrompt, setMentorPrompt] = useState("");
  const [mentorAutoReason, setMentorAutoReason] = useState("");
  const [labLoadError, setLabLoadError] = useState("");
  const [completedLabs, setCompletedLabs] = useState(0);
  const [totalLabsTouched, setTotalLabsTouched] = useState(0);
  const [progression, setProgression] = useState<ProgressionProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [sandboxStatus, setSandboxStatus] = useState<LabSandboxStatus | null>(null);
  const [pyRecommendations, setPyRecommendations] = useState<PyRecommendationResponse | null>(null);
  const [pyRecLoading, setPyRecLoading] = useState(false);
  const [pyRecError, setPyRecError] = useState("");
  const [missionFeedback, setMissionFeedback] = useState<MissionFeedback | null>(null);
  const [missionState, setMissionState] = useState<SandboxMissionState | null>(null);
  const [missionMode] = useState<"solo" | "squad">(() => (localStorage.getItem("lab:mission-mode") === "squad" ? "squad" : "solo"));
  const [missionHint, setMissionHint] = useState("");
  const [missionScore, setMissionScore] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("lab:mission-score") || "{}") as Record<string, number>; } catch { return {}; }
  });
  const [missionObjectives, setMissionObjectives] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("lab:mission-objectives") || "{}") as Record<string, string[]>; } catch { return {}; }
  });
  const [missionPulse, setMissionPulse] = useState<{ tone: "success" | "warning" | "info"; title: string; detail: string } | null>(null);
  const [recentRewards, setRecentRewards] = useState<MissionReward[]>(() => {
    try { return JSON.parse(localStorage.getItem("lab:recent-rewards") || "[]") as MissionReward[]; } catch { return []; }
  });

  useScrollReveal([activeLabId, activeCategory, missionMode]);

  useEffect(() => { localStorage.setItem("lab:mission-mode", missionMode); }, [missionMode]);
  useEffect(() => { localStorage.setItem("lab:mission-score", JSON.stringify(missionScore)); }, [missionScore]);
  useEffect(() => { localStorage.setItem("lab:mission-objectives", JSON.stringify(missionObjectives)); }, [missionObjectives]);
  useEffect(() => { localStorage.setItem("lab:recent-rewards", JSON.stringify(recentRewards.slice(0, 6))); }, [recentRewards]);
  useEffect(() => { if (activeLabId) localStorage.setItem("lab:active-id", activeLabId); }, [activeLabId]);

  const loadRecommendations = async () => {
    setPyRecLoading(true);
    setPyRecError("");
    try {
      const payload = await pyGetJson<PyRecommendationResponse>("/recommendations");
      setPyRecommendations(payload);
    } catch (error) {
      setPyRecError(getPyApiUserMessage(error, "Live recommendations are temporarily unavailable."));
    } finally {
      setPyRecLoading(false);
    }
  };

  useEffect(() => {
    if (authState === "loading") {
      return;
    }

    if (!isAuthenticated) {
      setLabs([]);
      setLabLoadError("Sign in to unlock the live sandbox range.");
      setCompletedLabs(0);
      setTotalLabsTouched(0);
      setProgression(null);
      setLeaderboard([]);
      setSandboxStatus(null);
      setPyRecommendations(null);
      setPyRecError("");
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        const labPayload = await pyGetJson<{ labs?: Array<Record<string, unknown>> }>("/labs/sandbox");
        if (!mounted) return;
        const normalized = (labPayload.labs || []).map((lab) => normalizeSandboxLab(lab));
        setLabs(normalized);
        if (!normalized.length) {
          setLabLoadError("Live labs are temporarily unavailable right now. Please retry in a moment.");
          return;
        }
        const nextActive = normalized.find((lab) => lab.id === activeLabId)?.id || normalized[0].id;
        setActiveLabId(nextActive);
        const nextScores: Record<string, number> = {};
        const nextObjectives: Record<string, string[]> = {};
        normalized.forEach((lab) => {
          if (lab.state) {
            nextScores[lab.id] = lab.state.score || 0;
            nextObjectives[lab.id] = lab.state.completed_objectives || [];
          }
        });
        setMissionScore((current) => ({ ...current, ...nextScores }));
        setMissionObjectives((current) => ({ ...current, ...nextObjectives }));
        setLabLoadError("");
      } catch (error) {
        if (mounted) setLabLoadError(getPyApiUserMessage(error, "Live labs are temporarily unavailable."));
      }

      try {
        const dashboard = await apiGetJson<DashboardLite>("/api/intelligence/dashboard");
        if (mounted) {
          setCompletedLabs(dashboard.intelligence.completedLabs || 0);
          setTotalLabsTouched(dashboard.intelligence.totalLabsTouched || 0);
        }
      } catch {
        if (mounted) {
          setCompletedLabs(0);
          setTotalLabsTouched(0);
        }
      }

      try {
        const progressionPayload = await apiGetJson<{ progression: ProgressionProfile }>("/api/intelligence/progression/me");
        if (mounted) setProgression(progressionPayload.progression || null);
      } catch {
        if (mounted) setProgression(null);
      }

      try {
        const board = await apiGetJson<{ leaderboard: LeaderboardRow[] }>("/api/intelligence/progression/leaderboard?period=weekly&limit=5");
        if (mounted) setLeaderboard(board.leaderboard || []);
      } catch {
        if (mounted) setLeaderboard([]);
      }

      try {
        const status = await pyGetJson<{ sandbox?: LabSandboxStatus }>("/labs/sandbox/status");
        if (mounted) setSandboxStatus(status.sandbox || null);
      } catch {
        if (mounted) setSandboxStatus(null);
      }

      await loadRecommendations().catch(() => undefined);
    };
    load().catch(() => undefined);
    return () => { mounted = false; };
  }, [activeLabId, authState, isAuthenticated]);

  useEffect(() => {
    if (!toolParam) return;
    setMentorAutoReason(`Direct guidance requested for tool flow: ${toolParam}`);
    setMentorPrompt(`Guide me through tool lab mode for ${toolParam}. Keep it practical, safe, and step-by-step.`);
    setMentorOpen(true);
  }, [toolParam]);

  const activeLab = useMemo(() => labs.find((lab) => lab.id === activeLabId) || null, [labs, activeLabId]);
  const prioritizedLabs = useMemo(() => [...labs].sort((a, b) => {
    const aBoost = (mindset === "offense" ? /exploit|recon|xss|sqli|bypass|attack/i : /defen|incident|phishing|contain|hardening|detect/i).test(`${a.id} ${a.title} ${a.track || ""}`) ? 20 : 0;
    const bBoost = (mindset === "offense" ? /exploit|recon|xss|sqli|bypass|attack/i : /defen|incident|phishing|contain|hardening|detect/i).test(`${b.id} ${b.title} ${b.track || ""}`) ? 20 : 0;
    return bBoost + levelWeight(b.level) - (aBoost + levelWeight(a.level));
  }), [labs, mindset]);
  const filteredLabs = useMemo(() => prioritizedLabs.filter((lab) => activeCategory === "All" || getLabCategory(lab) === activeCategory), [activeCategory, prioritizedLabs]);
  const recommendedLabs = useMemo(() => prioritizedLabs.filter((lab) => lab.id !== activeLabId).slice(0, 3), [activeLabId, prioritizedLabs]);

  const fallbackMissionState = useMemo<SandboxMissionState | null>(() => {
    if (!activeLab) return null;
    const cleared = missionObjectives[activeLab.id] || [];
    const sourceObjectives = activeLab.objectives?.length ? activeLab.objectives : activeLab.steps;
    const currentObjective = sourceObjectives.find((item) => !cleared.includes(item)) || sourceObjectives[0] || activeLab.objective;
    const nextAction = activeLab.allowedCommands.find((cmd) => !["help", "status"].includes(cmd)) || activeLab.allowedCommands[0] || "help";
    return {
      step_index: Math.min(cleared.length + 1, Math.max(1, sourceObjectives.length || 1)),
      total_steps: Math.max(1, sourceObjectives.length || 1),
      current_objective: currentObjective,
      next_action: nextAction,
      expected_outcome: `Clear "${currentObjective}" to advance the mission.`,
      cleared_objectives: cleared,
      available_actions: activeLab.allowedCommands.filter((cmd) => !["help", "status"].includes(cmd)).slice(0, 4),
    };
  }, [activeLab, missionObjectives]);

  const missionProgress = useMemo(() => {
    if (!activeLab) return 0;
    const total = activeLab.objectives?.length || activeLab.steps.length || 1;
    const cleared = (missionObjectives[activeLab.id] || []).length;
    return Math.min(100, Math.round((cleared / total) * 100));
  }, [activeLab, missionObjectives]);

  const currentMissionScore = activeLab ? missionScore[activeLab.id] || activeLab.state?.score || 0 : 0;
  const hasActiveLabSession = Boolean(activeLab && (currentMissionScore || missionProgress || activeLab.state?.attempts));
  const progressPct = totalLabsTouched ? Math.round((completedLabs / totalLabsTouched) * 100) : 0;
  const scoringMultiplier = missionMode === "squad" ? 1.2 : 1;
  const timerLabel = `${String(activeLab?.timerMinutes || activeLab?.estimatedMinutes || 12).padStart(2, "0")}:00`;
  const branchSuggestion = missionFeedback?.branchOutcome || activeLab?.branchOutcomes?.[0] || null;
  const badges = useMemo(() => {
    const out: string[] = [];
    if ((progression?.completedLabs || 0) >= 1) out.push("First Lab Cleared");
    if ((progression?.completedLabs || 0) >= 4) out.push("Sandbox Operator");
    if ((progression?.level || 0) >= 5) out.push("Level 5");
    return out;
  }, [progression]);
  const momentumPercent = Math.min(100, Math.round((missionProgress * 0.55) + ((progression?.streak || 1) * 8) + ((progression?.level || 1) * 4)));
  const dynamicDifficulty = useMemo(() => momentumPercent >= 85 ? { label: "High Focus", detail: "You are ready for a harder lab or a cleaner no-hint run.", accent: "border-blue-400/18 bg-blue-500/8 text-blue-100" } : momentumPercent >= 55 ? { label: "Steady Pace", detail: "Momentum is good. Keep chaining validated steps.", accent: "border-white/10 bg-black/20 text-slate-200" } : { label: "Warm Up", detail: "Start with guided steps and build accuracy before speed.", accent: "border-white/10 bg-black/20 text-slate-200" }, [momentumPercent]);
  const latestDebrief = useMemo(() => ({ mission: activeLab?.title || "Mission ready", headline: missionFeedback?.operatorAction || activeLab?.attackNarrative || "Run a command to generate the latest mission debrief.", nextStep: missionHint || fallbackMissionState?.next_action || "help" }), [activeLab, fallbackMissionState?.next_action, missionFeedback?.operatorAction, missionHint]);
  const missionRiskTone = useMemo(() => {
    const level = String(missionFeedback?.riskLevel || "LOW").toUpperCase();
    if (level === "HIGH") return "border-rose-300/25 bg-rose-500/10 text-rose-100";
    if (level === "MEDIUM") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  }, [missionFeedback?.riskLevel]);
  const loadSelectedLab = (lab: LabModel) => {
    setActiveLabId(lab.id);
    setCommand(lab.allowedCommands.find((cmd) => !["help", "status"].includes(cmd)) || "help");
    setConsoleLines([`Loaded ${lab.title}. Run 'help' to begin the operator workflow.`]);
  };

  const triggerMentorPrompt = () => {
    if (!activeLab) return;
    setMentorAutoReason("ZORVIX prepared a mission-aware mentor prompt from your current lab.");
    setMentorPrompt(`Guide me through ${activeLab.title} in ${mindset} mode.\nObjective: ${activeLab.objective}\nNext action: ${(missionState || fallbackMissionState)?.next_action || "help"}\nKeep it practical, safe, and explain why each step matters.`);
    setMentorOpen(true);
  };

  const openMentorWithPrompt = () => {
    navigate("/assistant", { state: { prompt: mentorPrompt } });
  };

  const runCommand = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeLab || !command.trim()) return;
    setRunning(true);
    setMissionPulse(null);
    try {
      const result = await pyPostJson<RunResult>("/labs/sandbox/run", { lab_id: activeLab.id, command });
      setConsoleLines((prev) => [...prev, `> ${command}`, result.output || "No output returned."].slice(-120));
      setMissionFeedback(result.feedback || null);
      setMissionState(result.mission || null);
      setMissionHint(result.mentorHint || result.tips?.[0] || result.explanation || "");
      if (result.state) {
        setMissionScore((prev) => ({ ...prev, [activeLab.id]: result.state?.score || 0 }));
        setMissionObjectives((prev) => ({ ...prev, [activeLab.id]: result.state?.completed_objectives || [] }));
      }
      if (result.rewards?.length) {
        const normalizedRewards = result.rewards.map((reward) => ({ id: reward.id, title: reward.title, detail: reward.detail, earnedAt: reward.earnedAt || Date.now() }));
        setRecentRewards((prev) => [...normalizedRewards, ...prev].slice(0, 6));
      }
      const completed = Boolean(result.state?.completed || result.code === "completed");
      setMissionPulse({ tone: completed ? "success" : result.ok ? "info" : "warning", title: completed ? "Mission complete" : result.ok ? "Mission updated" : "Command blocked", detail: completed ? `${activeLab.title} validated successfully. Reward flow updated and next progression unlocked.` : result.explanation || result.output || "The mission state has been updated." });
      await apiPostJson("/api/intelligence/labs/progress", { labId: activeLab.id, status: completed ? "completed" : "active" }).catch(() => undefined);
      if (completed) await recordAction("sandbox_mission_complete", { target: activeLab.id, metadata: { mode: missionMode } }).catch(() => undefined);
      await refreshProgress().catch(() => undefined);
      await refreshMissionData().catch(() => undefined);
    } catch (error) {
      setConsoleLines((prev) => [...prev, `> ${command}`, "Mission service unavailable. Retry the current step."].slice(-120));
      setMissionFeedback({ status: "service-unavailable", riskLevel: "LOW", confidence: 0, evidenceCount: 0, operatorAction: "Retry the current safe step once the service responds.", realtimeSignals: ["service-unreachable"], mistakes: ["The mission service did not respond."], betterApproach: ["Retry the current step instead of switching labs."], nextAction: (missionState || fallbackMissionState)?.next_action || "help" });
      const message = getPyApiUserMessage(error, "The last action did not complete. Retry the current step in a moment.");
      setMissionPulse({ tone: "warning", title: "Mission service unavailable", detail: message });
      setLabLoadError(message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 page-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[32px] border border-blue-400/12 bg-[#06080d] p-1">
          <PlatformHero
            eyebrow="Cyber Range"
            title={<span className="text-white">Practice Real Cyber Skills</span>}
            description={`Run real sandbox missions with clean structure, fast feedback, and ${isDefense ? "defense-first" : "offense-first"} guidance linked to live backend state.`}
            pills={[`${labs.length} labs`, `${completedLabs} completed`, progression ? `${progression.rank} rank` : "Progress tracking", sandboxStatus?.ready ? "Sandbox ready" : "Sandbox status"]}
            aside={<div className="space-y-3 text-sm text-slate-200"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Range Health</p><p>{sandboxStatus?.message || "Sandbox state appears here when the live range responds."}</p><p className="text-slate-400">{sandboxStatus?.enabled ? (sandboxStatus.ready ? "Safe sandbox ready for training" : "Sandbox enabled and warming up") : "Sandbox temporarily unavailable"}</p></div>}
          />
        </div>

        {activeLab && hasActiveLabSession ? (
          <section data-reveal className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-[#090d14] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Active Lab</p><h2 className="mt-2 text-xl font-semibold text-white">{activeLab.title}</h2><p className="mt-1 text-sm text-slate-300">Resume with {missionProgress}% progress and {currentMissionScore} score.</p></div>
            <button type="button" className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/16" onClick={() => { setCommand((missionState || fallbackMissionState)?.next_action || "help"); setLabModalOpen(true); }}><PlayCircle className="h-4 w-4" />Resume Lab</button>
          </section>
        ) : null}

        <section data-reveal className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["All", "Web App", "Network", "Forensics", "OSINT", "CTF"] as LabCategory[]).map((category) => (
                <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${activeCategory === category ? "border border-blue-400/26 bg-blue-500/10 text-blue-50" : "border border-white/10 bg-[#090d14] text-slate-300 hover:border-blue-400/18 hover:text-white"}`}>{category}</button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredLabs.slice(0, 6).map((lab) => {
                const category = getLabCategory(lab);
                const CategoryIcon = getCategoryIcon(category);
                const xpReward = lab.scoring?.completionBonus || lab.scoring?.maxPoints || 100;
                const timeEstimate = lab.estimatedMinutes || lab.timerMinutes || 12;
                return (
                  <article key={lab.id} className="rounded-[28px] border border-white/8 bg-[#090d14] p-5 transition duration-200 hover:-translate-y-1 hover:border-blue-400/18">
                    <div className="flex items-start justify-between gap-3"><div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/14 bg-blue-500/10 text-blue-200"><CategoryIcon className="h-5 w-5" /></div><span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">{String(lab.level || "intermediate").toUpperCase()}</span></div>
                    <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">{category}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{lab.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{lab.description}</p>
                    <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">XP Reward</p><p className="mt-2 font-semibold text-white">+{xpReward}</p></div><div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Time</p><p className="mt-2 font-semibold text-white">{timeEstimate} min</p></div></div>
                    <button type="button" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/18 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/16" onClick={() => { loadSelectedLab(lab); setLabModalOpen(true); }}><PlayCircle className="h-4 w-4" />Launch Lab</button>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/8 bg-[#090d14] p-5 xl:sticky xl:top-24 xl:self-start">
            <div className="flex items-center justify-between gap-2"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Leaderboard</p><h2 className="mt-2 text-xl font-semibold text-white">Top 5 This Week</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">Weekly</span></div>
            <div className="mt-5 space-y-3">{leaderboard.length ? leaderboard.map((row) => <div key={`${row.alias}-${row.position}`} className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-white">{row.position}. {row.alias}</p><p className="mt-1 text-xs text-slate-400">{row.rank} | Level {row.level}</p></div><span className="rounded-full border border-blue-400/16 px-2.5 py-1 text-[11px] text-blue-100">{row.points} pts</span></div></div>) : <p className="text-sm text-slate-400">No leaderboard data yet.</p>}</div>
          </aside>
        </section>
        {labLoadError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{labLoadError}</div> : null}

        {!labs.length ? (
          <div className="rounded-2xl border border-white/8 bg-[#090d14] px-6 py-6 text-slate-200"><h2 className="text-xl font-semibold text-white">Labs are temporarily unavailable</h2><p className="mt-3 text-sm text-slate-300">When the sandbox is ready, this page will only show runnable labs and live mission state.</p></div>
        ) : activeLab ? (
          <section data-reveal className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <article className="rounded-[28px] border border-white/8 bg-[#090d14] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Mission Board</p><h2 className="mt-2 text-2xl font-semibold text-white">{activeLab.title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{activeLab.objective}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">{progression?.rank || "Active"}</span><span className={`rounded-full border px-3 py-1 text-[11px] ${dynamicDifficulty.accent}`}>{dynamicDifficulty.label}</span></div></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Progress</p><p className="mt-2 text-xl font-semibold text-white">{missionProgress}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/6"><div className="h-full rounded-full bg-[#2f81ff] transition-all duration-500" style={{ width: `${missionProgress}%` }} /></div></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Score</p><p className="mt-2 text-xl font-semibold text-white">{currentMissionScore}</p><p className="mt-2 text-xs text-slate-400">x{scoringMultiplier.toFixed(1)} mode multiplier</p></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Estimate</p><p className="mt-2 text-xl font-semibold text-white">{timerLabel}</p><p className="mt-2 text-xs text-slate-400">{activeLab.timerMinutes || activeLab.estimatedMinutes || 12} min target</p></div></div>
                <div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Current Objective</p><p className="mt-2 text-sm font-medium text-white">{(missionState || fallbackMissionState)?.current_objective || activeLab.steps[0]}</p><p className="mt-2 text-xs text-slate-400">Next action: {(missionState || fallbackMissionState)?.next_action || "help"}</p><p className="mt-2 text-xs text-slate-400">Expected outcome: {(missionState || fallbackMissionState)?.expected_outcome || "Validate the next mission step to progress."}</p></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Simulation Mode</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => startTransition(() => setMindset("defense"))} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${isDefense ? "border-blue-400/40 bg-blue-500/10 text-blue-50" : "border-white/10 bg-black/20 text-slate-300"}`}>Defense</button><button type="button" onClick={() => startTransition(() => setMindset("offense"))} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${!isDefense ? "border-blue-400/40 bg-blue-500/10 text-blue-50" : "border-white/10 bg-black/20 text-slate-300"}`}>Offense</button></div><p className="mt-3 text-sm leading-6 text-slate-300">{dynamicDifficulty.detail}</p></div></div>
                <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/16" onClick={() => { setCommand((missionState || fallbackMissionState)?.next_action || "help"); setLabModalOpen(true); }}><PlayCircle className="h-4 w-4" />Open active step</button><button type="button" className="inline-flex items-center gap-2 rounded-full border border-blue-400/16 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:bg-blue-500/16" onClick={triggerMentorPrompt}><Bot className="h-4 w-4" />Ask ZORVIX</button></div>
              </article>

              <article className="rounded-[28px] border border-white/8 bg-[#090d14] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Attack / Defense Simulation</p><h3 className="mt-2 text-xl font-semibold text-white">Scenario breakdown</h3></div><span className={`rounded-full border px-3 py-1 text-[11px] ${missionRiskTone}`}>{missionFeedback?.riskLevel || "LOW"}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Narrative</p><p className="mt-2 text-sm leading-6 text-slate-300">{activeLab.attackNarrative || activeLab.description}</p></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Operator feedback</p><p className="mt-2 text-sm leading-6 text-slate-300">{missionFeedback?.operatorAction || "ZORVIX feedback appears here after command execution."}</p>{(missionFeedback?.realtimeSignals?.length ? missionFeedback.realtimeSignals : activeLab.realtimeSignals || []).slice(0, 4).length ? <div className="mt-3 flex flex-wrap gap-2">{(missionFeedback?.realtimeSignals?.length ? missionFeedback.realtimeSignals : activeLab.realtimeSignals || []).slice(0, 4).map((signal) => <span key={signal} className="rounded-full border border-blue-400/14 px-2.5 py-1 text-[11px] text-blue-100">{signal.replace(/-/g, " ")}</span>)}</div> : null}</div></div></article>
            </div>

            <div className="space-y-4">
              <article className="rounded-[28px] border border-white/8 bg-[#090d14] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Recommendations</p><h3 className="mt-2 text-xl font-semibold text-white">Real next actions</h3></div><button type="button" onClick={() => loadRecommendations().catch(() => undefined)} className="rounded-full border border-blue-400/16 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-100 transition hover:bg-blue-500/16" disabled={pyRecLoading}>{pyRecLoading ? "Refreshing..." : "Refresh"}</button></div>{pyRecError ? <p className="mt-3 text-xs text-rose-300">{pyRecError}</p> : null}<div className="mt-4 space-y-3">{pyRecommendations?.recommendations?.length ? pyRecommendations.recommendations.slice(0, 3).map((item) => <div key={`${item.title}-${item.action}`} className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="font-medium text-white">{item.title}</p><p className="mt-2 text-sm leading-6 text-slate-300">{item.reason}</p><p className="mt-2 text-sm text-blue-100">Action: {item.action}</p></div>) : recommendedLabs.length ? recommendedLabs.map((lab) => <button key={lab.id} type="button" onClick={() => loadSelectedLab(lab)} className="w-full rounded-2xl border border-white/8 bg-black/20 p-4 text-left transition hover:border-blue-400/18"><div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{lab.title}</p><span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{lab.level || "mission"}</span></div><p className="mt-2 text-sm leading-6 text-slate-300">{lab.objective}</p></button>) : <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">Verified recommendations appear as you complete more labs.</div>}</div></article>

              <article className="rounded-[28px] border border-white/8 bg-[#090d14] p-5"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Lab Monitor</p><h3 className="mt-2 text-xl font-semibold text-white">State, rewards, and rank</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Momentum</p><p className="mt-2 text-xl font-semibold text-white">{momentumPercent}%</p><p className="mt-2 text-xs text-slate-400">Streak {progression?.streak || 0} · {accentLabel}</p></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Overall progress</p><p className="mt-2 text-xl font-semibold text-white">{progressPct}%</p><p className="mt-2 text-xs text-slate-400">{completedLabs} completed / {Math.max(totalLabsTouched, labs.length)} touched</p></div></div><div className="mt-4 flex flex-wrap gap-2">{badges.map((badge) => <span key={badge} className="rounded-full border border-blue-400/14 px-3 py-1 text-[11px] text-blue-100">{badge}</span>)}</div>{missionPulse ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${missionPulse.tone === "success" ? "border-emerald-400/18 bg-emerald-400/8 text-emerald-100" : missionPulse.tone === "warning" ? "border-amber-400/18 bg-amber-400/8 text-amber-100" : "border-blue-400/18 bg-blue-500/8 text-blue-100"}`}><p className="font-medium">{missionPulse.title}</p><p className="mt-1 text-xs opacity-85">{missionPulse.detail}</p></div> : null}<div className="mt-4 space-y-3">{recentRewards.slice(0, 2).map((reward) => <div key={reward.id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="font-medium text-white">{reward.title}</p><p className="mt-2 text-xs text-slate-400">{reward.detail}</p></div>)}{!recentRewards.length ? <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-slate-300">Rewards and debrief snapshots appear after successful runs.</div> : null}</div></article>

              <article className="rounded-[28px] border border-white/8 bg-[#090d14] p-5"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Debrief</p><h3 className="mt-2 text-xl font-semibold text-white">{latestDebrief.mission}</h3><p className="mt-3 text-sm leading-6 text-slate-300">{latestDebrief.headline}</p><div className="mt-4 grid gap-3"><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Branch</p><p className="mt-2 text-sm text-white">{branchSuggestion?.title || "Primary branch not locked yet"}</p></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Next step</p><p className="mt-2 text-sm text-white">{latestDebrief.nextStep}</p></div></div></article>
            </div>
          </section>
        ) : null}
      </div>

      {mentorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#090d14] p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold text-white">Ask ZORVIX Mentor</h3><button type="button" className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-300 transition hover:text-white" onClick={() => setMentorOpen(false)}>Close</button></div>{mentorAutoReason ? <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{mentorAutoReason}</div> : null}<p className="mb-2 text-xs text-slate-400">Mission-aware prompt</p><textarea value={mentorPrompt} onChange={(event) => setMentorPrompt(event.target.value)} className="h-28 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none" /><div className="mt-3 flex justify-end gap-2"><button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:text-white" onClick={() => setMentorOpen(false)}>Minimize</button><button type="button" className="rounded-lg border border-blue-400/16 bg-blue-500/10 px-3 py-2 text-xs text-blue-100 transition hover:bg-blue-500/16" onClick={openMentorWithPrompt}>Open in Assistant</button></div></div></div>
      ) : null}

      {labs.length ? (
        <LabExecutionModal open={labModalOpen} activeLab={activeLab} command={command} running={running} consoleLines={consoleLines} missionFeedback={missionFeedback} missionState={missionState} missionMode={missionMode} timerLabel={timerLabel} onCommandChange={setCommand} onClose={() => setLabModalOpen(false)} onSubmit={runCommand} onPickAllowedCommand={setCommand} />
      ) : null}
    </div>
  );
};

export default LabPage;
