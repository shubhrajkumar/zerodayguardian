import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Flame,
  FlaskConical,
  Loader2,
  Radar,
  ShieldCheck,
  Target,
  Trophy,
  UserCircle2,
  Users,
  Wrench,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useUserProgress } from "@/context/UserProgressContext";
import LandingIntro from "@/components/LandingIntro";

const STREAK_KEY = "zdg:streak";
const LAST_ACTIVE_KEY = "zdg:last-active";

type CtaKey = "tools" | "labs" | "zorvix" | "dashboard";

const rankForXp = (xp: number) => {
  if (xp >= 1800) return "Elite";
  if (xp >= 900) return "Guardian";
  return "Rookie";
};

const Index = () => {
  const navigate = useNavigate();
  const { progress, loading, refreshProgress } = useUserProgress();
  const [activeCta, setActiveCta] = useState<CtaKey | null>(null);
  const [ctaError, setCtaError] = useState("");

  useEffect(() => {
    document.title = "ZeroDay-Guardian | The One Line of Defence";

    const today = new Date().toISOString().slice(0, 10);
    const lastActive = localStorage.getItem(LAST_ACTIVE_KEY);
    const currentStreak = Number(localStorage.getItem(STREAK_KEY) || 1);
    let nextStreak = currentStreak;
    if (!lastActive) nextStreak = 1;
    else {
      const deltaDays = Math.floor((new Date(today).getTime() - new Date(lastActive).getTime()) / 86400000);
      if (deltaDays === 1) nextStreak = currentStreak + 1;
      if (deltaDays > 1) nextStreak = 1;
    }
    localStorage.setItem(STREAK_KEY, String(nextStreak));
    localStorage.setItem(LAST_ACTIVE_KEY, today);
    refreshProgress().catch(() => undefined);
  }, []);

  const rank = useMemo(() => progress.rank || rankForXp(progress.xp), [progress.rank, progress.xp]);
  const levelProgress = useMemo(() => {
    const levelBase = Math.max(0, (progress.level - 1) * 180);
    const inLevel = Math.max(0, progress.points - levelBase);
    return Math.min(100, Math.round((inLevel / 180) * 100));
  }, [progress.level, progress.points]);
  const nextLevelRequirement = useMemo(() => Math.max(180, progress.level * 180), [progress.level]);

  const executeCta = async (key: CtaKey, action: () => void) => {
    setCtaError("");
    setActiveCta(key);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      action();
    } catch {
      setCtaError("Action failed. Retry in a stable network session.");
    } finally {
      window.setTimeout(() => setActiveCta((current) => (current === key ? null : current)), 120);
    }
  };

  const commandPanels = [
    { title: "Tools", icon: Wrench, description: "Deploy real cyber intelligence tooling.", to: "/tools" },
    { title: "Labs", icon: FlaskConical, description: "Run practical attack-defense simulations.", to: "/lab" },
    { title: "Learn", icon: Target, description: "Follow structured progression by skill level.", to: "/learn" },
    { title: "Community", icon: Users, description: "Exchange vetted defensive strategies.", to: "/community" },
    { title: "Dashboard", icon: Radar, description: "Track XP, streaks, and mission telemetry.", to: "/dashboard" },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-10 space-y-10 page-shell">
      <LandingIntro />
      {ctaError ? <p className="text-xs text-rose-200">{ctaError}</p> : null}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <article className="glass-card rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Cyber Rank</p>
          <h3 className="mt-2 text-xl font-bold inline-flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" /> {rank}
          </h3>
        </article>
        <article className="glass-card rounded-xl p-5">
          <p className="text-xs text-muted-foreground">XP</p>
          <h3 className="mt-2 text-xl font-bold">{loading ? "..." : progress.points}</h3>
          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full brand-gradient-bg" style={{ width: `${levelProgress}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-cyan-100/80">Level {progress.level} | Next level at {nextLevelRequirement} XP</p>
        </article>
        <article className="glass-card rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Streak</p>
          <h3 className="mt-2 text-xl font-bold inline-flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-300" /> {progress.streak} days
          </h3>
        </article>
        <article className="glass-card rounded-xl p-5">
          <p className="text-xs text-muted-foreground">Mission Readiness</p>
          <h3 className="mt-2 text-xl font-bold inline-flex items-center gap-2">
            <Radar className="h-4 w-4 text-cyan-300" /> Active
          </h3>
        </article>
      </section>

      <section className="rounded-xl border border-cyan-300/20 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.18),transparent_45%),rgba(8,12,18,0.9)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">ZORVIX Control Deck</h2>
            <p className="text-sm text-muted-foreground">Fast mentor actions with clean, focused workflow prompts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                executeCta("zorvix", () => {
                  window.dispatchEvent(new CustomEvent("neurobot:open"));
                })
              }
            >
              Open Zorvix
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                executeCta("zorvix", () =>
                  window.dispatchEvent(
                    new CustomEvent("neurobot:topic", {
                      detail: {
                        id: "zorvix-roadmap",
                        title: "Roadmap Builder",
                        query: "Build a 14-day focused cyber roadmap with labs and checkpoints.",
                        tags: ["zorvix", "roadmap"],
                      },
                    })
                  )
                )
              }
            >
              Roadmap
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                executeCta("zorvix", () =>
                  window.dispatchEvent(
                    new CustomEvent("neurobot:topic", {
                      detail: {
                        id: "zorvix-labfix",
                        title: "Lab Help",
                        query: "Help me fix my current lab issue step-by-step in simple language.",
                        tags: ["zorvix", "lab", "mentor"],
                      },
                    })
                  )
                )
              }
            >
              Lab Help
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                executeCta("zorvix", () =>
                  window.dispatchEvent(
                    new CustomEvent("neurobot:topic", {
                      detail: {
                        id: "zorvix-defense",
                        title: "Defense Drill",
                        query: "Give me one practical defense drill I can run in 20 minutes.",
                        tags: ["zorvix", "defense"],
                      },
                    })
                  )
                )
              }
            >
              Defense Drill
            </Button>
          </div>
        </div>
      </section>

      <section id="labs-tools-section" className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Operations Grid</h2>
            <p className="text-sm text-muted-foreground">Authority by structure: each section maps to a specific defensive mission path.</p>
          </div>
        </div>
        <div className="cyber-divider" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {commandPanels.map((panel) => (
            <Link key={panel.title} to={panel.to} className="glass-card rounded-xl p-5 hover-glow">
              <panel.icon className="h-5 w-5 text-cyan-300" />
              <h3 className="mt-3 text-base font-bold">{panel.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground">{panel.description}</p>
              <p className="mt-3 text-[11px] text-cyan-100/80 inline-flex items-center gap-1">
                Enter Section <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { title: "Roadmap Preview", desc: "Week 1: foundations. Week 2: recon. Week 3: exploitation simulation. Week 4: defense reporting.", to: "/learn", icon: Target },
          { title: "Benefit Signal", desc: "Convert theory into operator habits with labs, AI mentoring, and measurable progression feedback.", to: "/lab", icon: ShieldCheck },
          { title: "Trust + Intelligence", desc: "Read tactical updates and apply insights to harden real workflows with repeatable checklists.", to: "/blog", icon: BadgeCheck },
        ].map((item) => (
          <Link key={item.title} to={item.to} className="glass-card rounded-xl p-6 hover-glow">
            <item.icon className="h-5 w-5 text-cyan-300" />
            <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Encrypted Sessions", "Secure Login", "Privacy First Architecture"].map((item) => (
          <article key={item} className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-4 text-sm inline-flex items-center gap-2">
            <UserCircle2 className="h-4 w-4 text-cyan-300" />
            {item}
          </article>
        ))}
      </section>

      <section className="text-center text-sm text-cyan-100/86">
        <Button variant="outline" onClick={() => executeCta("dashboard", () => navigate("/dashboard"))} disabled={activeCta !== null}>
          {activeCta === "dashboard" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Command Your Journey
          <ArrowRight className="h-4 w-4" />
        </Button>
      </section>
    </div>
  );
};

export default Index;

