import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useZdg } from "@/context/ZdgContext";
import { useGamificationSystem, getLevelLabel, getRankIcon, getRankByLevel, getNextRank } from "@/lib/gamificationSystem";
import AnimatedCyberBackground from "@/components/AnimatedCyberBackground";
import ThreatRadar from "@/components/ThreatRadar";
import LiveClock, { formatRelativeTime } from "@/components/ui/LiveClock";
import XPBar from "@/components/gamification/XPBar";
import StreakCounter from "@/components/gamification/StreakCounter";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import LeaderboardCard from "@/components/gamification/LeaderboardCard";
import { Bot, ChartLine, ChevronRight, Cpu, Radar, Shield, Swords, Terminal, TrendingUp, Users, Zap, Activity, Target } from "lucide-react";
import {
  staggerContainer,
  staggerItem,
  staggerContainerFast,
  listContainer,
  listItem,
  tapScale,
  cardHover,
} from "@/lib/animations";

type SidebarItem = {
  label: string;
  icon: string;
  path: string;
  badge?: string;
};

const sidebarItems: SidebarItem[] = [
  { label: "Command Center", icon: "⊞", path: "/dashboard" },
  { label: "AI Mentor", icon: "✦", path: "/assistant" },
  { label: "Operations", icon: "⚙", path: "/tools" },
  { label: "Combat Labs", icon: "⚡", path: "/labs" },
  { label: "Briefings", icon: "📖", path: "/learn" },
  { label: "Intel Network", icon: "🌐", path: "/community" },
  { label: "Operator Profile", icon: "👤", path: "/profile" },
];

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { globalXp, streakCount, completedLabs } = useZdg();
  const { snapshot } = useGamificationSystem(user?.id, user?.name || undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const displayName = user?.name || user?.email?.split("@")[0] || "Guardian";
  const xp = globalXp > 0 ? globalXp : snapshot.totalXp;
  const streak = streakCount > 0 ? streakCount : snapshot.streakDays;
  const badges = snapshot.badges.length;
  const rank = getRankByLevel(snapshot.level);
  const nextRank = getNextRank(snapshot.level);
  const rankLabel = getLevelLabel(snapshot.level);
  const rankIcon = getRankIcon(snapshot.level);

  // XP progress toward next rank (each rank bracket is 1000 XP)
  const xpInLevel = xp % 1000;
  const xpPercent = (xpInLevel / 10).toFixed(1); // 0-100%

  const telemetryStats = [
    { label: "Total XP", value: xp.toLocaleString(), icon: <TrendingUp className="h-5 w-5" />, color: "from-cyan-500 to-blue-600" },
    { label: "Streak", value: `${streak} days`, icon: <Zap className="h-5 w-5" />, color: "from-emerald-500 to-teal-600" },
    { label: "Badges", value: badges.toString(), icon: <Shield className="h-5 w-5" />, color: "from-purple-500 to-pink-600" },
    { label: "Rank", value: rankLabel, icon: <span className="text-lg">{rankIcon}</span>, color: "from-amber-500 to-orange-600" },
  ] as const;

  const quickActions = [
    { label: "AI Mentor", icon: Bot, desc: "ZORVIX coaching", path: "/assistant", accent: "cyan" },
    { label: "Combat Lab", icon: Terminal, desc: "Deploy sandbox", path: "/labs", accent: "emerald" },
    { label: "Operations", icon: Cpu, desc: "Launch tools", path: "/tools", accent: "purple" },
    { label: "Briefings", icon: Target, desc: "Continue ops", path: "/learn", accent: "amber" },
  ];

  const systemStatus = [
    { label: "Command Core", status: "Active", color: "bg-emerald-400", glow: "shadow-[0_0_8px_rgba(52,211,153,0.5)]" },
    { label: "AI Uplink", status: "Synchronized", color: "bg-cyan-400", glow: "shadow-[0_0_8px_rgba(34,211,238,0.5)]" },
    { label: "Network", status: "Secure", color: "bg-emerald-400", glow: "shadow-[0_0_8px_rgba(52,211,153,0.5)]" },
    { label: "Threat Feed", status: "Nominal", color: "bg-amber-400", glow: "shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
  ] as const;

  const activeMission = {
    label: "Active Operation",
    name: nextRank ? `Advance to ${nextRank.icon} ${nextRank.title}` : "All ranks achieved",
    progress: nextRank ? Math.min(100, ((snapshot.level - rank.minLevel) / Math.max(1, nextRank.minLevel - rank.minLevel)) * 100) : 100,
    xpReward: "1,200 XP",
  };

  const colorMap: Record<string, string> = {
    cyan: "from-cyan-500/20 to-blue-600/10 border-cyan-500/30 group-hover:border-cyan-400/50",
    emerald: "from-emerald-500/20 to-teal-600/10 border-emerald-500/30 group-hover:border-emerald-400/50",
    purple: "from-purple-500/20 to-pink-600/10 border-purple-500/30 group-hover:border-purple-400/50",
    amber: "from-amber-500/20 to-orange-600/10 border-amber-500/30 group-hover:border-amber-400/50",
  };

  const iconColors: Record<string, string> = {
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    purple: "text-purple-400",
    amber: "text-amber-400",
  };

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--theme-bg)" }}>
      <AnimatedCyberBackground />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — Operations Panel */}
      <aside className={`fixed left-0 top-0 z-50 h-full w-64 transform transition-all duration-300 border-r border-slate-800/50 bg-slate-900/95 backdrop-blur-2xl ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        <div className="p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center font-bold text-sm text-[#050508] shadow-[0_0_12px_rgba(34,211,238,0.2)]">
              Z
            </div>
            <div>
              <span className="font-semibold text-sm text-slate-100">
                ZDG: <span className="gradient-text-cyan">CORE</span>
              </span>
              <p className="text-[10px] text-slate-500 font-mono">Command Interface</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-1" aria-label="Command navigation">
          {sidebarItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                location.pathname === item.path
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
              }`}
              aria-current={location.pathname === item.path ? "page" : undefined}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-slate-700 text-slate-200 border border-slate-600">
              {displayName[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate text-slate-200">{displayName}</p>
              <p className="text-[10px] text-slate-500 font-mono">{rankIcon} {rankLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Mobile Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#050508]/60 border-b border-slate-800/50 lg:hidden">
          <div className="flex items-center justify-between px-4 h-14">
            <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-3 -m-1" aria-label="Toggle command panel">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center text-[#050508] font-bold text-xs shadow-[0_0_8px_rgba(34,211,238,0.15)]">
                Z
              </div>
              <span className="font-semibold text-sm text-slate-100">Mission Control</span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm bg-slate-700 text-slate-200 border border-slate-600">
              {displayName[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="page-container py-6 md:py-8 space-y-6">
          {/* ── Welcome — Command Center Header ── */}
          <motion.div
            className="hologram-card rounded-xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-6 md:p-8 shadow-[0_0_30px_rgba(52,211,153,0.03)]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500 flex items-center gap-2">
                    <Radar className="h-3 w-3 text-cyan-400" />
                    COMMAND CENTER
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{greeting}, {displayName}</h1>
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <span>{rankIcon}</span>
                  <span>{rankLabel} • {streak > 0 && `${streak}-day streak active`}</span>
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-2">
                <LiveClock />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <motion.span
                    className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="text-xs font-medium font-mono text-emerald-300">ALL SYSTEMS OPERATIONAL</span>
                </div>
              </div>
            </div>

            {/* ── Global Threat Radar ── */}
            <div className="mt-6 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  GLOBAL THREAT RADAR
                </span>
              </div>
              <div className="flex justify-center w-full max-w-[280px] mx-auto">
                <ThreatRadar size={260} dotCount={20} />
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="font-mono text-[9px] text-slate-600">SCANNING</span>
                <span className="h-1 w-1 rounded-full bg-emerald-400/50" />
                <span className="font-mono text-[9px] text-slate-600">{xp.toLocaleString()} XP</span>
                <span className="h-1 w-1 rounded-full bg-emerald-400/50" />
                <span className="font-mono text-[9px] text-slate-600">{streak}d STREAK</span>
              </div>
            </div>
          </motion.div>

          {/* ── System Status Telemetry ── */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            variants={staggerContainerFast}
            initial="hidden"
            animate="visible"
          >
            {systemStatus.map((sys) => (
              <motion.div key={sys.label} variants={staggerItem} className="rounded-lg border border-slate-800/40 bg-slate-900/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <motion.span
                    className={`h-1.5 w-1.5 rounded-full ${sys.color} ${sys.glow}`}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{sys.label}</p>
                </div>
                <p className="text-xs font-semibold text-slate-300 mt-0.5">{sys.status}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Active Mission Briefing — XP Rank Progress ── */}
          <motion.div
            className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 p-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-cyan-400" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">RANK PROGRESS</span>
                </div>
                <p className="text-sm font-semibold text-slate-200">{rankLabel} — Next: {nextRank?.title || "MAX"}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-lg font-bold text-emerald-300">{xp.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500">XP</span>
              </div>
            </div>

            {/* ── SVG Progress Arc ── */}
            <div className="mt-4 flex flex-col items-center">
              <svg
                width="100%"
                height="64"
                viewBox="0 0 300 64"
                className="w-full max-w-xs"
                aria-hidden="true"
              >
                {/* Background track */}
                <rect x="16" y="20" width="268" height="10" rx="5" fill="rgba(30, 41, 59, 0.4)" />

                {/* XP fill bar — width via style prop for reliable CSS transition */}
                <rect
                  x="16"
                  y="20"
                  height="10"
                  rx="5"
                  fill="url(#xpGrad)"
                  className="transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(268, Math.max(0, (268 * Number(xpPercent)) / 100))}px`,
                    filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.4))",
                  }}
                />

                {/* Glow highlight on leading edge — translateX for reliable position animation */}
                <rect
                  x="0"
                  y="18"
                  width="8"
                  height="14"
                  rx="4"
                  fill="rgba(52, 211, 153, 0.3)"
                  className="transition-all duration-500 ease-out"
                  style={{
                    transform: `translateX(${Math.min(264, Math.max(12, 16 + (268 * Number(xpPercent)) / 100 - 4))}px)`,
                    filter: "blur(3px)",
                  }}
                />

                {/* Rounded end cap on fill */}
                <rect
                  x="0"
                  y="19"
                  width="6"
                  height="12"
                  rx="3"
                  fill="#34d399"
                  className="transition-all duration-500 ease-out"
                  style={{
                    transform: `translateX(${Math.min(264, Math.max(12, 16 + (268 * Number(xpPercent)) / 100 - 2))}px)`,
                  }}
                />

                {/* XP markers */}
                <text x="16" y="14" fontSize="8" fontFamily="'JetBrains Mono', monospace" fill="rgba(100, 116, 139, 0.6)">
                  0 XP
                </text>
                <text x="268" y="14" fontSize="8" fontFamily="'JetBrains Mono', monospace" fill="rgba(100, 116, 139, 0.6)" textAnchor="end">
                  1,000 XP
                </text>

                {/* Center percentage label */}
                <text
                  x="150"
                  y="52"
                  fontSize="11"
                  fontFamily="'JetBrains Mono', monospace"
                  fill="rgba(52, 211, 153, 0.7)"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {xpPercent}%
                </text>

                {/* Subtle tick marks */}
                {[25, 50, 75].map((tick) => (
                  <line
                    key={tick}
                    x1={16 + (268 * tick) / 100}
                    y1="19"
                    x2={16 + (268 * tick) / 100}
                    y2="24"
                    stroke="rgba(100, 116, 139, 0.2)"
                    strokeWidth="1"
                  />
                ))}

                <defs>
                  <linearGradient id="xpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>

              <p className="font-mono text-[10px] text-slate-500 mt-2">
                {xpInLevel} / 1,000 XP toward {nextRank?.title || "MAX"}
              </p>
            </div>
          </motion.div>

          {/* ── Telemetry Stats Grid ── */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {telemetryStats.map((stat) => {
              return (
                <motion.div
                  key={stat.label}
                  variants={staggerItem}
                  whileHover={cardHover}
                  className="rounded-xl border border-slate-800/40 bg-slate-900/30 p-4 hover:border-slate-700/60 transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shadow-lg`}>
                      {stat.icon}
                    </div>
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400/50"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="font-mono text-2xl md:text-3xl font-bold tracking-wider text-slate-100 mb-0.5">{stat.value}</p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* ── Quick Deploy Actions ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Quick Deploy</h2>
            </div>
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.label}
                    type="button"
                    onClick={() => navigate(action.path)}
                    variants={staggerItem}
                    whileHover={cardHover}
                    whileTap={tapScale}
                    className={`group rounded-xl border ${colorMap[action.accent] || colorMap.cyan} bg-slate-900/30 p-4 text-left cursor-pointer transition-all`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-200 group-hover:scale-110 bg-slate-800/50 border border-slate-700/50 ${iconColors[action.accent] || iconColors.cyan}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100 mb-0.5 transition-colors group-hover:text-emerald-300">{action.label}</h3>
                    <p className="text-xs text-slate-500">{action.desc}</p>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>

          {/* ── Gamification Section ── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Operator Progress</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <XPBar snapshot={snapshot} />
              <StreakCounter snapshot={snapshot} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <BadgeDisplay badges={snapshot.badges} />
              <LeaderboardCard />
            </div>
          </div>

          {/* ── Activity Log — Intel Feed ── */}
          <motion.div
            className="rounded-xl border border-slate-800/40 bg-slate-900/30 p-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChartLine className="h-3.5 w-3.5 text-cyan-400" />
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">Intel Feed</h2>
              </div>
              <button className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <motion.div
              className="space-y-2"
              role="list"
              aria-label="Recent activity"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
              {[
                { icon: "🛡️", text: "Threat scan completed — 0 critical findings", date: new Date(Date.now() - 2 * 60 * 1000), color: "bg-emerald-400" },
                { icon: "📊", text: "Weekly intel report generated", date: new Date(Date.now() - 1 * 60 * 60 * 1000), color: "bg-cyan-400" },
                { icon: "⚡", text: "Combat lab completed with 92% score", date: new Date(Date.now() - 3 * 60 * 60 * 1000), color: "bg-purple-400" },
                { icon: "🎯", text: "New mission unlocked: Advanced Recon", date: new Date(Date.now() - 5 * 60 * 60 * 1000), color: "bg-amber-400" },
              ].map((activity, i) => (
                <motion.div
                  key={i}
                  variants={listItem}
                  whileHover={{ x: 4, borderColor: "rgba(71, 85, 105, 0.6)", backgroundColor: "rgba(15, 15, 26, 0.5)" }}
                  className="flex items-center gap-3 rounded-lg border border-slate-800/40 bg-slate-950/30 px-3 py-3 transition-colors cursor-pointer"
                  role="listitem"
                >
                  <span className="text-lg flex-shrink-0">{activity.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{activity.text}</p>
                    <p className="font-mono text-[11px] text-slate-500">{formatRelativeTime(activity.date)}</p>
                  </div>
                  <motion.span
                    className={`h-1.5 w-1.5 rounded-full ${activity.color} shadow-[0_0_6px_rgba(52,211,153,0.5)] flex-shrink-0`}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
