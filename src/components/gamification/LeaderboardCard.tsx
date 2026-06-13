import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";

export interface LeaderboardEntry {
  rank: number;
  username: string;
  xp: number;
  level: number;
  avatar: string;
  userId?: string;
}

interface ApiLeaderboardRow {
  position?: number;
  alias?: string;
  rank?: string;
  points?: number;
  level?: number;
  streak?: number;
  avatar?: string;
  userId?: string;
  user_id?: string;
}

export interface LeaderboardCardProps {
  /** Optional static or websocket-fed leaderboard rows. */
  leaderboard?: LeaderboardEntry[];
  /** Current logged-in user id to highlight. */
  currentUserId?: string;
}

type Period = "weekly" | "monthly" | "alltime";

const periods: { key: Period; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "alltime", label: "All-Time" },
];

const medals = ["🥇", "🥈", "🥉"];

const toEntry = (row: ApiLeaderboardRow, index: number): LeaderboardEntry => ({
  rank: Number(row.position || index + 1),
  username: String(row.alias || `Operator ${index + 1}`),
  xp: Number(row.points || 0),
  level: Number(row.level || 1),
  avatar: String(row.avatar || "ZG"),
  userId: row.userId || row.user_id ? String(row.userId || row.user_id) : undefined,
});

const sortByXp = (rows: LeaderboardEntry[]) =>
  [...rows]
    .sort((a, b) => b.xp - a.xp || a.rank - b.rank || a.username.localeCompare(b.username))
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

/**
 * Shows the top ZeroDay Guardian learners by XP.
 *
 * The component is websocket-ready through the `leaderboard` prop and a
 * `zdg:leaderboard:update` browser event, while still fetching backend rankings
 * when no external rows are provided.
 */
export default function LeaderboardCard({ leaderboard, currentUserId = "" }: LeaderboardCardProps) {
  const [activePeriod, setActivePeriod] = useState<Period>("weekly");
  const [remoteRows, setRemoteRows] = useState<LeaderboardEntry[]>([]);
  const [liveRows, setLiveRows] = useState<LeaderboardEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchLeaderboard = useCallback(async (period: Period) => {
    if (leaderboard) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await api.get<{ leaderboard?: ApiLeaderboardRow[] }>(
        `/api/intelligence/progression/leaderboard?period=${period}&limit=10`,
        { signal: controller.signal }
      );
      if (!controller.signal.aborted) {
        setRemoteRows((res.data.leaderboard || []).map(toEntry));
      }
    } catch {
      if (!controller.signal.aborted) setRemoteRows([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [leaderboard]);

  useEffect(() => {
    fetchLeaderboard(activePeriod);
    return () => abortRef.current?.abort();
  }, [activePeriod, fetchLeaderboard]);

  useEffect(() => {
    const handleLiveUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ leaderboard?: LeaderboardEntry[] }>).detail;
      if (Array.isArray(detail?.leaderboard)) setLiveRows(detail.leaderboard);
    };
    window.addEventListener("zdg:leaderboard:update", handleLiveUpdate);
    return () => window.removeEventListener("zdg:leaderboard:update", handleLiveUpdate);
  }, []);

  const sourceRows = leaderboard || liveRows || remoteRows;
  const sorted = useMemo(() => sortByXp(sourceRows), [sourceRows]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sorted;
    return sorted.filter((entry) => entry.username.toLowerCase().includes(normalized));
  }, [query, sorted]);

  return (
    <section
      className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4"
      aria-labelledby="leaderboard-title"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Leaderboard</p>
          <h2 id="leaderboard-title" className="text-sm font-semibold text-[var(--theme-text)]">
            Top 10 Students
          </h2>
        </div>
        {loading ? <span className="text-xs text-slate-400">Loading...</span> : null}
      </div>

      <div className="mb-3 flex gap-1" role="tablist" aria-label="Leaderboard period">
        {periods.map((period) => (
          <button
            key={period.key}
            type="button"
            role="tab"
            aria-selected={activePeriod === period.key}
            onClick={() => {
              if (period.key !== activePeriod) setActivePeriod(period.key);
            }}
            className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
              activePeriod === period.key
                ? "bg-blue-400 text-slate-950"
                : "bg-[var(--theme-overlay)] text-slate-400 hover:text-slate-100"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      <label className="mb-3 block">
        <span className="sr-only">Search leaderboard</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-xl border border-[var(--theme-border)] bg-[var(--theme-overlay)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none transition focus:border-blue-300"
          placeholder="Search students"
          type="search"
        />
      </label>

      {loading && filtered.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
          <p className="text-xs text-slate-400">Fetching {activePeriod} rankings...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center">
          <span className="text-3xl" aria-hidden="true">
            🏆
          </span>
          <p className="mt-2 text-sm font-medium text-[var(--theme-text)]">No rankings yet</p>
          <p className="mt-1 text-xs text-slate-400">Complete labs to earn XP and rank up!</p>
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Top students by XP">
          {filtered.map((entry, index) => {
            const highlighted = Boolean(currentUserId && entry.userId === currentUserId);
            return (
              <li
                key={`${entry.userId || entry.username}-${entry.rank}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                  highlighted
                    ? "border-emerald-300/45 bg-emerald-400/10"
                    : "border-transparent bg-[var(--theme-overlay)]"
                }`}
                aria-current={highlighted ? "true" : undefined}
              >
                <span className="w-8 text-center text-lg font-bold text-slate-300">
                  {index < 3 ? medals[index] : entry.rank}
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-100">
                  {entry.avatar || entry.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--theme-text)]">{entry.username}</span>
                  <span className="block text-xs text-slate-400">Level {entry.level}</span>
                </span>
                <span className="text-sm font-semibold text-blue-100">{entry.xp.toLocaleString()} XP</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
