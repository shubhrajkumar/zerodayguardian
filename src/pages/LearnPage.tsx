import { useEffect, useMemo, useState } from "react";
import { BookOpen, Brain, CheckCircle2, Flag, GraduationCap, PlayCircle, Target } from "lucide-react";
import { apiGetJson, apiPostJson } from "@/lib/apiClient";
import { useNavigate } from "react-router-dom";

type DashLite = {
  intelligence: {
    xp: number;
    proficiency: number;
    completedLabs: number;
    totalLabsTouched: number;
  };
};

const tracks = [
  {
    level: "Beginner",
    title: "Security Foundations",
    scenario: "You are onboarding a small startup and must baseline security within one week.",
    checkpoints: [
      "Understand CIA triad, attack surface, and common threat vectors.",
      "Set up a safe practice VM and baseline toolkit.",
      "Run a first audit against insecure sample settings.",
    ],
    challenge: "Audit one personal project for weak passwords, exposed ports, and outdated dependencies.",
    topicId: "foundation",
    labId: "learn-foundation",
  },
  {
    level: "Intermediate",
    title: "Offensive + Defensive Workflows",
    scenario: "You are validating a staging app and must produce a defense-ready remediation report.",
    checkpoints: [
      "Perform scoped enumeration and map potential weaknesses.",
      "Practice patch verification and detection rule drafting.",
      "Build triage notes from simulated incident alerts.",
    ],
    challenge: "Run a recon-to-report cycle and produce three prioritized remediations.",
    topicId: "workflow",
    labId: "learn-workflow",
  },
  {
    level: "Advanced",
    title: "Threat Hunting and Automation",
    scenario: "You are improving SOC response quality with automation-backed threat hunting.",
    checkpoints: [
      "Map adversary behavior to MITRE ATT&CK techniques.",
      "Design safe automation for log enrichment and triage.",
      "Create measurable detection-improvement targets.",
    ],
    challenge: "Build a mini playbook for phishing + endpoint alerts with SLA goals.",
    topicId: "advanced",
    labId: "learn-advanced",
  },
];

const LearnPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ xp: number; proficiency: number; completedLabs: number; totalLabsTouched: number } | null>(null);
  const [feedback, setFeedback] = useState("");

  const overallProgress = useMemo(() => {
    if (!stats) return 0;
    if (!stats.totalLabsTouched) return 0;
    return Math.round((stats.completedLabs / stats.totalLabsTouched) * 100);
  }, [stats]);

  const loadStats = async () => {
    const payload = await apiGetJson<DashLite>("/api/intelligence/dashboard");
    setStats(payload.intelligence);
  };

  useEffect(() => {
    loadStats().catch(() => undefined);
  }, []);

  const askNeurobot = (track: (typeof tracks)[number], query?: string) => {
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: track.topicId,
          title: `${track.title} Mentor`,
          query: query || `Teach me ${track.title} with practical checkpoints, one mini challenge, and next action plan.`,
          tags: ["learn", track.level.toLowerCase(), "hands-on"],
        },
      })
    );
  };

  const markTrack = async (track: (typeof tracks)[number], status: "started" | "completed") => {
    const result = await apiPostJson<{ progress: { feedback?: { score: number; xpAwarded: number; totalXp: number; rank: string } } }>(
      "/api/intelligence/labs/progress",
      {
      labId: track.labId,
      status,
      durationSec: status === "completed" ? 180 : 0,
      difficulty: track.level === "Beginner" ? 1 : track.level === "Intermediate" ? 3 : 5,
      }
    );
    await apiPostJson("/api/intelligence/telemetry/event", {
      type: status === "started" ? "learn_track_started" : "learn_track_completed",
      query: track.title,
      tool: "learn-curriculum",
      depth: status === "started" ? 1 : 3,
      success: true,
      metadata: { level: track.level, labId: track.labId },
    });
    const detail = result?.progress?.feedback;
    if (detail) {
      setFeedback(`Score ${detail.score} | +${detail.xpAwarded} XP | Total ${detail.totalXp} XP | Rank ${detail.rank}`);
    }
    await loadStats();
  };

  return (
    <div className="container mx-auto px-4 py-12 page-shell">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-mono text-3xl md:text-4xl font-bold mb-4">
          <span className="text-accent">Learn</span> Cybersecurity Curriculum
        </h1>
        <p className="text-muted-foreground mb-5 max-w-3xl">
          Structured path from beginner to advanced with real scenarios, practical checkpoints, and backend-tracked progress.
        </p>
        <div className="cyber-divider mb-6" />

        <section className="mb-8 rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-4 text-sm">
          <p>
            Progress: <strong>{overallProgress}%</strong>
            {stats ? ` | XP: ${stats.xp} | Proficiency: ${Math.round(stats.proficiency * 100)}%` : ""}
          </p>
        </section>

        <div className="grid gap-6">
          {tracks.map((track) => (
            <article key={track.level} className="glass-card rounded-lg p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="inline-flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <h2 className="font-mono text-xl">{track.level}: {track.title}</h2>
                </div>
                <button type="button" className="home-clean-mini-cta-link" onClick={() => askNeurobot(track)}>
                  <Brain className="h-4 w-4" />
                  Ask NeuroBot Mentor
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4"><strong>Real-world scenario:</strong> {track.scenario}</p>

              <ol className="grid gap-2 mb-4">
                {track.checkpoints.map((step) => (
                  <li key={step} className="text-sm text-foreground inline-flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <div className="inline-flex items-center gap-2 mb-1 text-primary">
                  <Flag className="h-4 w-4" />
                  Practice Challenge
                </div>
                <p>{track.challenge}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="home-clean-mini-cta-link" onClick={() => markTrack(track, "started")}>
                  <PlayCircle className="h-4 w-4" /> Start Learning
                </button>
                <button
                  type="button"
                  className="home-clean-mini-cta-link"
                  onClick={async () => {
                    await markTrack(track, "started");
                    navigate(`/lab?tool=${encodeURIComponent(track.labId)}`);
                  }}
                >
                  <BookOpen className="h-4 w-4" /> Practice Now
                </button>
                <button type="button" className="home-clean-mini-cta-link" onClick={() => markTrack(track, "completed")}>
                  <Target className="h-4 w-4" /> Test Yourself
                </button>
              </div>
              {feedback ? <p className="mt-3 text-xs text-cyan-200/90">{feedback}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LearnPage;
