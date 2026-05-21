import { useEffect, useMemo } from "react";
import { ArrowRight, Bot, LockKeyhole, Radar, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";

const AssistantPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const {
    recommendations,
    nextMissionHook,
    streakReminder,
    challenge,
    totalPoints,
    momentum,
    quickActions,
    loading,
    recordAction,
  } = useMissionSystem();

  useEffect(() => {
    document.title = "ZORVIX AI | ZeroDay Guardian";
  }, []);

  const openAssistant = () => {
    recordAction("mentor_open", { target: "assistant_page" }).catch(() => undefined);
    window.dispatchEvent(new CustomEvent("neurobot:open"));
  };

  const openPrompt = (title: string, prompt: string) => {
    recordAction("mentor_open", { target: "assistant_prompt", metadata: { title } }).catch(() => undefined);
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: `assistant-${Date.now()}`,
          title,
          query: prompt,
          tags: ["mentor", "operator", "guidance", "zorvix"],
          mentorMode: true,
        },
      })
    );
    window.dispatchEvent(new CustomEvent("neurobot:open"));
  };

  const missionPhases = useMemo(
    () => [
      {
        id: "objective",
        title: "Objective",
        detail: nextMissionHook.title || "No active mission loaded",
      },
      {
        id: "decision",
        title: "Decision",
        detail: recommendations[0]?.action || "Choose the highest-value operator move next",
      },
      {
        id: "feedback",
        title: "Feedback",
        detail: loading ? "Refreshing live mission state" : streakReminder,
      },
      {
        id: "evolve",
        title: "Evolve",
        detail: `${challenge.progress}/${challenge.goal} daily momentum actions complete`,
      },
    ],
    [challenge.goal, challenge.progress, loading, nextMissionHook.title, recommendations, streakReminder]
  );

  const controlStats = useMemo(
    () => [
      { label: "Auth", value: isAuthenticated ? "Secure" : "Required" },
      { label: "XP", value: `${totalPoints}` },
      { label: "Momentum", value: `${momentum}` },
      { label: "Daily", value: `${challenge.progress}/${challenge.goal}` },
    ],
    [challenge.goal, challenge.progress, isAuthenticated, momentum, totalPoints]
  );

  const promptGrid = useMemo(
    () => [
      {
        title: "Mission Recovery",
        prompt: `Act as ZORVIX AI. Current mission: ${nextMissionHook.title}. Tell me the exact next action, the risk if I choose wrong, and the cleanest validation signal.`,
      },
      {
        title: "Threat Reasoning",
        prompt: recommendations[0]?.action || "Analyze my current cyber decision-making and tell me the highest-leverage next move.",
      },
      {
        title: "Cold Debrief",
        prompt: `Debrief my current learning state. Context: ${streakReminder}. Tell me what is strong, what is weak, and what I should execute next.`,
      },
    ],
    [nextMissionHook.title, recommendations, streakReminder]
  );

  return (
    <div className="assistant-page-shell relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0f] text-[#e2e8f0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(0,102,255,0.16),transparent_26%),radial-gradient(circle_at_50%_76%,rgba(0,255,136,0.10),transparent_30%),linear-gradient(180deg,#0a0a0f_0%,#0b1020_52%,#0a0a0f_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] opacity-15" />

      <motion.div
        className="pointer-events-none absolute left-1/2 top-14 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,255,136,0.12)_0%,rgba(0,102,255,0.10)_38%,transparent_72%)] blur-3xl"
        animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="container relative z-10 mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-5xl space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-3xl text-center"
          >
            <p className="terminal-font text-[11px] uppercase tracking-[0.44em] text-cyan-100/58">ZeroDay Guardian</p>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] text-white md:text-6xl">
              <span className="bg-[linear-gradient(90deg,#e2f7ff_0%,#7dd3fc_36%,#86efac_100%)] bg-clip-text text-transparent">
                ZORVIX AI
              </span>
            </h1>
            <p className="mt-4 text-sm uppercase tracking-[0.38em] text-emerald-200/72">The one intelligence layer across every mission</p>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto max-w-4xl overflow-hidden rounded-[34px] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(12,18,32,0.92),rgba(8,12,22,0.96))] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-7"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,102,255,0.16),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(0,255,136,0.10),transparent_34%)]" />
            <div className="relative grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-400/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100/82">
                  <Radar className="h-3.5 w-3.5" />
                  Live Mission Engine
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/62">Current objective</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
                    {nextMissionHook.title || "No mission selected"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300/80">
                    {nextMissionHook.detail || "ZORVIX stays focused on one clear next action, then evaluates the result before the scenario evolves."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Target, label: "Always actionable", detail: "Objective -> decision -> feedback -> evolve" },
                    { icon: Bot, label: "Non-generic AI", detail: "Mission-aware prompts and operator reasoning" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <item.icon className="h-4 w-4 text-cyan-200" />
                      <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                      <p className="mt-2 text-sm text-slate-300/72">{item.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" className="cyber-btn terminal-font" onClick={openAssistant}>
                    <ArrowRight className="h-4 w-4" />
                    Open ZORVIX
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(isAuthenticated ? (nextMissionHook.route || "/program") : "/auth")}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
                  >
                    {isAuthenticated ? <ArrowRight className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    {isAuthenticated ? "Continue Mission" : "Secure Login"}
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-cyan-300/14 bg-black/24 p-4">
                <p className="terminal-font text-[11px] uppercase tracking-[0.22em] text-slate-500">Operator State</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {controlStats.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <p className="terminal-font text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-400/8 p-4">
                  <p className="terminal-font text-[10px] uppercase tracking-[0.18em] text-emerald-100/68">Identity</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {isAuthenticated ? user?.name || user?.email || "Authenticated operator" : "Guest session"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300/72">
                    {isAuthenticated ? "Secure login, persistent mission state, and DB-backed progression are active." : "Sign in to unlock persistent scoring, rank, and mission memory."}
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.14 }}
              className="rounded-[30px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(12,18,32,0.82),rgba(8,12,22,0.92))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.32)]"
            >
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Core Engine</p>
              <div className="mt-4 grid gap-3">
                {missionPhases.map((phase, index) => (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.18 + index * 0.06 }}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/16 bg-cyan-400/10 text-[11px] font-semibold text-cyan-100">
                        0{index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{phase.title}</p>
                        <p className="mt-1 text-sm text-slate-300/74">{phase.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="rounded-[30px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(12,18,32,0.82),rgba(8,12,22,0.92))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.32)]"
            >
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">ZORVIX Actions</p>
              <div className="mt-4 grid gap-3">
                {promptGrid.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => openPrompt(item.title, item.prompt)}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-300/72">{item.prompt}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 text-cyan-200" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-200" />
                  <p className="text-sm font-semibold text-white">Live recommendation</p>
                </div>
                <p className="mt-2 text-sm text-slate-300/74">
                  {recommendations[0]?.reason || "Mission-aware recommendations will appear here as your activity changes."}
                </p>
              </div>
            </motion.div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Secure multi-user auth",
                detail: isAuthenticated ? "Authenticated session is active and tied to persistent mission state." : "Login is required for secure persistent progress and rank tracking.",
              },
              {
                icon: Sparkles,
                title: "Persistent scoring",
                detail: "XP, momentum, ranks, and challenge progress are driven by the real mission-control backend.",
              },
              {
                icon: Bot,
                title: "Fallback-safe AI",
                detail: "ZORVIX opens through the existing streamed AI routes and mission-aware fallback logic already in the stack.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.22 + index * 0.05 }}
                className="rounded-[28px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(12,18,32,0.82),rgba(8,12,22,0.92))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)]"
              >
                <item.icon className="h-5 w-5 text-cyan-200" />
                <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300/74">{item.detail}</p>
              </motion.div>
            ))}
          </section>

          {quickActions.length ? (
            <section className="rounded-[30px] border border-cyan-300/12 bg-[linear-gradient(180deg,rgba(12,18,32,0.82),rgba(8,12,22,0.92))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
              <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-slate-500">Fast Actions</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {quickActions.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.route)}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                  >
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-300/72">{item.detail}</p>
                    <p className="mt-3 terminal-font text-[10px] uppercase tracking-[0.18em] text-cyan-100/62">{item.cta}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AssistantPage;
