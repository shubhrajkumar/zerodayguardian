import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PlatformHero from "@/components/platform/PlatformHero";
import { getPyApiUserMessage, pyGetJson, pyPostJson } from "@/lib/pyApiClient";
import { useAuth } from "@/context/AuthContext";

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

const ProgramPage = () => {
  const navigate = useNavigate();
  const { authState, isAuthenticated, user } = useAuth();
  const [overview, setOverview] = useState<DayOverviewResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      if (authState === "loading") {
        setLoading(true);
        return;
      }
      if (!isAuthenticated || !user) {
        setOverview(null);
        setError("Sign in to unlock your daily lab journey.");
        setLoading(false);
        return;
      }
      try {
        const payload = await pyGetJson<DayOverviewResponse>("/labs/overview");
        if (!active) return;
        setOverview(payload);
        setSelectedDay(payload.recommended_day || 1);
        setError("");
      } catch (err) {
        const error = err as Error & { status?: number };
        if (error.status === 404) {
          await ensurePyUser();
          const retryPayload = await pyGetJson<DayOverviewResponse>("/labs/overview");
          if (!active) return;
          setOverview(retryPayload);
          setSelectedDay(retryPayload.recommended_day || 1);
          setError("");
          return;
        }
        if (!active) return;
        setError(getPyApiUserMessage(error, "We couldn't load the day program right now."));
      } finally {
        if (active) setLoading(false);
      }
    };

    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authState, isAuthenticated, user]);

  const selected = useMemo(
    () => overview?.items.find((item) => item.day === selectedDay) || overview?.items[0] || null,
    [overview, selectedDay]
  );
  const completionCount = overview?.items.filter((item) => item.completed).length || 0;

  return (
    <div className="container grid-bg mx-auto px-4 py-12 page-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="cyber-card fadeInUp scanLine rounded-[40px] p-1">
          <PlatformHero
            eyebrow="Daily Lab Program"
            title={
              <>
                <span className="glow-text">Structured daily labs with a </span><span className="brand-gradient-text-animated">strict validation path</span>
              </>
            }
            description="The day program is built like a premium training product: pick the recommended day, complete each task, get validated, and unlock the next stage with real backend state."
            pills={[
              overview ? `${overview.items.filter((item) => item.completed).length}/60 complete` : "60 days",
              overview?.recommended_day ? `Next day ${overview.recommended_day}` : "Sign in to unlock",
            ]}
            aside={
              <div className="space-y-3 text-sm text-slate-200">
                <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Unlock rule</p>
                <p className="text-slate-100">One correct path at a time: execute the current task, validate it, collect score and XP, then unlock the next day.</p>
                <p className="text-slate-400">{overview?.streak_message || "Sign in to initialize your day-by-day lab progression."}</p>
              </div>
            }
          />
        </div>

        {loading ? <div className="glass-card cyber-card rounded-2xl p-5 text-sm text-cyan-100/72 terminal-font">Loading your program...</div> : null}
        {error ? <div className="glass-card cyber-card rounded-2xl p-5 text-sm text-rose-300">{error}</div> : null}

        {overview ? (
          <section className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Completed", value: `${completionCount}/60` },
              { label: "Recommended", value: `Day ${overview.recommended_day || 1}` },
              { label: "Unlocked", value: `${overview.items.filter((item) => item.unlocked).length}` },
              { label: "Current Focus", value: selected?.focus || "Core skills" },
            ].map((item) => (
              <div key={item.label} className="cyber-card rounded-[24px] p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </section>
        ) : null}

        {overview ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="premium-section-card cyber-card">
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Recommended Entry</p>
              <h2 className="glow-text mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Day {selected?.day}</h2>
              <p className="mt-2 text-sm text-slate-300/82">{selected?.title}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { label: "Focus", value: selected?.focus || "Core skills" },
                  { label: "Difficulty", value: selected?.difficulty || "Guided" },
                  { label: "Status", value: selected?.completed ? "Completed" : selected?.unlocked ? "Ready" : "Locked" },
                ].map((item) => (
                  <div key={item.label} className="cyber-card rounded-2xl p-4">
                    <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="cyber-card mt-5 rounded-2xl p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-cyan-100/62">Validation loop</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Read scenario", "Submit answer", "Validate", "Unlock next"].map((item) => (
                    <span key={item} className="cyber-badge">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  className="cyber-btn terminal-font"
                  disabled={!selected?.unlocked}
                  onClick={() => navigate(`/program/day/${selected?.day}`)}
                >
                  <PlayCircle className="h-4 w-4" />
                  {selected?.completed ? "Review lab" : "Launch lab"}
                </button>
              </div>
            </section>

            <section className="premium-section-card cyber-card">
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Program map</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {overview.items.map((item) => (
                  <button
                    key={item.day}
                    type="button"
                    onClick={() => setSelectedDay(item.day)}
                    className={`premium-card-lift cyber-card rounded-2xl p-4 text-left transition ${
                      selectedDay === item.day
                        ? "border-cyan-300/34 bg-cyan-500/10"
                        : item.unlocked
                          ? "border-white/8 bg-white/[0.03] hover:border-cyan-300/18"
                          : "border-white/8 bg-white/[0.02] opacity-70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Day {item.day}</p>
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      ) : item.unlocked ? (
                        <PlayCircle className="h-4 w-4 text-cyan-300" />
                      ) : (
                        <Lock className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <p className="mt-3 text-sm text-white">{item.title}</p>
                  </button>
                ))}
              </div>
              <div className="cyber-card mt-5 rounded-2xl p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">System behavior</p>
                <p className="mt-2 text-sm leading-6 text-slate-300/76">
                  Locked days stay unavailable until the previous day is validated. The UI mirrors backend unlock state directly, so there is no fake progression path.
                </p>
                <button type="button" className="premium-nav-row cyber-card mt-4 rounded-3xl" onClick={() => navigate(`/program/day/${overview.recommended_day || 1}`)}>
                  <div>
                    <p className="text-sm font-semibold text-white">Open recommended day</p>
                    <p className="mt-1 text-xs text-slate-400">Jump straight into the next backend-approved lab.</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ProgramPage;
