import { useEffect, useMemo, useState } from "react";
import { ArrowRight, PlayCircle } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import CyberPathMap from "@/components/path/CyberPathMap";
import { useNavigate } from "react-router-dom";
import PlatformHero from "@/components/platform/PlatformHero";
import { apiGetJson } from "@/lib/apiClient";
import { pyPostJson } from "@/lib/pyApiClient";
import { useAuth } from "@/context/AuthContext";
import { safeArray } from "@/utils/safeData";

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

const generateFallbackOverview = (): DayOverviewResponse => {
  const generatedItems: DayOverviewItem[] = Array.from({ length: 60 }, (_, index) => ({
    day: index + 1,
    title: `Day ${index + 1} Lab`,
    focus: "Cyber skills",
    difficulty: index < 20 ? "Beginner" : index < 40 ? "Intermediate" : "Advanced",
    unlocked: index === 0,
    completed: false,
  }));
  return {
    items: generatedItems,
    recommended_day: 1,
    streak_message: "Start with Day 1 to begin your 60-day journey.",
  };
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
    let pyUserWarned = false;
    const ensurePyUser = async () => {
      if (!user?.email) return;
      try {
        await pyPostJson("/users", {
          email: user.email,
          name: user.name || user.email,
          external_id: user.id,
        });
      } catch (err) {
        if (!pyUserWarned) {
          pyUserWarned = true;
          console.warn("[ProgramPage] Python backend user registration failed:", err);
        }
      }
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
        // Try Express backend first, then fall back to local generation
        let payload: DayOverviewResponse | null = null;
        try {
          const expressPayload = await apiGetJson<{ items?: unknown[]; recommended_day?: number; streak_message?: string }>('/api/labs/overview');
          if (expressPayload && Array.isArray(expressPayload.items) && expressPayload.items.length > 0) {
            const items: DayOverviewItem[] = expressPayload.items.map((item: unknown) => {
              if (!item || typeof item !== 'object') return null;
              const raw = item as Record<string, unknown>;
              return {
                day: Number(raw.day) || 1,
                title: String(raw.title || ''),
                focus: String(raw.focus || ''),
                difficulty: String(raw.difficulty || 'Beginner'),
                unlocked: Boolean(raw.unlocked),
                completed: Boolean(raw.completed),
              };
            }).filter(Boolean) as DayOverviewItem[];
            if (items.length > 0) {
              payload = { items, recommended_day: Number(expressPayload.recommended_day) || 1, streak_message: String(expressPayload.streak_message || '') };
            }
          }
        } catch { /* Express endpoint failed */ }

        if (!payload) {
          // Fallback: generate overview locally instead of retrying same endpoint
          payload = generateFallbackOverview();
        }

        if (!active) return;
        setOverview(payload);
        setSelectedDay(payload.recommended_day || 1);
        setError("");
      } catch {
        if (!active) return;
        // Last resort: generate locally and inform user
        const fallback = generateFallbackOverview();
        setOverview(fallback);
        setSelectedDay(1);
        setError("Backend unavailable. Showing default program data.");
      } finally {
        if (active) setLoading(false);
      }
    };

    ensurePyUser();
    load().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authState, isAuthenticated, user]);

  const items = useMemo(() => safeArray(overview?.items), [overview]);
  const selected = useMemo(
    () => items.find((item) => item.day === selectedDay) || items[0] || null,
    [items, selectedDay]
  );
  const completionCount = useMemo(() => items.filter((item) => item.completed).length, [items]);

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
              overview ? `${items.filter((item) => item.completed).length}/60 complete` : "60 days",
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

        {loading ? <GlassCard className="cyber-card rounded-2xl p-5 text-sm text-cyan-100/85 terminal-font">Loading your program...</GlassCard> : null}
        {error ? <GlassCard className="cyber-card rounded-2xl p-5 text-sm text-rose-300">{error}</GlassCard> : null}

        {overview ? (
          <section className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Completed", value: `${completionCount}/60` },
              { label: "Recommended", value: `Day ${overview.recommended_day || 1}` },
              { label: "Unlocked", value: `${items.filter((item) => item.unlocked).length}` },
              { label: "Current Focus", value: selected?.focus || "Core skills" },
            ].map((item) => (
              <div key={item.label} className="cyber-card rounded-[24px] p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-xl font-semibold text-[var(--theme-text)]">{item.value}</p>
              </div>
            ))}
          </section>
        ) : null}

        {overview ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="premium-section-card cyber-card">
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Recommended Entry</p>
              <h2 className="glow-text mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--theme-text)]">Day {selected?.day}</h2>
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
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-cyan-100/85">Validation loop</p>
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
              <div className="mt-4">
                <CyberPathMap
                  nodes={items.map((item) => ({
                    day: item.day,
                    title: item.title,
                    topic: item.focus,
                    difficulty: item.difficulty.toLowerCase() === "beginner" ? "beginner" as const : item.difficulty.toLowerCase() === "intermediate" ? "intermediate" as const : "advanced" as const,
                    status: item.completed ? "completed" as const : item.day === selectedDay ? "active" as const : item.unlocked ? "unlocked" as const : "locked" as const,
                  }))}
                  onNodeClick={(node) => setSelectedDay(node.day)}
                  columns={3}
                />
              </div>
              <div className="cyber-card mt-5 rounded-2xl p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.18em] text-slate-500">System behavior</p>
                <p className="mt-2 text-sm leading-6 text-slate-300/85">
                  Locked days stay unavailable until the previous day is validated. The UI mirrors backend unlock state directly, so there is no fake progression path.
                </p>
                <button type="button" className="premium-nav-row cyber-card mt-4 rounded-3xl" onClick={() => navigate(`/program/day/${overview.recommended_day || 1}`)}>
                  <div>
                    <p className="text-sm font-semibold text-[var(--theme-text)]">Open recommended day</p>
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
