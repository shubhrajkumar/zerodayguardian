import { useMemo } from "react";
import { ArrowRight, Radar, ShieldCheck, TerminalSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import LandingIntro from "@/components/LandingIntro";

const HomePage = () => {
  const navigate = useNavigate();
  const { nextMissionHook, totalPoints, streak, completedDays, completedSandboxLabs } = useMissionSystem();

  const entryRoute = nextMissionHook?.route || "/program";

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
    <div className="ui-shell relative min-h-[calc(100vh-4rem)] overflow-hidden" style={{ backgroundColor: "var(--theme-bg)" }}>

      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(circle at top, color-mix(in srgb, var(--theme-accent-blue) 14%, transparent), transparent 22%), radial-gradient(circle at 80% 18%, color-mix(in srgb, var(--theme-accent-green) 8%, transparent), transparent 20%), linear-gradient(180deg, var(--theme-bg) 0%, color-mix(in srgb, var(--theme-bg) 80%, var(--theme-accent-blue) 10%) 100%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ background: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

      {/* Orb glow — CSS infinite float animation */}
      <div
        className="animate-orb-float pointer-events-none absolute inset-x-0 top-[-18%] mx-auto h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(0,102,255,0.18)_0%,rgba(0,255,136,0.1)_36%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />

      {/* Orbit signal pills — CSS infinite pulse with staggered delays */}
      {orbitSignals.map((signal) => (
        <div
          key={signal.id}
          className="animate-orbit-pulse pointer-events-none absolute hidden rounded-full border border-sky-300/12 bg-slate-900/70 px-3 py-1 terminal-font text-[10px] uppercase tracking-[0.22em] text-slate-300/85 md:block"
          style={{ left: signal.x, top: signal.y, animationDelay: `${signal.delay}s` }}
        >
          {signal.label}
        </div>
      ))}

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-5xl">
          <div className="mx-auto mb-8 max-w-4xl">
            <LandingIntro />
          </div>

          {/* Hero text block — CSS fade-in */}
          <div className="animate-hero-fade-in mx-auto max-w-3xl text-center" style={{ contain: 'layout style' }}>
            <p
              className="animate-hero-fade-in terminal-font text-[11px] uppercase tracking-[0.5em] text-slate-300/85"
              style={{ animationDelay: '0.08s' }}
            >
              ZeroDay Guardian
            </p>
            <h1
              className="animate-hero-fade-in mt-4 text-balance text-4xl font-extrabold tracking-[-0.06em] text-white drop-shadow-[0_0_24px_rgba(0,255,136,0.14)] md:text-6xl"
              style={{ animationDelay: '0.12s' }}
            >
              <span className="bg-[linear-gradient(90deg,#e2f7ff_0%,#7dd3fc_36%,#86efac_100%)] bg-clip-text text-transparent">
                ZeroDay Guardian
              </span>
              <span className="block text-white/92">The One Line of Defense</span>
            </h1>
            <p
              className="animate-hero-fade-in mt-4 text-sm font-medium uppercase tracking-[0.42em] text-slate-300/85 md:text-[0.95rem]"
              style={{ animationDelay: '0.2s' }}
            >
              ZORVIX AI
            </p>
          </div>

          {/* Cyber card section — CSS fade-in */}
          <section
            className="animate-hero-fade-in cyber-card relative mx-auto mt-10 max-w-3xl rounded-xl p-5 shadow-[0_24px_72px_rgba(0,0,0,0.34)] md:p-7"
            style={{ animationDelay: '0.22s' }}
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
                    {nextMissionHook?.title || "Enter the training loop"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300/80">
                    {nextMissionHook?.detail || "Start the next guided cyber mission with ZORVIX watching your path, scoring your actions, and keeping the flow clear."}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      { icon: ShieldCheck, label: "Clear next step", detail: "One obvious action. No clutter." },
                      { icon: TerminalSquare, label: "Operator flow", detail: "Labs, program, and progress stay visible." },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                        <item.icon className="h-4 w-4 text-[#00ff88]" />
                        <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                        <p className="mt-2 text-sm text-slate-300/85">{item?.detail || ''}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/8 bg-black/24 p-4">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.22em] text-slate-500">Control Status</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {controlPills.map((item, i) => (
                      <div
                        key={item.label}
                        className="animate-scale-in rounded-xl border border-white/8 bg-white/[0.03] p-3"
                        style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                      >
                        <p className="terminal-font text-[10px] uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl border border-white/8 bg-slate-900/72 p-4">
                    <p className="terminal-font text-[10px] uppercase tracking-[0.2em] text-slate-300/85">Active Stack</p>
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
          </section>

          {/* CTA button — CSS fade-in + CSS hover/active transitions */}
          <div
            className="animate-hero-fade-in mx-auto mt-8 flex max-w-3xl justify-center"
            style={{ animationDelay: '0.3s' }}
          >
            <button
              type="button"
              onClick={() => navigate(entryRoute)}
              className="cyber-btn cta-focus-ring inline-flex min-h-[54px] min-w-[220px] items-center justify-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99]"
            >
              <ArrowRight className="h-4 w-4" />
              Start Free
            </button>
          </div>

          {/* Feature cards — CSS fade-in */}
          <div
            className="animate-hero-fade-in mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3"
            style={{ animationDelay: '0.38s' }}
          >
            <div className="group rounded-xl border border-white/8 bg-white/[0.03] p-5 transition-all duration-300 hover:border-[#00d4ff]/40 hover:shadow-[0_0_20px_rgba(0,212,255,0.12)]" style={{borderColor: 'var(--zdg-border)', backgroundColor: 'var(--zdg-card)'}}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🔬</span>
                <span className="rounded-md border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{borderColor: 'var(--zdg-tag-border)', backgroundColor: 'var(--zdg-tag-bg)', color: 'var(--zdg-tag-text)'}}>Coming Soon</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold" style={{color: 'var(--zdg-text)'}}>Interactive Labs</h3>
              <p className="mt-1.5 text-xs leading-5" style={{color: 'var(--zdg-muted)'}}>Hands-on cybersecurity challenges in a safe sandbox environment</p>
            </div>
            <div className="group rounded-xl border border-white/8 bg-white/[0.03] p-5 transition-all duration-300 hover:border-[#00ff88]/40 hover:shadow-[0_0_20px_rgba(0,255,136,0.12)]" style={{borderColor: 'var(--zdg-border)', backgroundColor: 'var(--zdg-card)'}}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span className="rounded-md border border-[#00ff88]/30 bg-[#00ff88]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{borderColor: 'var(--zdg-tag-border)', backgroundColor: 'var(--zdg-tag-bg)', color: 'var(--zdg-tag-text)'}}>Active</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold" style={{color: 'var(--zdg-text)'}}>Daily Missions</h3>
              <p className="mt-1.5 text-xs leading-5" style={{color: 'var(--zdg-muted)'}}>Earn XP and build streaks with daily cybersecurity challenges</p>
            </div>
            <div className="group rounded-xl border border-white/8 bg-white/[0.03] p-5 transition-all duration-300 hover:border-[#a855f7]/40 hover:shadow-[0_0_20px_rgba(168,85,247,0.12)]" style={{borderColor: 'var(--zdg-border)', backgroundColor: 'var(--zdg-card)'}}>
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <span className="rounded-md border border-[#a855f7]/30 bg-[#a855f7]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{borderColor: 'var(--zdg-tag-border)', backgroundColor: 'var(--zdg-tag-bg)', color: 'var(--zdg-tag-text)'}}>Online</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold" style={{color: 'var(--zdg-text)'}}>Zorvix AI</h3>
              <p className="mt-1.5 text-xs leading-5" style={{color: 'var(--zdg-muted)'}}>Your personal AI mentor for cyber defense guidance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
