import { useEffect, useMemo } from "react";
import { ArrowRight, Radar, ShieldCheck, TerminalSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import Seo from "@/components/Seo";
import LandingIntro from "@/components/LandingIntro";

const Index = () => {
  const navigate = useNavigate();
  const { nextMissionHook, totalPoints, streak, completedDays, completedSandboxLabs } = useMissionSystem();

  useEffect(() => {
    document.title = "ZeroDay Guardian – The One Line of Defense";
  }, []);

  const entryRoute = nextMissionHook.route || "/program";

  const orbitSignals = useMemo(
    () => [
      { id: "intel", label: "intel", x: "12%", y: "18%", delay: 0 },
      { id: "labs", label: "labs", x: "82%", y: "20%", delay: 0.8 },
      { id: "mentor", label: "zorvix", x: "18%", y: "76%", delay: 1.4 },
      { id: "range", label: "range", x: "84%", y: "74%", delay: 2 },
    ],
    []
  );

  const controlPills = useMemo(
    () => [
      { label: "XP", value: `${totalPoints}` },
      { label: "Days", value: `${completedDays}` },
      { label: "Labs", value: `${completedSandboxLabs}` },
      { label: "Streak", value: `${streak}d` },
    ],
    [completedDays, completedSandboxLabs, streak, totalPoints]
  );

  return (
    <div className="ui-shell relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0a0a0f]">
      <Seo
        title="ZeroDay Guardian | The One Line of Defense"
        description="AI-guided cybersecurity platform with real progress, referrals, public profiles, mission streaks, and ZORVIX assistance."
        path="/"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,102,255,0.14),transparent_22%),radial-gradient(circle_at_80%_18%,rgba(0,255,136,0.08),transparent_20%),linear-gradient(180deg,#0a0a0f_0%,#10101a_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />

      <motion.div
        className="pointer-events-none absolute inset-x-0 top-[-18%] mx-auto h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(0,102,255,0.18)_0%,rgba(0,255,136,0.1)_36%,transparent_70%)] blur-3xl"
        animate={{ y: [0, 18, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {orbitSignals.map((signal) => (
        <motion.div
          key={signal.id}
          className="pointer-events-none absolute hidden rounded-full border border-sky-300/12 bg-slate-900/70 px-3 py-1 terminal-font text-[10px] uppercase tracking-[0.22em] text-slate-300/78 md:block"
          style={{ left: signal.x, top: signal.y }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: [0.22, 0.62, 0.22], y: [0, -8, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, delay: signal.delay, ease: "easeInOut" }}
        >
          {signal.label}
        </motion.div>
      ))}

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-5xl">
          <div className="mx-auto mb-8 max-w-4xl">
            <LandingIntro />
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-3xl text-center">
            <motion.p
              className="terminal-font text-[11px] uppercase tracking-[0.5em] text-slate-300/62"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              ZeroDay Guardian
            </motion.p>
            <motion.h1
              className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.06em] text-white drop-shadow-[0_0_24px_rgba(0,255,136,0.14)] md:text-6xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12 }}
            >
              <span className="bg-[linear-gradient(90deg,#e2f7ff_0%,#7dd3fc_36%,#86efac_100%)] bg-clip-text text-transparent">
                ZeroDay Guardian
              </span>
              <span className="block text-white/92">The One Line of Defense</span>
            </motion.h1>
            <motion.p
              className="mt-4 text-sm font-medium uppercase tracking-[0.42em] text-slate-300/68 md:text-[0.95rem]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              ZORVIX AI
            </motion.p>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="cyber-card relative mx-auto mt-10 max-w-3xl rounded-xl p-5 shadow-[0_24px_72px_rgba(0,0,0,0.34)] md:p-7"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,102,255,0.10),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(0,255,136,0.08),transparent_34%)]" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,255,136,0.36),transparent)]" />

            <div className="relative">
              <div className="flex items-center justify-center gap-2">
                <span className="cyber-badge">
                  <Radar className="h-3.5 w-3.5" />
                  Mission Online
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1.15fr_0.85fr] md:items-start">
                <div className="text-center md:text-left">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Primary Mission</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
                    {nextMissionHook.title || "Enter the training loop"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300/80">
                    {nextMissionHook.detail || "Start the next guided cyber mission with ZORVIX watching your path, scoring your actions, and keeping the flow clear."}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      { icon: ShieldCheck, label: "Clear next step", detail: "One obvious action. No clutter." },
                      { icon: TerminalSquare, label: "Operator flow", detail: "Labs, program, and progress stay visible." },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                        <item.icon className="h-4 w-4 text-[#00ff88]" />
                        <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                        <p className="mt-2 text-sm text-slate-300/70">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/8 bg-black/24 p-4">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.22em] text-slate-500">Control Status</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {controlPills.map((item) => (
                      <motion.div
                        key={item.label}
                        className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <p className="terminal-font text-[10px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-white/8 bg-slate-900/72 p-4">
                    <p className="terminal-font text-[10px] uppercase tracking-[0.2em] text-slate-300/70">Active Stack</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Recon", "Labs", "Defense", "ZORVIX"].map((item) => (
                        <span key={item} className="rounded-xl border border-white/8 bg-black/28 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300/82">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.div
            className="mx-auto mt-8 flex max-w-3xl justify-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.3 }}
          >
            <motion.button
              type="button"
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(entryRoute)}
              className="cyber-btn cta-focus-ring inline-flex min-h-[54px] min-w-[220px] items-center justify-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em]"
            >
              <ArrowRight className="h-4 w-4" />
              Start Free
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.38 }}
            className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3"
          >
            <div className="skeleton-block h-[72px] border border-white/6 bg-white/[0.02] p-4">
              <div className="h-3 w-20 rounded bg-white/10" />
              <div className="mt-3 h-4 w-24 rounded bg-white/10" />
            </div>
            <div className="skeleton-block h-[72px] border border-white/6 bg-white/[0.02] p-4">
              <div className="h-3 w-16 rounded bg-white/10" />
              <div className="mt-3 h-4 w-28 rounded bg-white/10" />
            </div>
            <div className="skeleton-block h-[72px] border border-white/6 bg-white/[0.02] p-4">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-3 h-4 w-20 rounded bg-white/10" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Index;
