import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";

interface LeaderboardRow {
  position: number;
  alias: string;
  rank: string;
  points: number;
  level: number;
  streak?: number;
}

type Period = "weekly" | "monthly" | "alltime";

const periods: { key: Period; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "alltime", label: "All-Time" },
];

export default function LeaderboardCard() {
  const [activePeriod, setActivePeriod] = useState<Period>("weekly");
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLeaderboard = useCallback(async (period: Period) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await api.get<{ leaderboard: LeaderboardRow[] }>(
        `/api/intelligence/progression/leaderboard?period=${period}&limit=10`,
        { signal: controller.signal }
      );
      if (!controller.signal.aborted) {
        setLeaderboard(res.data.leaderboard || []);
      }
    } catch {
      if (!controller.signal.aborted) {
        setLeaderboard([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(activePeriod);
    return () => { abortRef.current?.abort(); };
  }, [activePeriod, fetchLeaderboard]);

  const handlePeriodChange = (period: Period) => {
    if (period === activePeriod) return;
    setActivePeriod(period);
  };

  const sorted = [...leaderboard]
    .sort((a, b) => a.position - b.position)
    .slice(0, 10);

  const topThree = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--theme-text-dim)" }}>Leaderboard</p>
          <p className="text-sm font-semibold" style={{ color: "var(--theme-text)" }}>Top Operators</p>
        </div>
        {loading && (
          <span className="text-[10px] font-medium" style={{ color: "var(--theme-text-dim)" }}>Loading...</span>
        )}
      </div>

      <div className="flex gap-1 mb-4">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePeriodChange(p.key)}
            className="flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: activePeriod === p.key ? "var(--theme-accent-blue)" : "var(--theme-overlay)",
              color: activePeriod === p.key ? "var(--theme-bg)" : "var(--theme-text-muted)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && sorted.length === 0 ? (
        <div className="py-8 text-center">
          <div className="spinner-cyber mx-auto mb-3" />
          <p className="text-xs" style={{ color: "var(--theme-text-dim)" }}>Fetching {activePeriod} rankings...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-8 text-center">
          <span className="text-3xl">🏆</span>
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--theme-text)" }}>No rankings yet</p>
          <p className="mt-1 text-xs" style={{ color: "var(--theme-text-dim)" }}>Complete labs to earn XP and rank up!</p>
        </div>
      ) : (
        <>
          {topThree.length > 0 && (
            <div className="flex items-end justify-center gap-3 mb-4">
              {[1, 0, 2].map((podiumIndex) => {
                const entry = topThree[podiumIndex];
                if (!entry) return <div key={`podium-placeholder-${podiumIndex}`} className="w-20" />;
                const isFirst = podiumIndex === 0;
                return (
                  <div key={`podium-${entry.alias}-${entry.position}`} className="flex flex-col items-center w-20">
                    <div className="text-center mb-1">
                      <p className="text-xs font-bold" style={{ color: "var(--theme-text)" }}>{entry.alias}</p>
                      <p className="text-[10px]" style={{ color: "var(--theme-text-dim)" }}>{entry.points} XP</p>
                    </div>
                    <div
                      className={`w-full ${isFirst ? "h-24" : podiumIndex === 1 ? "h-20" : "h-14"} flex items-center justify-center rounded-t-xl border border-b-0`}
                      style={{
                        backgroundColor: `var(--theme-accent-${isFirst ? "blue" : "purple"})`,
                        opacity: 0.2 + (isFirst ? 0.15 : podiumIndex === 1 ? 0.1 : 0),
                      }}
                    >
                      <span className="text-2xl">{["🥇", "🥈", "🥉"][podiumIndex]}</span>
                    </div>
                    <div className="w-full rounded-b-lg py-1 text-center text-[10px] font-bold" style={{ backgroundColor: "var(--theme-overlay)", color: "var(--theme-text-muted)" }}>
                      #{entry.position}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            {rest.map((entry) => (
              <div
                key={`list-${entry.alias}-${entry.position}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
                style={{ backgroundColor: "var(--theme-overlay)" }}
              >
                <span className="w-6 text-center text-xs font-bold" style={{ color: "var(--theme-text-dim)" }}>
                  {entry.position}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--theme-text)" }}>{entry.alias}</p>
                  <p className="text-[10px]" style={{ color: "var(--theme-text-dim)" }}>Lv.{entry.level} · {entry.rank}</p>
                </div>
                <span className="text-xs font-semibold" style={{ color: "var(--theme-accent-blue)" }}>{entry.points}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
