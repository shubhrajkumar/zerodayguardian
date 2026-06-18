import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, PlayCircle, Shield, Swords, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GlassCard from "@/components/ui/GlassCard";
import UnlockAnimation from "@/components/gamification/UnlockAnimation";
import { apiGetJson } from "@/lib/apiClient";
import { pyPostJson } from "@/lib/pyApiClient";
import { useAuth } from "@/context/AuthContext";
import { safeArray } from "@/utils/safeData";
import {
  getMissionLabel,
  getMissionTitle,
  getMissionFocus,
  getMissionDifficulty,
  getMissionXp,
} from "@/data/missionCatalog";

// ── Types ──
type DayOverviewItem = {
  day: number;
  title: string;
  focus: string;
  difficulty: string;
  unlocked: boolean;
  completed: boolean;
};

type DayOverviewResponse = {
  items: DayOverviewItem[];
  recommended_day: number;
  streak_message: string;
};

// ── Sector Configuration ──
type SectorDef = {
  id: string;
  label: string;
  days: string;
  start: number;
  end: number;
  icon: React.ReactNode;
  color: string;
};

const SECTORS: SectorDef[] = [
  { id: "sector-01", label: "Reconnaissance & Intel", days: "Days 1–10", start: 1, end: 10, icon: <Shield className="h-3.5 w-3.5" />, color: "emerald" },
  { id: "sector-02", label: "Web & Application Fundamentals", days: "Days 11–20", start: 11, end: 20, icon: <Zap className="h-3.5 w-3.5" />, color: "cyan" },
  { id: "sector-03", label: "Web Attack Surface", days: "Days 21–30", start: 21, end: 30, icon: <Swords className="h-3.5 w-3.5" />, color: "purple" },
  { id: "sector-04", label: "Cloud & Infrastructure Security", days: "Days 31–40", start: 31, end: 40, icon: <Shield className="h-3.5 w-3.5" />, color: "amber" },
  { id: "sector-05", label: "Forensics & Advanced Threats", days: "Days 41–50", start: 41, end: 50, icon: <Zap className="h-3.5 w-3.5" />, color: "rose" },
  { id: "sector-06", label: "Elite Operations & Capstone", days: "Days 51–60", start: 51, end: 60, icon: <Swords className="h-3.5 w-3.5" />, color: "emerald" },
];

const SECTOR_COLORS: Record<string, { border: string; bg: string; text: string; glow: string; badge: string; bar: string; barBg: string; barText: string; barShadow: string }> = {
  emerald: { border: "border-emerald-500/30", bg: "bg-emerald-500/8", text: "text-emerald-300", glow: "rgba(52,211,153,0.35)", badge: "bg-emerald-500/12 text-emerald-300", bar: "rgba(52,211,153,0.8)", barBg: "rgba(52,211,153,0.3)", barText: "rgb(52,211,153)", barShadow: "rgba(52,211,153,0.4)" },
  cyan: { border: "border-cyan-500/30", bg: "bg-cyan-500/8", text: "text-cyan-300", glow: "rgba(34,211,238,0.35)", badge: "bg-cyan-500/12 text-cyan-300", bar: "rgba(34,211,238,0.8)", barBg: "rgba(34,211,238,0.3)", barText: "rgb(34,211,238)", barShadow: "rgba(34,211,238,0.4)" },
  purple: { border: "border-purple-500/30", bg: "bg-purple-500/8", text: "text-purple-300", glow: "rgba(167,139,250,0.35)", badge: "bg-purple-500/12 text-purple-300", bar: "rgba(167,139,250,0.8)", barBg: "rgba(167,139,250,0.3)", barText: "rgb(167,139,250)", barShadow: "rgba(167,139,250,0.4)" },
  amber: { border: "border-amber-500/30", bg: "bg-amber-500/8", text: "text-amber-300", glow: "rgba(251,191,36,0.35)", badge: "bg-amber-500/12 text-amber-300", bar: "rgba(251,191,36,0.8)", barBg: "rgba(251,191,36,0.3)", barText: "rgb(251,191,36)", barShadow: "rgba(251,191,36,0.4)" },
  rose: { border: "border-rose-500/30", bg: "bg-rose-500/8", text: "text-rose-300", glow: "rgba(251,113,133,0.35)", badge: "bg-rose-500/12 text-rose-300", bar: "rgba(251,113,133,0.8)", barBg: "rgba(251,113,133,0.3)", barText: "rgb(251,113,133)", barShadow: "rgba(251,113,133,0.4)" },
};

// ── Fallback Generator ──
const generateFallbackOverview = (): DayOverviewResponse => {
  const items: DayOverviewItem[] = Array.from({ length: 60 }, (_, i) => ({
    day: i + 1,
    title: getMissionTitle(i + 1),
    focus: getMissionFocus(i + 1),
    difficulty: getMissionDifficulty(i + 1),
    unlocked: i === 0,
    completed: false,
  }));
  return { items, recommended_day: 1, streak_message: "Start with Mission 01 to begin your 60-day journey." };
};

// ── ProgramPage Component ──
const ProgramPage = () => {
  const navigate = useNavigate();
  const { authState, isAuthenticated, user } = useAuth();
  const [overview, setOverview] = useState<DayOverviewResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SECTORS.forEach((s) => (initial[s.id] = s.start === 1));
    return initial;
  });
  const [confettiTrigger, setConfettiTrigger] = useState(0);

  const handleConfettiDone = useCallback(() => {
    setConfettiTrigger(0);
  }, []);

  // ── Data Loading ──
  useEffect(() => {
    let active = true;
    let pyUserWarned = false;
    const ensurePyUser = async () => {
      if (!user?.email) return;
      try { await pyPostJson("/users", { email: user.email, name: user.name || user.email, external_id: user.id }); }
      catch (err) { if (!pyUserWarned) { pyUserWarned = true; console.warn("[ProgramPage] Python backend user registration failed:", err); } }
    };
    const load = async () => {
      if (authState === "loading") { setLoading(true); return; }
      if (!isAuthenticated || !user) {
        setOverview(null); setError("Sign in to unlock your daily lab journey."); setLoading(false); return;
      }
      try {
        let payload: DayOverviewResponse | null = null;
        try {
          const expr = await apiGetJson<{ items?: unknown[]; recommended_day?: number; streak_message?: string }>('/api/labs/overview');
          if (expr && Array.isArray(expr.items) && expr.items.length > 0) {
            const items = expr.items.map((item: unknown) => {
              if (!item || typeof item !== 'object') return null;
              const r = item as Record<string, unknown>;
              return { day: Number(r.day) || 1, title: String(r.title || ''), focus: String(r.focus || ''), difficulty: String(r.difficulty || 'beginner'), unlocked: Boolean(r.unlocked), completed: Boolean(r.completed) };
            }).filter(Boolean) as DayOverviewItem[];
            if (items.length > 0) payload = { items, recommended_day: Number(expr.recommended_day) || 1, streak_message: String(expr.streak_message || '') };
          }
        } catch { /* Express endpoint failed */ }
        if (!payload) payload = generateFallbackOverview();
        if (!active) return;
        setOverview(payload);
        setSelectedDay(payload.recommended_day || 1);
        setError("");
      } catch {
        if (!active) return;
        setOverview(generateFallbackOverview());
        setSelectedDay(1);
        setError("Backend unavailable. Showing default program data.");
      } finally { if (active) setLoading(false); }
    };
    ensurePyUser();
    load().catch(() => undefined);
    return () => { active = false; };
  }, [authState, isAuthenticated, user]);

  // ── Derived State ──
  const items = useMemo(() => safeArray(overview?.items), [overview]);
  const completionCount = useMemo(() => items.filter((i) => i.completed).length, [items]);
  const unlockedCount = useMemo(() => items.filter((i) => i.unlocked).length, [items]);
  const activeItem = useMemo(() => items.find((i) => i.unlocked && !i.completed) || items[0], [items]);

  const toggleSector = (id: string) => {
    setExpandedSectors((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLaunchLab = (day: number) => {
    setConfettiTrigger((prev) => prev + 1);
    setTimeout(() => navigate(`/program/day/${day}`), 600);
  };

  // ── Render ──
  return (
    <div className="relative min-h-screen">
      {/* ── Cyberpunk Background Overlay ── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* Dark base */}
        <div className="absolute inset-0 bg-[#050508]" />
        {/* Green digital grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(52, 211, 153, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(52, 211, 153, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
          }}
        />
        {/* CRT scanline */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(52, 211, 153, 0.06) 2px, rgba(52, 211, 153, 0.06) 4px)",
            backgroundSize: "100% 4px",
            animation: "crt-scan 8s linear infinite",
          }}
        />
        {/* Ambient glow orbs */}
        <div className="absolute -top-[15%] -left-[8%] w-[45%] aspect-square rounded-full opacity-[0.08] blur-[120px]" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.4), transparent 70%)" }} />
        <div className="absolute -bottom-[10%] -right-[5%] w-[35%] aspect-square rounded-full opacity-[0.05] blur-[100px]" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%)" }} />
        {/* Vignette */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
      </div>

      <div className="container mx-auto px-4 py-8 page-shell">
        <div className="mx-auto max-w-7xl space-y-5">

          {/* ── Compact Stats Dashboard ── */}
          {overview ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Completed", value: `${completionCount}/60`, accent: "emerald" },
                { label: "Unlocked", value: `${unlockedCount}/60`, accent: "cyan" },
                { label: "Current", value: activeItem ? `Day ${activeItem.day}` : "—", accent: "emerald" },
                { label: "Focus", value: activeItem ? getMissionFocus(activeItem.day) : "Core skills", accent: "slate" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-3 backdrop-blur-sm">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                  <p className={`mt-1 font-mono text-lg font-bold tracking-wider ${
                    stat.accent === "emerald" ? "text-emerald-300" :
                    stat.accent === "cyan" ? "text-cyan-300" : "text-slate-100"
                  }`}>{stat.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Loading / Error ── */}
          {loading ? <GlassCard className="rounded-xl p-4 text-sm text-cyan-100/85 font-mono">Loading tech-tree...</GlassCard> : null}
          {error ? <GlassCard className="rounded-xl p-4 text-sm text-rose-300">{error}</GlassCard> : null}

          {/* ── Hero Bar (compact) ── */}
          {overview ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                </span>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">Active Operation</p>
                  <p className="font-mono text-sm font-semibold text-emerald-100">
                    {activeItem ? getMissionLabel(activeItem.day) : "Mission 01"} — {activeItem?.title || "Recon Initiation"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="group inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300 transition-all duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/20 hover:shadow-[0_0_16px_rgba(52,211,153,0.25)] active:scale-95"
                onClick={() => handleLaunchLab(activeItem?.day || 1)}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Deploy
              </button>
            </div>
          ) : null}

          {/* ── Operational Sectors ── */}
          {overview ? (
            <div className="space-y-3">
              {SECTORS.map((sector) => {
                const sectorItems = items.filter((i) => i.day >= sector.start && i.day <= sector.end);
                const completedInSector = sectorItems.filter((i) => i.completed).length;
                const xpEarned = sectorItems.filter((i) => i.completed).reduce((sum, i) => sum + getMissionXp(i.day), 0);
                const maxXp = sectorItems.reduce((sum, i) => sum + getMissionXp(i.day), 0);
                const colors = SECTOR_COLORS[sector.color] || SECTOR_COLORS.emerald;
                const isExpanded = expandedSectors[sector.id];

                return (
                  <div key={sector.id} className="rounded-xl border border-slate-800/40 bg-slate-900/20 backdrop-blur-sm overflow-hidden transition-all duration-300">
                    {/* ── Sector Header (collapsible) ── */}
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-all duration-200 hover:brightness-110 ${
                        isExpanded ? `border-${sector.color}-500/20 ${colors.bg}` : "border-transparent"
                      }`}
                      onClick={() => toggleSector(sector.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colors.border} ${colors.bg} ${colors.text}`}>
                          {sector.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{sector.id.replace("-", " ").toUpperCase()}</p>
                          <p className="font-mono text-sm font-semibold text-slate-100 truncate">{sector.label}</p>
                          <p className="font-mono text-[10px] text-slate-600">{sector.days} — {completedInSector}/{sectorItems.length} cleared · <span style={{color: colors.barText}}>{xpEarned}</span>/{maxXp} XP</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${colors.badge}`}>
                          {completedInSector === sectorItems.length ? "CLEARED" : `${completedInSector}/${sectorItems.length}`}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* ── Sector Progress Bar ── */}
                    <div className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${completedInSector === sectorItems.length ? 'relative overflow-hidden' : ''}`}
                            style={{
                              width: `${(completedInSector / Math.max(1, sectorItems.length)) * 100}%`,
                              background: `linear-gradient(90deg, ${colors.bar}, ${colors.barBg})`,
                              boxShadow: `0 0 6px ${colors.barShadow}`,
                            }}
                          >
                            {completedInSector === sectorItems.length && (
                              <div
                                className="absolute inset-0 h-full w-full"
                                style={{
                                  background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)`,
                                  backgroundSize: "200% 100%",
                                  animation: "shimmer 1.5s ease-in-out infinite",
                                  borderRadius: "9999px",
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <span
                          className="font-mono text-[10px] font-semibold tabular-nums shrink-0"
                          style={{ color: completedInSector === sectorItems.length ? colors.barText : 'rgb(100,116,139)' }}
                        >
                          {Math.round((completedInSector / Math.max(1, sectorItems.length)) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* ── Sector Grid ── */}
                    {isExpanded && (
                      <div className="p-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                          {sectorItems.map((item) => {
                            const isActive = item.day === activeItem?.day && !item.completed;
                            const isCompleted = item.completed;
                            const isLocked = !item.unlocked;
                            const difficulty = item.difficulty || getMissionDifficulty(item.day);
                            const xp = getMissionXp(item.day);

                            return (
                              <button
                                key={item.day}
                                type="button"
                                disabled={isLocked}
                                onClick={() => {
                                  if (isLocked) return;
                                  setSelectedDay(item.day);
                                  handleLaunchLab(item.day);
                                }}
                                className={`group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                                  isActive
                                    ? // ── ACTIVE: toxic green pulse + glow ──
                                      "border-emerald-400/50 bg-emerald-500/12 shadow-[0_0_15px_rgba(0,255,102,0.25)] animate-[buzz-green_2s_ease-in-out_infinite] group-hover:animate-[glitch-shake_0.35s_ease-in-out] z-10"
                                    : isCompleted
                                      ? // ── COMPLETED: subtle green border ──
                                        "border-emerald-700/40 bg-emerald-900/15"
                                      : isLocked
                                        ? // ── LOCKED: dim + shake on hover ──
                                          "border-slate-800/50 bg-slate-900/30 opacity-40 cursor-not-allowed hover:animate-[shake_0.5s_ease-in-out]"
                                        : // ── UNLOCKED: card glitch-shake + hover border ──
                                          "border-slate-700/40 bg-slate-800/20 hover:border-emerald-500/30 hover:bg-emerald-500/8 group-hover:animate-[glitch-shake_0.35s_ease-in-out] cursor-pointer"
                                }`}
                              >
                                {/* Top row: Day + Status */}
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <span className={`font-mono text-[11px] font-bold tracking-wider ${
                                    isActive ? "text-emerald-300" :
                                    isCompleted ? "text-emerald-400/70" :
                                    isLocked ? "text-slate-600" : "text-slate-400"
                                  }`}>
                                    {String(item.day).padStart(2, "0")}
                                  </span>

                                  {/* Status icon */}
                                  {isCompleted ? (
                                    <span className="text-emerald-400/70 text-xs">✓</span>
                                  ) : isLocked ? (
                                    <span className="text-rose-400/60 group-hover:animate-pulse">🔒</span>
                                  ) : isActive ? (
                                    <span className="relative flex h-2 w-2">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                                    </span>
                                  ) : (
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500/40" />
                                    </span>
                                  )}
                                </div>

                                {/* Title */}
                                <p className={`font-mono text-[10px] font-semibold leading-tight mb-1.5 transition-all duration-200 ${
                                  isActive ? "text-emerald-100 group-hover:animate-[glitch-scan_2s_ease-in-out_infinite]" :
                                  isCompleted ? "text-emerald-200/60 line-through" :
                                  isLocked ? "text-slate-600" : "text-slate-300 group-hover:animate-[glitch-scan_2s_ease-in-out_infinite]"
                                }`}>
                                  {item.title}
                                </p>

                                {/* Bottom row: Focus + XP */}
                                <div className="mt-auto flex items-center justify-between gap-1">
                                  <span className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] ${
                                    isActive ? "bg-emerald-500/15 text-emerald-300/80" :
                                    isCompleted ? "bg-emerald-900/20 text-emerald-400/50" :
                                    isLocked ? "bg-slate-800/30 text-slate-600" : "bg-slate-700/20 text-slate-500"
                                  }`}>
                                    {difficulty.slice(0, 4)}
                                  </span>
                                  {!isLocked && (
                                    <span className={`font-mono text-[8px] ${isActive ? "text-emerald-400/70" : isCompleted ? "text-emerald-400/40" : "text-slate-500"}`}>
                                      +{xp}
                                    </span>
                                  )}
                                </div>

                                {/* Active Target badge with glow trail */}
                                {isActive && (
                                  <span className="absolute -top-2 -right-2">
                                    {/* Glow trail rings */}
                                    <span className="absolute -inset-1 rounded-full border border-emerald-400/20 animate-[glow-trail_1.5s_ease-out_infinite]" />
                                    <span className="absolute -inset-2 rounded-full border border-emerald-400/10 animate-[glow-trail_1.5s_ease-out_0.5s_infinite]" />
                                    <span className="absolute -inset-3 rounded-full border border-emerald-400/5 animate-[glow-trail_1.5s_ease-out_1s_infinite]" />
                                    {/* Badge */}
                                    <span className="relative z-10 block rounded-full border border-emerald-400/30 bg-emerald-900/90 px-2 py-0.5 font-mono text-[7px] font-bold uppercase tracking-[0.15em] text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.4)] animate-pulse">
                                      ACTIVE TARGET
                                    </span>
                                  </span>
                                )}

                                {/* Unlocked hover underline glow */}
                                {!isLocked && !isActive && !isCompleted && (
                                  <span className="absolute bottom-0 left-2 right-2 h-px scale-x-0 rounded-full bg-gradient-to-r from-emerald-400/60 via-emerald-400/20 to-transparent transition-transform duration-300 group-hover:scale-x-100" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Confetti burst on deploy */}
      <UnlockAnimation trigger={confettiTrigger > 0} onDone={handleConfettiDone} />
    </div>
  );
};

export default ProgramPage;
