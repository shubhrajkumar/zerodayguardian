/**
 * DemoRoadmapPage — Public 60-mission roadmap preview for unregistered visitors.
 *
 * Cyber Rationale: Showcasing the full mission structure demonstrates platform
 * depth and helps visitors understand the learning progression before signing up.
 * No backend required — all data is client-side from the mission catalog.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Lock,
  Shield,
  Sparkles,
  Star,
  Target,
  Terminal,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import MISSION_CATALOG from "@/data/missionCatalog";

// ── Constants ──

const PHASES = [
  {
    name: "Phase 1: Reconnaissance & Foundations",
    range: [1, 20],
    description: "Learn the fundamentals of network recon, Linux operations, and build your first attack chains.",
    color: "border-emerald-500/30",
    bgColor: "bg-emerald-500/5",
    accentColor: "emerald",
  },
  {
    name: "Phase 2: Web & Application Security",
    range: [21, 40],
    description: "Master web vulnerabilities, API security, and cloud infrastructure assessment.",
    color: "border-cyan-500/30",
    bgColor: "bg-cyan-500/5",
    accentColor: "cyan",
  },
  {
    name: "Phase 3: Advanced Exploitation & Defense",
    range: [41, 60],
    description: "Advanced exploitation, forensics, purple team operations, and the final capstone challenge.",
    color: "border-purple-500/30",
    bgColor: "bg-purple-500/5",
    accentColor: "purple",
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  intermediate: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",
  advanced: "text-purple-400 border-purple-500/20 bg-purple-500/10",
  pro: "text-amber-400 border-amber-500/20 bg-amber-500/10",
};

// ── Sub-components ──

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const colors = DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.beginner;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${colors}`}
    >
      {difficulty}
    </span>
  );
};

const StatsBar = () => {
  const stats = useMemo(
    () => [
      { icon: Target, label: "Missions", value: "60" },
      { icon: Star, label: "Total XP", value: "12,450" },
      { icon: Clock, label: "Est. Hours", value: "35+" },
      { icon: Zap, label: "Skill Areas", value: "12" },
    ],
    []
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-center"
        >
          <stat.icon className="mx-auto h-5 w-5 text-cyan-400" />
          <p className="mt-2 text-xl font-bold text-white">{stat.value}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ──

export default function DemoRoadmapPage() {
  const navigate = useNavigate();
  const [expandedPhase, setExpandedPhase] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const missions = useMemo(() => MISSION_CATALOG, []);

  const filteredMissions = useMemo(() => {
    if (activeFilter === "all") return missions;
    return missions.filter((m) => m.focus.toLowerCase().includes(activeFilter) || m.difficulty === activeFilter);
  }, [missions, activeFilter]);

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "beginner", label: "Beginner" },
    { id: "intermediate", label: "Intermediate" },
    { id: "advanced", label: "Advanced" },
    { id: "Reconnaissance", label: "Recon" },
    { id: "Web Security", label: "Web" },
    { id: "Exploitation", label: "Exploit" },
    { id: "Defense", label: "Defense" },
  ];

  return (
    <div className="pb-20">
      {/* Header Section */}
      <div className="border-b border-white/8 bg-white/[0.02] px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <Sparkles className="h-3 w-3" />
            Full Curriculum Preview
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            60-Mission Cyber Security Roadmap
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400">
            Our complete curriculum takes you from absolute beginner to job-ready
            cyber security professional. Each mission builds on the last — no gaps,
            no fluff, just real skills.
          </p>

          <div className="mt-8">
            <StatsBar />
          </div>

          {/* CTA */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/labs/demo-nmap")}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-2.5 text-sm font-semibold text-cyan-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/50 active:scale-[0.98]"
            >
              <Terminal className="h-4 w-4" />
              Try Free Demo Lab
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-black transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Shield className="h-4 w-4" />
              Start Free — Create Account
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="sticky top-14 z-20 border-b border-white/8 bg-[var(--theme-bg)] px-4 py-3">
        <div className="mx-auto flex max-w-4xl gap-2 overflow-x-auto scrollbar-hide">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-all duration-200 ${
                activeFilter === tab.id
                  ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                  : "border-white/8 bg-white/[0.03] text-slate-400 hover:border-cyan-400/30 hover:text-cyan-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Phase Sections */}
      <div className="mx-auto max-w-4xl px-4 pt-8">
        {PHASES.map((phase, phaseIndex) => {
          const phaseMissions = filteredMissions.filter(
            (m) => m.number >= phase.range[0] && m.number <= phase.range[1]
          );
          if (phaseMissions.length === 0) return null;

          const isExpanded = expandedPhase === phaseIndex;

          return (
            <div key={phase.name} className="mb-8">
              {/* Phase Header */}
              <button
                type="button"
                onClick={() => setExpandedPhase(isExpanded ? -1 : phaseIndex)}
                className={`w-full rounded-2xl border ${phase.color} ${phase.bgColor} p-5 text-left transition-all duration-200 hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Phase {phaseIndex + 1}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-white">{phase.name}</h2>
                    <p className="mt-1 text-sm text-slate-400">{phase.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                    <span>{phaseMissions.length} missions</span>
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      ▼
                    </motion.span>
                  </div>
                </div>
              </button>

              {/* Missions List */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.3 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="space-y-2">
                    {phaseMissions.map((mission, i) => (
                      <motion.div
                        key={mission.number}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="group rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:border-cyan-400/20 hover:bg-cyan-500/5"
                      >
                        <div className="flex items-start gap-4">
                          {/* Mission Number */}
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-xs font-bold text-slate-400">
                            {String(mission.number).padStart(2, "0")}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-white">
                                {mission.title}
                              </h3>
                              <DifficultyBadge difficulty={mission.difficulty} />
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {mission.objective}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-600">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-400/70" />
                                {mission.xp} XP
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-slate-500" />
                                {mission.estimatedMinutes} min
                              </span>
                              <span className="text-slate-600">{mission.focus}</span>
                            </div>
                          </div>

                          {/* Lock icon for non-first missions */}
                          {mission.number > 1 && (
                            <Lock className="mt-1.5 h-3.5 w-3.5 shrink-0 text-slate-700 transition-colors group-hover:text-slate-500" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}

        {/* Bottom CTA */}
        <div className="mt-12 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold text-white">
            Ready to Start Your Journey?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400">
            Create a free account to unlock Mission 01: Recon Initiation and begin
            your path to becoming a cyber security professional.
          </p>
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="mt-6 inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-8 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Shield className="h-4 w-4" />
            Create Free Account
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Already registered?{" "}
            <a href="/auth" className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
