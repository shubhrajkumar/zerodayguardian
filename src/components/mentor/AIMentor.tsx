/**
 * AIMentor — Upgraded Zorvix AI Mentor with goal assessment, skill tracking,
 * personalized roadmap, daily mission recommendations, and progress tracking.
 *
 * Wraps the full-screen Zorvix chat with a mentor dashboard panel.
 */
import { useMemo, useState } from "react";
import {
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Goal,
  Map,
  Rocket,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Zorvix from "@/components/Zorvix";
import { useAuth } from "@/context/AuthContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import {
  useGamificationSystem,
  getLevelLabel,
  getRankIcon,
  getRankByLevel,
  getNextRank,
} from "@/lib/gamificationSystem";
import type { MissionFocus } from "@/data/missionCatalog";
import { getMission, getMissionTitle } from "@/data/missionCatalog";
import { useNavigate } from "react-router-dom";

// ── Types ──
type MentorTab = "chat" | "goals" | "skills" | "roadmap" | "progress";

interface SkillArea {
  id: string;
  name: string;
  icon: string;
  level: number; // 0-100
  missionsCompleted: number;
  totalMissions: number;
  color: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-100
  targetDate: string;
  type: "short" | "medium" | "long";
}

interface DailyRecommendation {
  id: string;
  title: string;
  detail: string;
  action: string;
  route: string;
  xp: number;
  priority: "high" | "medium" | "low";
}

// ── Constants ──

// Maps SkillArea.id → mission focus areas that build that skill
const SKILL_TO_FOCUS_MAP: Record<string, MissionFocus[]> = {
  recon: ["Reconnaissance"],
  web: ["Web Security"],
  exploit: ["Exploitation"],
  defense: ["Defense", "Incident Response"],
  osint: ["OSINT"],
  cloud: ["Cloud Security"],
  forensics: ["Forensics"],
  crypto: ["Cryptography"],
};

const MENTOR_TABS: { id: MentorTab; label: string; icon: typeof Brain }[] = [
  { id: "chat", label: "Chat", icon: Brain },
  { id: "goals", label: "Goals", icon: Goal },
  { id: "skills", label: "Skills", icon: BarChart3 },
  { id: "roadmap", label: "Roadmap", icon: Map },
  { id: "progress", label: "Progress", icon: TrendingUp },
];

const DEFAULT_SKILLS: SkillArea[] = [
  { id: "recon", name: "Reconnaissance", icon: "🔍", level: 0, missionsCompleted: 0, totalMissions: 12, color: "from-cyan-500 to-blue-500" },
  { id: "web", name: "Web Security", icon: "🌐", level: 0, missionsCompleted: 0, totalMissions: 14, color: "from-emerald-500 to-teal-500" },
  { id: "exploit", name: "Exploitation", icon: "💥", level: 0, missionsCompleted: 0, totalMissions: 10, color: "from-purple-500 to-pink-500" },
  { id: "defense", name: "Defense & IR", icon: "🛡️", level: 0, missionsCompleted: 0, totalMissions: 10, color: "from-blue-500 to-indigo-500" },
  { id: "osint", name: "OSINT", icon: "📡", level: 0, missionsCompleted: 0, totalMissions: 4, color: "from-amber-500 to-orange-500" },
  { id: "cloud", name: "Cloud Security", icon: "☁️", level: 0, missionsCompleted: 0, totalMissions: 6, color: "from-sky-500 to-cyan-500" },
  { id: "forensics", name: "Forensics", icon: "🔬", level: 0, missionsCompleted: 0, totalMissions: 3, color: "from-rose-500 to-pink-500" },
  { id: "crypto", name: "Cryptography", icon: "🔐", level: 0, missionsCompleted: 0, totalMissions: 2, color: "from-violet-500 to-purple-500" },
];

const GOAL_SUGGESTIONS: Goal[] = [
  { id: "goal-beginner", title: "Complete Phase 1", description: "Finish all 20 Reconnaissance & Foundations missions", progress: 0, targetDate: "30 days", type: "short" },
  { id: "goal-intermediate", title: "Web Security Specialist", description: "Complete all web security missions (21-30)", progress: 0, targetDate: "45 days", type: "medium" },
  { id: "goal-advanced", title: "Full Stack Operator", description: "Complete all 60 missions and earn Elite Guardian rank", progress: 0, targetDate: "90 days", type: "long" },
  { id: "goal-cert", title: "Certification Ready", description: "Build a portfolio of 20+ completed lab exercises", progress: 0, targetDate: "60 days", type: "medium" },
];

/**
 * Generate personalised mission recommendations based on the user's weakest skill areas.
 * For the 3 weakest skills, finds the next uncompleted mission in that focus area.
 */
function getWeakSkillRecommendations(skills: SkillArea[], completedDays: number): DailyRecommendation[] {
  if (completedDays >= 60) {
    // All missions done — show the capstone as a celebration
    return [{
      id: "rec-all-done",
      title: "All 60 Missions Complete",
      detail: "You've completed every mission! Continue practising in the sandbox labs.",
      action: "Open Lab",
      route: "/lab",
      xp: 0,
      priority: "low",
    }];
  }

  // Rank skills by gap (ratio of completed to total), ascending
  const ranked = [...skills]
    .map((s) => ({
      ...s,
      gap: s.totalMissions > 0 ? 1 - (s.missionsCompleted / s.totalMissions) : 1,
    }))
    .sort((a, b) => b.gap - a.gap);

  // Take the 3 weakest that still have missions to complete
  const weakest = ranked.filter((s) => s.gap > 0).slice(0, 3);

  if (weakest.length === 0) {
    // Fallback: no weak skills found — show generic practice recommendation
    return [{
      id: "rec-gen-practice",
      title: "Practice in Sandbox",
      detail: "All skill areas are progressing. Keep practicing in the sandbox labs.",
      action: "Open Lab",
      route: "/lab",
      xp: 100,
      priority: "medium",
    }];
  }

  // Track seen mission numbers to avoid duplicate recommendations
  const seenMissions = new Set<number>();

  return weakest.map((skill) => {
    const focusAreas = SKILL_TO_FOCUS_MAP[skill.id] ?? [];

    // Find the next uncompleted mission (number > completedDays) that matches this skill's focus
    let bestMission: { number: number; xp: number; title: string; difficulty: string } | null = null;

    for (let day = completedDays + 1; day <= 60; day++) {
      const mission = getMission(day);
      if (!mission) continue;
      if (seenMissions.has(mission.number)) continue;
      if (focusAreas.includes(mission.focus)) {
        seenMissions.add(mission.number);
        bestMission = {
          number: mission.number,
          xp: mission.xp,
          title: mission.title,
          difficulty: mission.difficulty,
        };
        break;
      }
    }

    if (!bestMission) {
      // No mission found for this skill — use a general skill-building recommendation
      return {
        id: `rec-skill-${skill.id}`,
        title: `Build ${skill.name} Skills`,
        detail: `Practice ${skill.name.toLowerCase()} techniques in the sandbox environment.`,
        action: "Open Lab",
        route: "/lab",
        xp: 100,
        priority: "medium",
      };
    }

    const isLocked = bestMission.number > completedDays + 1;
    const priority: "high" | "medium" | "low" = isLocked ? "medium" : "high";
    const actionPrefix = isLocked ? "Unlock → " : "Start → ";

    return {
      id: `rec-skill-${skill.id}-${bestMission.number}`,
      title: `${skill.icon} ${bestMission.title}`,
      detail: `${focusAreas[0]} — ${bestMission.difficulty} • Strengthen your weakest skill area`,
      action: `${actionPrefix}Mission ${String(bestMission.number).padStart(2, "0")}`,
      route: `/program/day/${bestMission.number}`,
      xp: bestMission.xp,
      priority,
    };
  });
}

// ── Sub-components ──

const SkillsRadar = ({ skills, completedDays }: { skills: SkillArea[]; completedDays: number }) => {
  const overallLevel = completedDays > 0 ? Math.min(100, Math.round((completedDays / 60) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-4">
        <p className="text-xs font-medium text-emerald-300/80">Overall Proficiency</p>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-3xl font-bold text-white">{overallLevel}%</p>
          <p className="text-xs text-slate-400">{completedDays}/60 missions</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${overallLevel}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {skills.map((skill) => {
          const level = skill.missionsCompleted > 0
            ? Math.min(100, Math.round((skill.missionsCompleted / Math.max(1, skill.totalMissions)) * 100))
            : 0;
          return (
            <div
              key={skill.id}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{skill.icon}</span>
                  <span className="text-xs font-medium text-slate-300 truncate">{skill.name}</span>
                </div>
                <span className="text-xs font-semibold text-cyan-300 shrink-0">{level}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${skill.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${level}%` }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                {skill.missionsCompleted}/{skill.totalMissions} missions
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GoalsPanel = ({ goals, completedDays }: { goals: Goal[]; completedDays: number }) => {
  const adjustedGoals = useMemo(() =>
    goals.map((g) => ({
      ...g,
      progress: Math.min(100, Math.round((completedDays / 60) * 100)),
    })),
    [goals, completedDays]
  );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-purple-400/15 bg-gradient-to-br from-purple-500/5 to-pink-500/5 p-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-purple-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Your Mission Goals</p>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Set goals to track your cyber security journey. Complete missions to make progress.
        </p>
      </div>

      {adjustedGoals.map((goal) => (
        <div
          key={goal.id}
          className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{goal.title}</p>
              <p className="mt-1 text-xs text-slate-400">{goal.description}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {goal.type}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <span className="text-xs font-medium text-purple-300 shrink-0">{goal.progress}%</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Clock className="h-3 w-3" />
            Target: {goal.targetDate}
          </div>
        </div>
      ))}
    </div>
  );
};

const RoadmapPanel = ({ rank, nextRank, level, completedDays }: {
  rank: { title: string; icon: string; description: string };
  nextRank: { title: string; icon: string; description: string } | null;
  level: number;
  completedDays: number;
}) => {
  const milestones = [
    { label: "Recruit", icon: "🪖", complete: level >= 1, current: level === 1 },
    { label: "Operator", icon: "🔐", complete: level >= 2, current: level === 2 },
    { label: "Analyst", icon: "🛡️", complete: level >= 4, current: level >= 3 && level < 4 },
    { label: "Hunter", icon: "🎯", complete: level >= 6, current: level >= 5 && level < 6 },
    { label: "Specialist", icon: "⚡", complete: level >= 8, current: level >= 7 && level < 8 },
    { label: "Guardian", icon: "👑", complete: level >= 10, current: level >= 9 && level < 10 },
    { label: "Elite 🏆", icon: "💀", complete: level >= 16, current: level >= 11 && level < 16 },
  ];

  const dayMilestones = [
    { label: "Phase 1: Foundations", missions: "1-20", complete: completedDays >= 20, progress: Math.min(100, Math.round((completedDays / 20) * 100)) },
    { label: "Phase 2: Web & AppSec", missions: "21-40", complete: completedDays >= 40, progress: Math.max(0, Math.min(100, Math.round(((completedDays - 20) / 20) * 100))) },
    { label: "Phase 3: Advanced", missions: "41-60", complete: completedDays >= 60, progress: Math.max(0, Math.min(100, Math.round(((completedDays - 40) / 20) * 100))) },
  ];

  return (
    <div className="space-y-4">
      {/* Rank progression */}
      <div className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Rank Progression</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {milestones.map((m) => (
            <div
              key={m.label}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                m.complete
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                  : m.current
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 ring-1 ring-cyan-400/30"
                    : "bg-white/[0.03] text-slate-500 border border-white/8"
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase milestones */}
      <div className="space-y-2.5">
        {dayMilestones.map((phase) => (
          <div key={phase.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-white">{phase.label}</p>
                <p className="text-[10px] text-slate-500">Missions {phase.missions}</p>
              </div>
              {phase.complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <span className="text-xs font-medium text-cyan-300 shrink-0">{phase.progress}%</span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className={`h-full rounded-full ${
                  phase.complete
                    ? "bg-emerald-400"
                    : "bg-gradient-to-r from-cyan-400 to-blue-400"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${phase.complete ? 100 : phase.progress}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Next rank info */}
      {nextRank && (
        <div className="rounded-2xl border border-amber-400/15 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Next Rank</p>
          </div>
          <p className="mt-2 text-sm font-bold text-white">{nextRank.icon} {nextRank.title}</p>
          <p className="mt-1 text-xs text-slate-400">{nextRank.description}</p>
        </div>
      )}
    </div>
  );
};

const MissionProgressGrid = ({ completedDays, onNavigate }: {
  completedDays: number;
  onNavigate: (route: string) => void;
}) => {
  const totalMissions = 60;
  const cols = 10;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-4">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-cyan-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Mission Progress</p>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {completedDays}/{totalMissions} missions cleared
          {completedDays > 0 && ` — ${Math.round((completedDays / totalMissions) * 100)}% complete`}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.round((completedDays / totalMissions) * 100))}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/50" />
          Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-cyan-400/60" />
          Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-white/10 bg-white/[0.03]" />
          Locked
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-500/30 bg-amber-500/10" />
          Phase
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
        {Array.from({ length: totalMissions }, (_, i) => {
          const missionNum = i + 1;
          const isCompleted = missionNum <= completedDays;
          const isCurrent = missionNum === completedDays + 1;
          const isLocked = !isCompleted && !isCurrent;
          // Highlight cells at the end of each phase (missions 20 and 40)
          const isPhaseBoundary = missionNum === 20 || missionNum === 40;

          return (
            <button
              key={missionNum}
              type="button"
              onClick={() => isLocked ? undefined : onNavigate(`/program/day/${missionNum}`)}
              disabled={isLocked}
              title={`${isCompleted ? "✅ " : isCurrent ? "▶ " : "🔒 "}Mission ${String(missionNum).padStart(2, "0")}: ${getMissionTitle(missionNum)}`}
              className={`
                relative flex items-center justify-center rounded-md text-[10px] font-mono font-bold
                transition-all duration-150
                ${isCompleted
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/25 hover:bg-emerald-500/35 hover:border-emerald-400/40 cursor-pointer"
                  : isCurrent
                    ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 ring-1 ring-cyan-400/40 hover:bg-cyan-500/35 cursor-pointer animate-pulse"
                    : "bg-white/[0.02] text-slate-600 border border-white/[0.06] cursor-not-allowed"
                }
                ${isPhaseBoundary ? "border-amber-500/20" : ""}
                aspect-square
              `}
              aria-label={`Mission ${missionNum}: ${getMissionTitle(missionNum)} — ${isCompleted ? "Completed" : isCurrent ? "In progress" : "Locked"}`}
            >
              {missionNum}
            </button>
          );
        })}
      </div>

      {/* Phase labels */}
      <div className="flex items-center justify-between px-0.5 text-[9px] text-slate-600">
        <span>Phase 1: Foundations</span>
        <span>Phase 2: Web & AppSec</span>
        <span>Phase 3: Advanced</span>
      </div>
    </div>
  );
};

const DailyRecommendationsPanel = ({ recommendations, completedDays, onNavigate }: {
  recommendations: DailyRecommendation[];
  completedDays: number;
  onNavigate: (route: string) => void;
}) => {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">AI Skill Recommendations</p>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {completedDays === 0
            ? "Start your first mission to unlock personalised recommendations."
            : `Targeting your weakest skill areas. ${completedDays}/60 missions completed.`}
        </p>
      </div>

      {recommendations.map((rec, i) => {
        const delay = i * 0.1;
        const isAllDone = rec.id === "rec-all-done";
        return (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay }}
            className={`rounded-xl border p-3.5 transition-all duration-200 ${
              isAllDone
                ? "border-emerald-400/20 bg-emerald-500/5 hover:border-emerald-400/30"
                : "border-white/8 bg-white/[0.03] hover:border-cyan-400/20 hover:bg-cyan-500/5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${isAllDone ? "text-emerald-300" : "text-white"}`}>{rec.title}</p>
                  {rec.priority === "high" && !isAllDone && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                      Weak Skill
                    </span>
                  )}
                  {rec.priority === "medium" && !isAllDone && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">
                      Gap Closure
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-xs ${isAllDone ? "text-emerald-400/70" : "text-slate-400"}`}>{rec.detail}</p>
              </div>
            </div>
            {!isAllDone && (
              <div className="mt-2 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/80">
                  <Zap className="h-3 w-3" />
                  +{rec.xp} XP
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(rec.route)}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  {rec.action}
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

// ── Main Component ──
export default function AIMentor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { totalPoints = 0, completedDays = 0, streak = 0, nextMissionHook } = useMissionSystem();
  const { snapshot } = useGamificationSystem(user?.id, user?.name || undefined);
  const [activeTab, setActiveTab] = useState<MentorTab>("chat");
  const [showMobileTabs, setShowMobileTabs] = useState(false);

  const level = snapshot.level;
  const rank = getRankByLevel(level);
  const nextRank = getNextRank(level);
  const rankLabel = getLevelLabel(level);
  const rankIcon = getRankIcon(level);

  const skills = useMemo(() =>
    DEFAULT_SKILLS.map((skill) => ({
      ...skill,
      // All skills start at 0 — real progress requires completed lab data from backend
      missionsCompleted: 0,
    })),
    []
  );

  const goals = useMemo(() =>
    GOAL_SUGGESTIONS.map((g) => ({
      ...g,
      progress: 0,
    })),
    []
  );

  const recommendations = useMemo(() => {
    if (completedDays === 0) {
      // First three missions from the catalog (Recon Initiation, Digital Footprint Mapping, Linux Operations)
      return [
        {
          id: "rec-start-1",
          title: "🔍 Recon Initiation",
          detail: "Reconnaissance — beginner • Perform your first SYN scan and identify open ports",
          action: "Start → Mission 01",
          route: "/program/day/1",
          xp: 100,
          priority: "high" as const,
        },
        {
          id: "rec-start-2",
          title: "🌐 Digital Footprint Mapping",
          detail: "Reconnaissance — beginner • Profile a domain using WHOIS and DNS",
          action: "Start → Mission 02",
          route: "/program/day/2",
          xp: 110,
          priority: "high" as const,
        },
        {
          id: "rec-start-3",
          title: "🖥️ Linux Operations",
          detail: "Reconnaissance — beginner • Navigate Linux and manage file permissions",
          action: "Start → Mission 03",
          route: "/program/day/3",
          xp: 100,
          priority: "high" as const,
        },
      ];
    }
    return getWeakSkillRecommendations(skills, completedDays);
  }, [completedDays, skills]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "chat":
        return (
          <div className="flex-1 flex flex-col min-h-0">
            <Zorvix fullScreen />
          </div>
        );
      case "goals":
        return (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <GoalsPanel goals={goals} completedDays={completedDays} />
          </div>
        );
      case "skills":
        return (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <SkillsRadar skills={skills} completedDays={completedDays} />
          </div>
        );
      case "roadmap":
        return (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <RoadmapPanel rank={rank} nextRank={nextRank} level={level} completedDays={completedDays} />
          </div>
        );
      case "progress":
        return (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-5">
              <MissionProgressGrid completedDays={completedDays} onNavigate={navigate} />
              <div className="border-t border-white/8 pt-5">
                <DailyRecommendationsPanel recommendations={recommendations} completedDays={completedDays} onNavigate={navigate} />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: "var(--theme-bg)" }}>
      {/* Mentor Header */}
      <header className="shrink-0 border-b border-white/8 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-white text-lg font-bold">
              Z
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate flex items-center gap-2">
                ZORVIX
                <span className="text-[10px] font-normal text-cyan-400 font-mono">Personal Cyber Mentor</span>
              </p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1.5">
                <span>{rankIcon}</span>
                <span>{rankLabel}</span>
                <span className="text-slate-600">•</span>
                <span>Lvl {level}</span>
                <span className="text-slate-600">•</span>
                <span>{completedDays} ops completed</span>
              </p>
            </div>
          </div>

          {/* Mobile tab toggle */}
          <button
            type="button"
            onClick={() => setShowMobileTabs(!showMobileTabs)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-slate-400"
            aria-label="Toggle mentor tabs"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showMobileTabs ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Tab navigation - desktop */}
        <nav className="mt-3 hidden md:flex gap-1" aria-label="Mentor sections">
          {MENTOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab navigation - mobile */}
        <AnimatePresence>
          {showMobileTabs && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-2 flex flex-wrap gap-1.5"
              aria-label="Mentor sections"
            >
              {MENTOR_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileTabs(false);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/20"
                        : "text-slate-400 border border-white/8"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                );
              })}
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {renderTabContent()}
      </div>

      {/* Quick stats footer */}
      <footer className="shrink-0 border-t border-white/8 bg-white/[0.02] px-4 py-2">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400/70" />
            {totalPoints} XP
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3 text-cyan-400/70" />
            Mission {nextMissionHook?.route ? "Ready" : "Pending"}
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-400/70" />
            {streak}d Streak
          </span>
        </div>
      </footer>
    </div>
  );
}
