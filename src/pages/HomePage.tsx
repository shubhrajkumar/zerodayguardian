import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Bot, ChartLine, ChevronRight, Cpu, Radar, Shield, Swords, Terminal, TrendingUp, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useGamificationSystem, getLevelLabel, getRankIcon, getRankByLevel, getNextRank } from "@/lib/gamificationSystem";
import LandingHero from "@/components/landing/LandingHero";
import CareerPathsSection from "@/components/landing/CareerPathsSection";
import {
  staggerContainer,
  staggerItem,
  fadeInUp,
  tapScale,
  cardHover,
  springGentle,
  hoverGlow,
  sectionHeader,
  sectionHeaderItem,
} from "@/lib/animations";

/** Command Center Hero summary for authenticated users — replaces old UserProgressSummary */
const CommandCenterSummary = () => {
  const { user } = useAuth();
  const { totalPoints = 0, completedDays = 0, completedSandboxLabs = 0, streak = 0, nextMissionHook } =
    useMissionSystem();
  const { snapshot } = useGamificationSystem(user?.id, user?.name || undefined);
  const navigate = useNavigate();

  const userLabel = user?.name || user?.email?.split("@")[0] || "Operator";
  const rank = getRankByLevel(snapshot.level);
  const nextRank = getNextRank(snapshot.level);
  const rankLabel = getLevelLabel(snapshot.level);
  const rankIcon = getRankIcon(snapshot.level);

  const progressItems = [
    { label: "XP", value: totalPoints.toLocaleString(), icon: TrendingUp },
    { label: "Missions", value: completedDays.toString(), icon: Swords },
    { label: "Labs", value: completedSandboxLabs.toString(), icon: Terminal },
    { label: "Streak", value: `${streak}d`, icon: Zap },
  ];

  return (
    <section className="relative px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="hologram-card rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6 shadow-[0_0_30px_rgba(52,211,153,0.03)]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Status header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">OPERATOR COMMAND CENTER</span>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </span>
              </div>
              <p className="text-xl font-bold text-slate-100">{userLabel}</p>
              <div className="flex items-center gap-2">
                <span className="text-lg">{rankIcon}</span>
                <span className="text-sm text-cyan-300 font-semibold">{rankLabel}</span>
                {nextRank && (
                  <>
                    <span className="text-slate-600">→</span>
                    <span className="text-xs text-slate-400">Next: {nextRank.icon} {nextRank.title}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <motion.button
                type="button"
                onClick={() => navigate(nextMissionHook?.route || "/program")}
                className="group inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300 transition-all duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:shadow-[0_0_12px_rgba(52,211,153,0.15)] active:scale-[0.98]"
                whileHover={{ scale: 1.02 }}
                whileTap={tapScale}
              >
                <Swords className="h-3 w-3" />
                {nextMissionHook?.ctaLabel || "Continue Mission"}
                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </motion.button>

              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <span className="text-[10px] font-mono text-emerald-300/80">SYSTEM ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Rank progress */}
          {nextRank && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400 font-mono">{rankIcon} {rankLabel}</span>
                <span className="text-slate-400 font-mono">{nextRank.icon} {nextRank.title}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((snapshot.level - rank.minLevel) / (nextRank.minLevel - rank.minLevel)) * 100)}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          )}

          {/* Stats grid — single-line horizontal on mobile */}
          <motion.div
            className="mt-5 flex flex-row gap-2 overflow-x-auto sm:grid sm:grid-cols-4"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {progressItems.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  variants={staggerItem}
                  className="flex items-center gap-2 sm:block shrink-0 rounded-lg border border-slate-800/40 bg-slate-800/20 px-3 py-2 hover:border-slate-700/60 transition-colors sm:px-3 sm:py-2.5"
                >
                  <div className="flex items-center gap-1.5 sm:mb-1">
                    <Icon className="h-3 w-3 text-emerald-400" />
                    <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-slate-100">{item.value}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

/** Cyber Features Section — redesigned with ops terminology */
const CyberFeaturesSection = () => {
  const navigate = useNavigate();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: Terminal,
      title: "Combat Labs",
      description: "Deploy real attack & defense scenarios in a sandboxed environment. Practice penetration testing, reconnaissance, and exploitation.",
      tag: "DEPLOY",
      route: "/labs/demo-nmap",
      accent: "emerald",
    },
    {
      icon: Bot,
      title: "ZORVIX AI Mentor",
      description: "Your personal cyber coach. Assesses weaknesses, recommends missions, and guides your journey from Recruit to Elite Guardian.",
      tag: "24/7 ACTIVE",
      route: "/assistant",
      accent: "cyan",
    },
    {
      icon: Radar,
      title: "Operation Briefings",
      description: "Follow a 60-mission ops curriculum. Each briefing teaches real offensive and defensive tradecraft used in the field.",
      tag: "60 OPS",
      route: "/program",
      accent: "purple",
    },
    {
      icon: Shield,
      title: "Career Tracks",
      description: "Choose your specialization: Red Team Operator, SOC Analyst, Bug Bounty Hunter, or OSINT Investigator.",
      tag: "4 TRACKS",
      route: "/auth",
      accent: "amber",
    },
  ];

  const accentMap: Record<string, { border: string; icon: string; tagBorder: string; tagBg: string; tagText: string }> = {
    emerald: { border: "group-hover:border-emerald-500/40", icon: "text-emerald-400 border-slate-700/60 bg-slate-800/40", tagBorder: "border-emerald-500/20", tagBg: "bg-emerald-500/10", tagText: "text-emerald-300" },
    cyan: { border: "group-hover:border-cyan-500/40", icon: "text-cyan-400 border-slate-700/60 bg-slate-800/40", tagBorder: "border-cyan-500/20", tagBg: "bg-cyan-500/10", tagText: "text-cyan-300" },
    purple: { border: "group-hover:border-purple-500/40", icon: "text-purple-400 border-slate-700/60 bg-slate-800/40", tagBorder: "border-purple-500/20", tagBg: "bg-purple-500/10", tagText: "text-purple-300" },
    amber: { border: "group-hover:border-amber-500/40", icon: "text-amber-400 border-slate-700/60 bg-slate-800/40", tagBorder: "border-amber-500/20", tagBg: "bg-amber-500/10", tagText: "text-amber-300" },
  };

  return (
    <section className="relative px-4 py-16 md:py-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] aspect-square rounded-full opacity-[0.06] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(52, 211, 153, 0.2), transparent 70%)" }}
        />
      </div>
      <div className="mx-auto max-w-6xl relative z-10">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          variants={sectionHeader}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <motion.div variants={sectionHeaderItem} className="inline-flex items-center gap-2.5 rounded-full border border-slate-700/40 bg-slate-800/30 px-4 py-1.5 mb-6">
            <Cpu className="h-3 w-3 text-cyan-400" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">OPERATIONS SUITE</span>
          </motion.div>
          <motion.h2 variants={sectionHeaderItem} className="text-3xl font-bold tracking-[-0.04em] text-slate-100 md:text-4xl">
            Your Cyber Operations{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Toolkit</span>
          </motion.h2>
          <motion.p variants={sectionHeaderItem} className="mt-4 text-sm leading-6 text-slate-400 max-w-lg mx-auto">
            Everything you need to transform from Recruit to Elite Guardian — real labs, AI coaching, and structured ops.
          </motion.p>
        </motion.div>

        <motion.div
          ref={ref}
          className="mt-10 grid gap-4 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            const c = accentMap[feature.accent] || accentMap.emerald;
            return (
              <motion.button
                key={feature.title}
                type="button"
                onClick={() => navigate(feature.route)}
                variants={staggerItem}
                whileHover={cardHover}
                whileTap={tapScale}
                className={`group rounded-xl border border-slate-800/40 bg-slate-900/30 p-5 text-left ${c.border} hover:shadow-[0_0_20px_rgba(34,211,238,0.04)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${c.icon} transition-all duration-200 group-hover:scale-110`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`shrink-0 rounded-md border ${c.tagBorder} ${c.tagBg} px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] ${c.tagText}`}>
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-100 transition-colors group-hover:text-emerald-300">{feature.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{feature.description}</p>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

/** Final deployment CTA */
const DeploymentCTA = () => {
  const navigate = useNavigate();
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative px-4 py-20 md:py-32 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] aspect-square rounded-full opacity-[0.08] blur-[120px]"
          style={{ background: "radial-gradient(circle, rgba(52, 211, 153, 0.3), transparent 70%)" }}
        />
      </div>
      <motion.div
        ref={ref}
        className="relative z-10 mx-auto max-w-3xl text-center"
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={staggerContainer}
      >
        <motion.div variants={staggerItem} className="inline-flex items-center gap-2.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-5 py-2 mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300">Ready for Deployment</span>
        </motion.div>
        <motion.h2 variants={staggerItem} className="text-3xl font-bold tracking-[-0.04em] text-slate-100 md:text-4xl lg:text-5xl">
          Secure Your{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">Operator Access</span>
        </motion.h2>
        <motion.p variants={staggerItem} className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400">
          Join thousands training through real missions, not just courses. Deploy your first operation in seconds — no credit card required.
        </motion.p>
        <motion.div variants={staggerItem}>
          <motion.button
            type="button"
            onClick={() => navigate("/labs/demo-nmap")}
            className="group mt-8 inline-flex min-h-[56px] min-w-[220px] items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(52, 211, 153, 0.4)" }}
            whileTap={tapScale}
          >
            <Terminal className="h-4 w-4 transition-transform group-hover:rotate-12" />
            Deploy Free Mission
            <ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
          </motion.button>
        </motion.div>
      </motion.div>
    </section>
  );
};

const HomePage = () => {
  const { isAuthenticated, authState } = useAuth();

  return (
    <div className="min-h-screen bg-[#050508]">
      <div className="noise-overlay" />
      <LandingHero />
      {isAuthenticated && authState === "authenticated" && <CommandCenterSummary />}
      <CareerPathsSection />
      <CyberFeaturesSection />
      <DeploymentCTA />
    </div>
  );
};

export default HomePage;
