import { startTransition, useMemo } from "react";
import { Brain, Flame, Radar, Rocket, Shield, Sparkles, Swords, Target, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAdaptiveMentor } from "@/context/AdaptiveMentorContext";
import { useLearningMode } from "@/context/LearningModeContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { useUserProgress } from "@/context/UserProgressContext";
import { preloadRoute } from "@/lib/routeWarmup";

const AdaptiveSaaSCommandCenter = () => {
  const navigate = useNavigate();
  const mentor = useAdaptiveMentor();
  const { mindset } = useLearningMode();
  const { progress } = useUserProgress();
  const { streakReminder, curiosityTrigger, nextMissionHook, momentum, streak, totalPoints, quickActions, recordAction } = useMissionSystem();

  const actionCards = useMemo(
    () =>
      quickActions.map((action) => ({
        ...action,
        icon:
          action.id === "mentor"
            ? Brain
            : action.id === "program"
              ? mindset === "offense"
                ? Swords
                : Shield
              : action.id === "lab"
                ? Radar
                : Target,
        warmup:
          action.route.includes("/lab")
            ? ("lab" as const)
            : action.route.includes("/tools")
              ? ("tools" as const)
              : action.route.includes("/dashboard")
                ? ("dashboard" as const)
                : ("learn" as const),
      })),
    [mindset, quickActions]
  );

  const strongest = progress.skillGraph.strongest[0]?.label || "Operator strengths still forming";
  const weakest = progress.skillGraph.weakest[0]?.label || "No weak zone identified yet";

  return (
    <section data-reveal className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <article className="glass-card premium-fade-up premium-sheen rounded-[30px] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/62">Global SaaS Control Layer</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">One AI system driving learning, simulations, and real security work</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300/80">
              Adaptive mentor guidance, real verified workflows, and engagement loops now operate as one premium product system instead of disconnected screens.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-50">
              {mentor.difficultyLabel}
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-100">
              {momentum}% momentum
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-cyan-300/16 bg-black/20 p-4">
            <p className="text-xs text-cyan-100/62">Adaptive edge</p>
            <p className="mt-2 text-lg font-semibold text-white">{mentor.pathTitle}</p>
            <p className="mt-2 text-sm text-slate-300/78">{mentor.summary}</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/16 bg-black/20 p-4">
            <p className="text-xs text-cyan-100/62">Growth loop</p>
            <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-white">
              <Flame className="h-4 w-4 text-amber-300" />
              {streak} day streak
            </p>
            <p className="mt-2 text-sm text-slate-300/78">{streakReminder}</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/16 bg-black/20 p-4">
            <p className="text-xs text-cyan-100/62">Platform maturity</p>
            <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-white">
              <Trophy className="h-4 w-4 text-cyan-300" />
              {progress.rank}
            </p>
            <p className="mt-2 text-sm text-slate-300/78">{totalPoints} mission XP banked across the SaaS loop.</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/16 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Next-Mission Intelligence</p>
              <p className="mt-2 text-lg font-semibold text-white">{nextMissionHook.title}</p>
            </div>
            <span className="rounded-full border border-cyan-300/18 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">
              {nextMissionHook.ctaLabel}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-300/80">{nextMissionHook.detail}</p>
          <p className="mt-2 text-sm text-cyan-100/78">{curiosityTrigger}</p>
        </div>
      </article>

      <article className="glass-card premium-fade-up premium-sheen rounded-[30px] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/62">Competitive Execution Grid</p>
        <div className="mt-4 grid gap-3">
          {actionCards.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onMouseEnter={() => preloadRoute(action.warmup)}
                onFocus={() => preloadRoute(action.warmup)}
                onClick={() => {
                  if (action.actionType === "mentor_open" || action.actionType === "recommendation_reviewed") {
                    recordAction(action.actionType, { target: action.actionType }).catch(() => undefined);
                  } else {
                    recordAction("command_center_opened", { target: action.id }).catch(() => undefined);
                  }
                  startTransition(() => navigate(action.route));
                }}
                className="premium-card-lift rounded-2xl border border-cyan-300/16 bg-black/20 p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-500/8"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                      <Icon className="h-4 w-4 text-cyan-300" />
                      {action.title}
                    </p>
                    <p className="mt-2 text-sm text-slate-300/78">{action.detail}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/18 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">
                    {action.status === "completed" ? "Completed" : action.cta}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-cyan-300/16 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Strongest zone</p>
            <p className="mt-2 text-base font-semibold text-white">{strongest}</p>
            <p className="mt-2 text-sm text-slate-300/76">Use this capability to accelerate confidence before pushing difficulty higher.</p>
          </div>
          <div className="rounded-2xl border border-cyan-300/16 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Weakest zone</p>
            <p className="mt-2 text-base font-semibold text-white">{weakest}</p>
            <p className="mt-2 text-sm text-slate-300/76">The ZORVIX mentor and simulations should keep targeting this until it stops slowing operator judgment.</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(34,211,238,0.09),rgba(14,165,233,0.02))] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            Premium SaaS loop
          </p>
          <p className="mt-2 text-sm text-slate-300/80">
            Learn with AI, pressure-test in simulations, validate in verified tools, then return to the dashboard with a stronger profile and clearer next move.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">
            <Rocket className="h-3.5 w-3.5" />
            Global-ready product flow
          </div>
        </div>
      </article>
    </section>
  );
};

export default AdaptiveSaaSCommandCenter;
