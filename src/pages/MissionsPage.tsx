import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayCircle, CheckCircle, Lock, Clock, Zap, Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGamificationSystem, type GamifiedMission, type MissionScope } from "@/lib/gamificationSystem";

type Tab = "daily" | "weekly";

export default function MissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { snapshot, completeMission, loading } = useGamificationSystem(user?.id, user?.name || undefined);
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [completingId, setCompletingId] = useState<string | null>(null);

  const missions = useMemo(
    () => (activeTab === "daily" ? snapshot.dailyMissions : snapshot.weeklyMissions),
    [activeTab, snapshot.dailyMissions, snapshot.weeklyMissions]
  );

  const completedCount = missions.filter((m) => m.completed).length;
  const totalCount = missions.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - Date.now();
      if (diff <= 0) { setCountdown("Resetting..."); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleComplete = async (scope: MissionScope, missionId: string) => {
    if (completingId) return;
    setCompletingId(missionId);
    try {
      await completeMission(scope, missionId);
    } catch {
      // error handled by hook
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-10 page-shell">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--theme-text)" }}>
            🎯 Missions
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--theme-text-muted)" }}>
            Complete missions to earn XP, level up, and unlock badges.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          {(["daily", "weekly"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-all"
              style={{
                backgroundColor: activeTab === tab ? "var(--theme-accent-blue)" : "var(--theme-surface)",
                color: activeTab === tab ? "var(--theme-bg)" : "var(--theme-text-muted)",
                border: `1px solid ${activeTab === tab ? "var(--theme-accent-blue)" : "var(--theme-border)"}`,
              }}
            >
              {tab === "daily" ? "⚡ Daily" : "📅 Weekly"}
            </button>
          ))}
        </div>

        {/* Countdown + Progress */}
        <div className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: "var(--theme-accent-blue)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>
                {activeTab === "daily" ? "Daily Reset" : "Weekly Reset"}:
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: "var(--theme-text)" }}>{countdown}</span>
            </div>
            <span className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>
              {completedCount}/{totalCount} completed
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--theme-overlay)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${completionPct}%`,
                background: completionPct === 100
                  ? "linear-gradient(90deg, var(--theme-accent-green), var(--theme-accent-blue))"
                  : "linear-gradient(90deg, var(--theme-accent-blue), var(--theme-accent-purple))",
              }}
            />
          </div>
        </div>

        {/* Mission Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-5 animate-pulse">
                <div className="h-5 w-48 rounded" style={{ backgroundColor: "var(--theme-overlay)" }} />
                <div className="h-3 w-full rounded mt-3" style={{ backgroundColor: "var(--theme-overlay)" }} />
                <div className="h-3 w-2/3 rounded mt-2" style={{ backgroundColor: "var(--theme-overlay)" }} />
              </div>
            ))}
          </div>
        ) : missions.length === 0 ? (
          <div className="glass-card p-10 text-center animate-fade-in-up">
            <span className="text-4xl">🎯</span>
            <h2 className="mt-3 text-lg font-semibold" style={{ color: "var(--theme-text)" }}>No missions available</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted)" }}>
              Check back soon for new {activeTab} missions!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission, i) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                index={i}
                isCompleting={completingId === mission.id}
                onComplete={() => handleComplete(mission.scope, mission.id)}
                onNavigate={() => navigate(mission.route)}
              />
            ))}
          </div>
        )}

        {/* XP Summary */}
        <div className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: `${(missions.length + 1) * 80}ms` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" style={{ color: "var(--theme-accent-purple)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--theme-text)" }}>Total XP</span>
            </div>
            <span className="text-lg font-bold" style={{ color: "var(--theme-accent-blue)" }}>
              {snapshot.totalXp.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "var(--theme-accent-blue)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--theme-text)" }}>Level</span>
            </div>
            <span className="text-lg font-bold" style={{ color: "var(--theme-accent-green)" }}>{snapshot.level}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionCard({
  mission,
  index,
  isCompleting,
  onComplete,
  onNavigate,
}: {
  mission: GamifiedMission;
  index: number;
  isCompleting: boolean;
  onComplete: () => void;
  onNavigate: () => void;
}) {
  const [justCompleted, setJustCompleted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleComplete = async () => {
    await onComplete();
    if (!mission.completed) {
      setJustCompleted(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setJustCompleted(false), 2000);
    }
  };

  return (
    <div
      className="glass-card p-5 transition-all duration-300 animate-fade-in-up"
      style={{
        animationDelay: `${index * 80}ms`,
        borderColor: mission.completed
          ? "color-mix(in srgb, var(--theme-accent-green) 30%, transparent)"
          : justCompleted
            ? "color-mix(in srgb, var(--theme-accent-blue) 50%, transparent)"
            : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{mission.completed ? "✅" : mission.kind === "port_scan" ? "🔍" : mission.kind === "cve_read" ? "📚" : mission.kind === "ctf" ? "🏴‍☠️" : "⚔️"}</span>
            <h3 className="text-sm font-semibold truncate" style={{ color: "var(--theme-text)" }}>{mission.title}</h3>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>{mission.briefing}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Zap className="h-3.5 w-3.5" style={{ color: "var(--theme-accent-blue)" }} />
          <span className="text-xs font-bold" style={{ color: "var(--theme-accent-blue)" }}>+{mission.xp}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--theme-overlay)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: mission.completed ? "100%" : "0%",
            background: "linear-gradient(90deg, var(--theme-accent-green), var(--theme-accent-blue))",
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--theme-text-dim)" }}>
          {mission.completed ? "Completed" : `${mission.scope} mission`}
        </span>
        <div className="flex gap-2">
          {!mission.completed && (
            <button
              type="button"
              onClick={onNavigate}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor: "var(--theme-overlay)",
                color: "var(--theme-text-muted)",
                border: "1px solid var(--theme-border)",
              }}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Start
            </button>
          )}
          <button
            type="button"
            onClick={handleComplete}
            disabled={mission.completed || isCompleting}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: mission.completed ? "color-mix(in srgb, var(--theme-accent-green) 15%, transparent)" : "var(--theme-accent-blue)",
              color: mission.completed ? "var(--theme-accent-green)" : "var(--theme-bg)",
            }}
          >
            {mission.completed ? (
              <><CheckCircle className="h-3.5 w-3.5" /> Done</>
            ) : isCompleting ? (
              "Claiming..."
            ) : (
              "Claim XP"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
