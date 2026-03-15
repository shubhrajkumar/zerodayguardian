import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, FlaskConical, PlayCircle, Rocket, Shield, Trophy, Wrench } from "lucide-react";
import { apiFetch, apiGetJson, apiPostJson } from "@/lib/apiClient";
import { useUserProgress } from "@/context/UserProgressContext";
import LabExecutionModal from "@/components/LabExecutionModal";

interface LabModel {
  id: string;
  title: string;
  description: string;
  objective: string;
  practiceEnvironment: string;
  steps: string[];
  recommendedTools: string[];
  challengeModeHint: string;
  allowedCommands: string[];
  tips: string[];
}

interface RunResult {
  ok: boolean;
  code: string;
  output: string;
  tips?: string[];
  mentorHint?: string;
  fixSteps?: string[];
}

interface BeginnerLabModel {
  id: "beginner-password-strength" | "beginner-xss-sandbox" | "beginner-sqli-demo" | "beginner-portscan-visual";
  title: string;
  objective: string;
  explanation: string;
  pointsBase: number;
  taskDescription?: string;
  hints?: string[];
  solution?: string;
}

interface BeginnerLabRunResult {
  labId: BeginnerLabModel["id"];
  title: string;
  score: number;
  explanation: string;
  defensiveGuidance: string[];
  completionEligible: boolean;
  minimumCompletionScore: number;
  visualization?: Record<string, unknown>;
  findings?: string[];
  riskScore?: number;
  level?: string;
  entropy?: number;
  ports?: Array<{ port: number; status: string; risk: string }>;
  target?: string;
  reflectedOutput?: string;
  safeOutput?: string;
  vulnerableQuery?: string;
  secureQuery?: string;
  whyThisHappens?: string;
  fundamentals?: { tcp: string; port: string; whyOpenPortsMatter: string };
}

interface ProgressionProfile {
  points: number;
  rank: string;
  level: number;
  streak: number;
  completedLabs: number;
  weeklyPoints: number;
}

type LabSandboxStatus = {
  enabled: boolean;
  ready: boolean;
  message: string;
  allowlistHosts: string[];
  allowlistCidrs: string[];
  allowedBins: string[];
  image: string;
};

type DashboardLite = {
  intelligence: {
    completedLabs: number;
    totalLabsTouched: number;
  };
};

const estimatePasswordStrength = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 25;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 20;
  if (/\d/.test(value)) score += 20;
  if (/[^A-Za-z0-9]/.test(value)) score += 20;
  if (value.length >= 14) score += 15;
  if (score >= 85) return { score, level: "Elite" };
  if (score >= 65) return { score, level: "Strong" };
  if (score >= 40) return { score, level: "Moderate" };
  return { score, level: "Weak" };
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const withBackoff = async <T,>(task: () => Promise<T>, retries = 1) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await task();
    } catch (error) {
      if (attempt === retries) throw error;
      await wait(240 * 2 ** attempt);
      attempt += 1;
    }
  }
  throw new Error("request_retry_failed");
};

const LabPage = () => {
  const { progress: globalProgress, refreshProgress, applyOptimisticProgress, applyServerProgression } = useUserProgress();
  const [searchParams] = useSearchParams();
  const [labs, setLabs] = useState<LabModel[]>([]);
  const [activeLabId, setActiveLabId] = useState<string>(() => localStorage.getItem("lab:active-id") || "nmap-basics");
  const [command, setCommand] = useState("");
  const [consoleLines, setConsoleLines] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("lab:console-lines");
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return parsed.length ? parsed : ["Practice console ready. Type `help` to see allowed commands."];
    } catch {
      return ["Practice console ready. Type `help` to see allowed commands."];
    }
  });
  const [running, setRunning] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [labModalOpen, setLabModalOpen] = useState(false);
  const [mentorPrompt, setMentorPrompt] = useState("");
  const [mentorAutoReason, setMentorAutoReason] = useState("");
  const [completedLabs, setCompletedLabs] = useState(0);
  const [totalLabsTouched, setTotalLabsTouched] = useState(0);
  const [labLoadError, setLabLoadError] = useState("");

  const [passwordProbe, setPasswordProbe] = useState("");
  const [sqliPayload, setSqliPayload] = useState("' OR '1'='1");
  const [xssPayload, setXssPayload] = useState("<script>alert('xss')</script>");
  const [reconDomain, setReconDomain] = useState("example.com");
  const [beginnerLabs, setBeginnerLabs] = useState<BeginnerLabModel[]>([]);
  const [beginnerResults, setBeginnerResults] = useState<Partial<Record<BeginnerLabModel["id"], BeginnerLabRunResult>>>({});
  const [beginnerBusy, setBeginnerBusy] = useState<Partial<Record<BeginnerLabModel["id"], boolean>>>({});
  const [solutionRevealed, setSolutionRevealed] = useState<Partial<Record<BeginnerLabModel["id"], boolean>>>({});
  const [progression, setProgression] = useState<ProgressionProfile | null>(null);
  const [sandboxStatus, setSandboxStatus] = useState<LabSandboxStatus | null>(null);

  const activeLab = useMemo(() => labs.find((lab) => lab.id === activeLabId) || null, [labs, activeLabId]);
  const passwordProbeResult = useMemo(() => estimatePasswordStrength(passwordProbe), [passwordProbe]);
  const sqliRisk = useMemo(() => /(\bor\b.+?=|union\s+select|--|#|;)/i.test(sqliPayload), [sqliPayload]);
  const xssRisk = useMemo(() => /<script|onerror=|javascript:/i.test(xssPayload), [xssPayload]);
  const reconPorts = useMemo(() => [22, 53, 80, 443, 8080].map((port) => ({ port, status: port === 53 ? "filtered" : "open" })), []);
  const quickCommands = useMemo(() => {
    if (!activeLab?.allowedCommands?.length) return [];
    return activeLab.allowedCommands.filter((cmd) => !["help", "status", "complete"].includes(cmd)).slice(0, 6);
  }, [activeLab]);
  const isPracticeHub = activeLab?.id === "nmap-basics";

  const progressPct = useMemo(() => {
    if (!totalLabsTouched) return 0;
    return Math.round((completedLabs / totalLabsTouched) * 100);
  }, [completedLabs, totalLabsTouched]);
  const beginnerMeta = useMemo(
    () => beginnerLabs.reduce((acc, lab) => ({ ...acc, [lab.id]: lab }), {} as Record<BeginnerLabModel["id"], BeginnerLabModel>),
    [beginnerLabs]
  );
  const badges = useMemo(() => {
    const out: string[] = [];
    if ((progression?.completedLabs || 0) >= 1) out.push("First Lab Cleared");
    if ((progression?.completedLabs || 0) >= 4) out.push("Sandbox Operator");
    if ((progression?.level || 0) >= 5) out.push("Defender Level 5");
    if ((progression?.rank || "") === "Guardian" || (progression?.rank || "") === "Elite") out.push("Guardian Track");
    return out;
  }, [progression]);

  const loadDashboardLite = async () => {
    const payload = await apiGetJson<DashboardLite>("/api/intelligence/dashboard");
    setCompletedLabs(payload.intelligence.completedLabs || 0);
    setTotalLabsTouched(payload.intelligence.totalLabsTouched || 0);
  };

  const loadProgression = async () => {
    const payload = await apiGetJson<{ profile: ProgressionProfile }>("/api/intelligence/progression/me");
    setProgression(payload.profile);
  };

  const runBeginnerLab = async (labId: BeginnerLabModel["id"], input: Record<string, string>) => {
    setBeginnerBusy((prev) => ({ ...prev, [labId]: true }));
    try {
      const payload = await apiPostJson<{ result: BeginnerLabRunResult }>("/api/intelligence/training/labs/beginner/run", {
        labId,
        input,
      });
      setBeginnerResults((prev) => ({ ...prev, [labId]: payload.result }));
      setSolutionRevealed((prev) => ({ ...prev, [labId]: false }));
      if (payload.result.completionEligible) {
        applyOptimisticProgress({ completedLabs: globalProgress.completedLabs + 1, totalLabsTouched: Math.max(globalProgress.totalLabsTouched, labs.length) });
        const completion = await apiPostJson<{ result?: { profile?: ProgressionProfile; pointsAwarded?: number } }>("/api/intelligence/training/labs/beginner/complete", {
          labId,
          score: payload.result.score,
        });
        applyServerProgression(completion?.result?.profile || null);
        await loadProgression();
        await refreshProgress();
      }
    } finally {
      setBeginnerBusy((prev) => ({ ...prev, [labId]: false }));
    }
  };

  useEffect(() => {
    localStorage.setItem("lab:active-id", activeLabId);
  }, [activeLabId]);

  useEffect(() => {
    localStorage.setItem("lab:console-lines", JSON.stringify(consoleLines.slice(-120)));
  }, [consoleLines]);

  useEffect(() => {
    withBackoff(() => apiGetJson<{ labs: BeginnerLabModel[] }>("/api/intelligence/training/labs/beginner"), 2)
      .then((payload) => setBeginnerLabs(payload.labs || []))
      .catch(() => undefined);
    loadProgression().catch(() => undefined);
    withBackoff(() => apiGetJson<{ labs?: LabModel[] }>("/api/neurobot/labs"), 2)
      .then((data) => {
        setLabLoadError("");
        setLabs(data.labs || []);
        if ((data.labs || []).length) {
          const available = data.labs || [];
          const existing = available.find((lab) => lab.id === activeLabId);
          const firstId = existing?.id || available[0].id;
          setActiveLabId(firstId);
          const first = available.find((lab) => lab.id === firstId) || available[0];
          setMentorPrompt(`Guide me through ${first.title} with clear steps and one mini challenge.`);
        }
      })
      .catch(() => {
        setLabLoadError("Lab API unavailable. Start the backend to load sandbox modules.");
      });
    apiGetJson<{ sandbox?: LabSandboxStatus }>("/api/neurobot/labs/status")
      .then((payload) => setSandboxStatus(payload.sandbox || null))
      .catch(() => undefined);
    loadDashboardLite().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!activeLab) return;
    setMentorPrompt(`Guide me through ${activeLab.title} with clear steps and one mini challenge.`);
  }, [activeLab]);

  useEffect(() => {
    const toolParam = searchParams.get("tool");
    if (!toolParam) return;
    setMentorPrompt(`Guide me in tool lab mode for tool id ${toolParam} with step-by-step hints.`);
    setMentorOpen(true);
  }, [searchParams]);

  const markLabProgress = async (status: "started" | "completed" | "failed") => {
    if (!activeLab) return;
    await apiPostJson("/api/intelligence/labs/progress", {
      labId: activeLab.id,
      status,
      durationSec: status === "completed" ? 120 : 0,
      difficulty: 2,
    });
    await loadDashboardLite();
    await refreshProgress();
  };

  const openMentorWithPrompt = () => {
    if (!activeLab || !mentorPrompt.trim()) return;
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: activeLab.id,
          title: `${activeLab.title} Mentor`,
          query: mentorPrompt.trim(),
          tags: ["lab", "exercise", activeLab.id],
          mentorMode: true,
        },
      })
    );
    setMentorOpen(false);
  };

  const triggerMentorRecovery = (result?: Partial<RunResult>) => {
    if (!activeLab) return;
    const reason = result?.mentorHint || "The sandbox blocked this command for safety and scope control.";
    const steps = result?.fixSteps?.length ? result.fixSteps : [
      "Run `help` and choose an allowed command for this lab.",
      "Execute the sequence step-by-step from the task card.",
      "Retry after each successful output until completion.",
    ];
    const nextPrompt = [
      `Mentor mode for ${activeLab.title}:`,
      `Error context: ${reason}`,
      "Please explain what failed and give a step-by-step fix plan.",
      ...steps.map((step, idx) => `${idx + 1}. ${step}`),
    ].join("\n");
    setMentorPrompt(nextPrompt);
    setMentorAutoReason(reason);
    setMentorOpen(true);
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: activeLab.id,
          title: `${activeLab.title} Mentor`,
          query: nextPrompt,
          tags: ["lab", "mentor", activeLab.id],
          mentorMode: true,
        },
      })
    );
  };

  const runCommand = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeLab) {
      setConsoleLines((prev) => [...prev, "Lab module not loaded. Start the backend and refresh the page."]);
      return;
    }
    const trimmed = command.trim();
    if (!trimmed) {
      setConsoleLines((prev) => [...prev, "Please enter a command before running the lab."]);
      return;
    }

    const input = trimmed.split("\n")[0].slice(0, 200);
    setCommand("");
    setRunning(true);
    setConsoleLines((prev) => [...prev, `$ ${input}`]);

    try {
      const response = await withBackoff(
        () =>
          apiFetch("/api/neurobot/labs/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ labId: activeLab.id, command: input }),
          }),
        1
      );
      const result = (await response.json()) as RunResult & { error?: string; message?: string; details?: unknown };
      if (response.status === 404) {
        setConsoleLines((prev) => [
          ...prev,
          "Sandbox endpoint not found.",
          "Check that the backend is running and exposes /api/neurobot/labs/run.",
        ]);
        await markLabProgress("failed").catch(() => undefined);
        triggerMentorRecovery();
        return;
      }
      if (response.status === 400) {
        setConsoleLines((prev) => [
          ...prev,
          "Sandbox rejected the request.",
          result?.message || result?.error || "Invalid command payload.",
          "Tip: Use `help` or click one of the allowed commands.",
        ]);
        await markLabProgress("failed").catch(() => undefined);
        triggerMentorRecovery(result);
        return;
      }
      if (response.ok && result.ok) {
        setConsoleLines((prev) => [...prev, result.output, ...(result.tips?.length ? [`Tip: ${result.tips[0]}`] : [])]);
        setMentorAutoReason("");
        if (result.code === "completed") await markLabProgress("completed");
      } else {
        setConsoleLines((prev) => [
          ...prev,
          "Sandbox execution failed in safe mode.",
          result.output || "That command isn’t in this lab’s allowlist. Run `help` for valid commands.",
          "Mentor support activated with a step-by-step recovery path.",
        ]);
        await markLabProgress("failed").catch(() => undefined);
        triggerMentorRecovery(result);
      }
    } catch {
      setConsoleLines((prev) => [
        ...prev,
        "Sandbox execution failed in safe mode.",
        "Service was unreachable. Mentor support activated with recovery guidance.",
      ]);
      await markLabProgress("failed").catch(() => undefined);
      triggerMentorRecovery();
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 page-shell relative lab-page">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-8 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />
        <div className="absolute top-24 right-8 h-28 w-28 rounded-full bg-rose-400/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-12 left-1/3 h-24 w-24 rounded-full bg-emerald-400/10 blur-3xl animate-pulse" />
        <div className="lab-hub-orbit lab-hub-orbit--one" />
        <div className="lab-hub-orbit lab-hub-orbit--two" />
        <div className="lab-hub-orbit lab-hub-orbit--three" />
        <div className="lab-hub-orbit lab-hub-orbit--four" />
        <div className="neon-scanlines absolute inset-0 opacity-25" />
      </div>
      <div className="max-w-6xl mx-auto relative">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-300/25 bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.25),transparent_38%),radial-gradient(circle_at_88%_18%,rgba(244,63,94,0.18),transparent_40%),linear-gradient(180deg,rgba(8,13,28,0.96),rgba(4,7,18,0.96))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(transparent_96%,rgba(56,189,248,0.07)),linear-gradient(90deg,transparent_96%,rgba(56,189,248,0.07))] [background-size:26px_26px]" />
          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-100/70">Neon Lab Zone</p>
            <h1 className="mt-3 font-mono text-3xl md:text-4xl font-bold text-cyan-50 drop-shadow-[0_0_16px_rgba(34,211,238,0.5)]">
              Practical Cyber Lab Command Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-cyan-100/80">
              Run safe, simulated commands and beginner labs in a neon-styled training space. Everything here is sandboxed.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100">Safe simulation</span>
              <span className="rounded-full border border-cyan-300/40 bg-black/40 px-3 py-1 text-xs text-cyan-100">Beginner friendly</span>
              <span className="rounded-full border border-cyan-300/40 bg-black/40 px-3 py-1 text-xs text-cyan-100">Step-by-step</span>
            </div>
          </div>
        </div>
        {labLoadError ? (
          <div className="mb-6 rounded-2xl border border-rose-300/30 bg-[linear-gradient(135deg,rgba(63,9,18,0.6),rgba(20,6,12,0.85))] px-4 py-3 text-sm text-rose-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            {labLoadError}
          </div>
        ) : null}

        <div className="flex flex-col gap-8">
        <section className="order-2 relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_42%),linear-gradient(180deg,rgba(6,10,22,0.98),rgba(3,6,16,0.98))] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.5)]">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.12),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(244,63,94,0.08),transparent_60%)]" />
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-mono text-lg text-cyan-50">Beginner Labs</h2>
              <p className="mt-1 text-xs text-cyan-100/70">Start here for guided, beginner-friendly practice.</p>
            </div>
            {beginnerLabs.length ? <p className="text-xs text-cyan-100/70">Beginner modules available: {beginnerLabs.length}</p> : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <article className="rounded-2xl border border-cyan-300/25 bg-black/50 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                <h3 className="font-semibold">Password Strength Analyzer</h3>
                <p className="mt-1 text-xs text-cyan-100/80">{beginnerMeta["beginner-password-strength"]?.taskDescription}</p>
                <input value={passwordProbe} onChange={(e) => setPasswordProbe(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-cyan-300/20 bg-black/40 px-3 text-cyan-50 placeholder:text-cyan-100/40" placeholder="Enter password" />
                <div className="mt-2 h-2 rounded bg-cyan-500/15 overflow-hidden"><div className="h-full bg-[linear-gradient(90deg,#ef4444,#f59e0b,#22d3ee)]" style={{ width: `${passwordProbeResult.score}%` }} /></div>
                <p className="mt-2 text-xs text-muted-foreground">Score: {passwordProbeResult.score}/100 ({passwordProbeResult.level})</p>
                <button
                  type="button"
                  className="mt-2 text-xs border border-cyan-300/30 rounded-lg px-3 py-2 hover:bg-cyan-500/10 neon-hover-glow"
                  onClick={() => runBeginnerLab("beginner-password-strength", { password: passwordProbe })}
                  disabled={beginnerBusy["beginner-password-strength"] || !passwordProbe.trim()}
                >
                  {beginnerBusy["beginner-password-strength"] ? "Running..." : "Run Lab Evaluation"}
                </button>
                {beginnerResults["beginner-password-strength"] ? (
                  <div className="mt-2 text-xs text-cyan-100/80">
                    <p>{beginnerResults["beginner-password-strength"]?.explanation}</p>
                    <p>Entropy: {Math.round(beginnerResults["beginner-password-strength"]?.entropy || 0)} bits</p>
                    <p>Hints: {(beginnerMeta["beginner-password-strength"]?.hints || []).join(" | ")}</p>
                    {!solutionRevealed["beginner-password-strength"] ? (
                      <button
                        type="button"
                        className="mt-2 text-[11px] border border-cyan-300/30 rounded-lg px-2 py-1 hover:bg-cyan-500/10 neon-hover-glow"
                        onClick={() => setSolutionRevealed((prev) => ({ ...prev, "beginner-password-strength": true }))}
                      >
                        Reveal Solution
                      </button>
                    ) : (
                      <p className="mt-2">Solution: {beginnerMeta["beginner-password-strength"]?.solution}</p>
                    )}
                  </div>
                ) : null}
              </article>

              <article className="rounded-2xl border border-cyan-300/25 bg-black/50 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                <h3 className="font-semibold">Basic SQL Injection Simulator (Safe)</h3>
                <p className="mt-1 text-xs text-cyan-100/80">{beginnerMeta["beginner-sqli-demo"]?.taskDescription}</p>
                <textarea value={sqliPayload} onChange={(e) => setSqliPayload(e.target.value)} className="mt-2 h-24 w-full rounded-lg border border-cyan-300/20 bg-black/40 p-3 text-cyan-50" />
                <p className={`mt-2 text-xs ${sqliRisk ? "text-amber-200" : "text-emerald-200"}`}>
                  {sqliRisk ? "Detection: suspicious SQLi pattern captured in payload." : "Detection: payload appears benign."}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs border border-cyan-300/30 rounded-lg px-3 py-2 hover:bg-cyan-500/10 neon-hover-glow"
                  onClick={() => runBeginnerLab("beginner-sqli-demo", { payload: sqliPayload })}
                  disabled={beginnerBusy["beginner-sqli-demo"] || !sqliPayload.trim()}
                >
                  {beginnerBusy["beginner-sqli-demo"] ? "Running..." : "Run SQLi Simulation"}
                </button>
                {beginnerResults["beginner-sqli-demo"] ? (
                  <div className="mt-2 text-xs text-cyan-100/80">
                    <p>Risk score: {beginnerResults["beginner-sqli-demo"]?.riskScore}</p>
                    <p>Matched rules: {(beginnerResults["beginner-sqli-demo"]?.findings || []).join(", ") || "none"}</p>
                    <p className="mt-1">Vulnerable query: {beginnerResults["beginner-sqli-demo"]?.vulnerableQuery}</p>
                    <p className="mt-1">Prepared statement version: {beginnerResults["beginner-sqli-demo"]?.secureQuery}</p>
                    <p className="mt-1">Why this happens: {beginnerResults["beginner-sqli-demo"]?.whyThisHappens}</p>
                    <p>Hints: {(beginnerMeta["beginner-sqli-demo"]?.hints || []).join(" | ")}</p>
                    {!solutionRevealed["beginner-sqli-demo"] ? (
                      <button
                        type="button"
                        className="mt-2 text-[11px] border border-cyan-300/30 rounded-lg px-2 py-1 hover:bg-cyan-500/10 neon-hover-glow"
                        onClick={() => setSolutionRevealed((prev) => ({ ...prev, "beginner-sqli-demo": true }))}
                      >
                        Reveal Solution
                      </button>
                    ) : (
                      <p className="mt-2">Solution: {beginnerMeta["beginner-sqli-demo"]?.solution}</p>
                    )}
                  </div>
                ) : null}
              </article>

              <article className="rounded-2xl border border-cyan-300/25 bg-black/50 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                <h3 className="font-semibold">XSS Demo Sandbox (Safe)</h3>
                <p className="mt-1 text-xs text-cyan-100/80">{beginnerMeta["beginner-xss-sandbox"]?.taskDescription}</p>
                <textarea value={xssPayload} onChange={(e) => setXssPayload(e.target.value)} className="mt-2 h-24 w-full rounded-lg border border-cyan-300/20 bg-black/40 p-3 text-cyan-50" />
                <p className={`mt-2 text-xs ${xssRisk ? "text-amber-200" : "text-emerald-200"}`}>
                  {xssRisk ? "Detection: executable XSS signature found." : "Detection: no executable signature found."}
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs border border-cyan-300/30 rounded-lg px-3 py-2 hover:bg-cyan-500/10 neon-hover-glow"
                  onClick={() => runBeginnerLab("beginner-xss-sandbox", { payload: xssPayload })}
                  disabled={beginnerBusy["beginner-xss-sandbox"] || !xssPayload.trim()}
                >
                  {beginnerBusy["beginner-xss-sandbox"] ? "Running..." : "Run XSS Simulation"}
                </button>
                {beginnerResults["beginner-xss-sandbox"] ? (
                  <div className="mt-2 text-xs text-cyan-100/80">
                    <p>Risk score: {beginnerResults["beginner-xss-sandbox"]?.riskScore}</p>
                    <p>Findings: {(beginnerResults["beginner-xss-sandbox"]?.findings || []).join(", ") || "none"}</p>
                    <p className="mt-1">Reflected output: {beginnerResults["beginner-xss-sandbox"]?.reflectedOutput}</p>
                    <p className="mt-1">Escaped safe output: {beginnerResults["beginner-xss-sandbox"]?.safeOutput}</p>
                    <p className="mt-1">Why this happens: {beginnerResults["beginner-xss-sandbox"]?.whyThisHappens}</p>
                    <p>Hints: {(beginnerMeta["beginner-xss-sandbox"]?.hints || []).join(" | ")}</p>
                    {!solutionRevealed["beginner-xss-sandbox"] ? (
                      <button
                        type="button"
                        className="mt-2 text-[11px] border border-cyan-300/30 rounded-lg px-2 py-1 hover:bg-cyan-500/10 neon-hover-glow"
                        onClick={() => setSolutionRevealed((prev) => ({ ...prev, "beginner-xss-sandbox": true }))}
                      >
                        Reveal Solution
                      </button>
                    ) : (
                      <p className="mt-2">Solution: {beginnerMeta["beginner-xss-sandbox"]?.solution}</p>
                    )}
                  </div>
                ) : null}
              </article>

              <article className="rounded-2xl border border-cyan-300/25 bg-black/50 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                <h3 className="font-semibold">Port Scanning Visual Simulator</h3>
                <p className="mt-1 text-xs text-cyan-100/80">{beginnerMeta["beginner-portscan-visual"]?.taskDescription}</p>
                <input value={reconDomain} onChange={(e) => setReconDomain(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-cyan-300/20 bg-black/40 px-3 text-cyan-50 placeholder:text-cyan-100/40" />
                <button
                  type="button"
                  className="mt-2 text-xs border border-cyan-300/30 rounded-lg px-3 py-2 hover:bg-cyan-500/10 neon-hover-glow"
                  onClick={() => runBeginnerLab("beginner-portscan-visual", { target: reconDomain })}
                  disabled={beginnerBusy["beginner-portscan-visual"] || !reconDomain.trim()}
                >
                  {beginnerBusy["beginner-portscan-visual"] ? "Running..." : "Run Port Exposure Simulation"}
                </button>
                <ul className="mt-2 text-xs space-y-1">
                  {(beginnerResults["beginner-portscan-visual"]?.ports || reconPorts).map((entry) => (
                    <li key={entry.port}>
                      {beginnerResults["beginner-portscan-visual"]?.target || reconDomain} : {entry.port} -&gt; {entry.status}
                      <div className="mt-1 h-1.5 w-full rounded bg-cyan-500/15 overflow-hidden">
                        <div className={`h-full ${entry.status === "open" ? "bg-rose-400/90" : entry.status === "filtered" ? "bg-amber-300/90" : "bg-cyan-300/80"}`} style={{ width: `${entry.status === "open" ? 85 : entry.status === "filtered" ? 55 : 25}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {beginnerResults["beginner-portscan-visual"]?.fundamentals ? (
                  <div className="mt-2 text-xs text-cyan-100/80 space-y-1">
                    <p>What is TCP? {beginnerResults["beginner-portscan-visual"]?.fundamentals?.tcp}</p>
                    <p>What is a port? {beginnerResults["beginner-portscan-visual"]?.fundamentals?.port}</p>
                    <p>Why open ports matter? {beginnerResults["beginner-portscan-visual"]?.fundamentals?.whyOpenPortsMatter}</p>
                    <p>Hints: {(beginnerMeta["beginner-portscan-visual"]?.hints || []).join(" | ")}</p>
                    {!solutionRevealed["beginner-portscan-visual"] ? (
                      <button
                        type="button"
                        className="mt-2 text-[11px] border border-cyan-300/30 rounded-lg px-2 py-1 hover:bg-cyan-500/10 neon-hover-glow"
                        onClick={() => setSolutionRevealed((prev) => ({ ...prev, "beginner-portscan-visual": true }))}
                      >
                        Reveal Solution
                      </button>
                    ) : (
                      <p className="mt-2">Solution: {beginnerMeta["beginner-portscan-visual"]?.solution}</p>
                    )}
                  </div>
                ) : null}
              </article>
            </div>
        </section>
        <div className="order-1">
        <div className="mb-4 rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(6,10,22,0.95),rgba(4,7,18,0.95))] px-4 py-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          Progress: <strong>{completedLabs}</strong> completed / <strong>{Math.max(totalLabsTouched, labs.length)}</strong> touched ({progressPct}%)
          {progression ? (
            <span className="ml-2 text-cyan-100/90">
              | Rank: <strong>{progression.rank}</strong> | Points: <strong>{progression.points}</strong> | Level:{" "}
              <strong>{progression.level}</strong>
            </span>
          ) : null}
          {badges.length ? <p className="mt-2 text-xs text-cyan-100/90">Badges: {badges.join(" | ")}</p> : null}
        </div>

        <div className="mb-4">
          <h2 className="font-mono text-lg text-cyan-50">Sandbox Practice Console</h2>
          <p className="mt-1 text-sm text-cyan-100/70">
            Run safe, guided commands in a containerized sandbox (when enabled) with allowlisted targets and clear feedback.
          </p>
          {sandboxStatus ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-cyan-100/70">
              <span
                className={`rounded-full border px-3 py-1 ${
                  sandboxStatus.enabled && sandboxStatus.ready
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                    : sandboxStatus.enabled
                      ? "border-amber-300/40 bg-amber-400/10 text-amber-200"
                      : "border-rose-300/40 bg-rose-400/10 text-rose-200"
                }`}
              >
                {sandboxStatus.enabled ? (sandboxStatus.ready ? "Live sandbox ready" : "Live sandbox not ready") : "Sandbox disabled"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Image: {sandboxStatus.image}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Targets: {sandboxStatus.allowlistHosts?.length || sandboxStatus.allowlistCidrs?.length ? "Allowlist on" : "Not configured"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                Tools: {(sandboxStatus.allowedBins || []).slice(0, 6).join(", ")}
                {(sandboxStatus.allowedBins || []).length > 6 ? "..." : ""}
              </span>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <section className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(244,63,94,0.16),transparent_42%),linear-gradient(180deg,rgba(7,12,26,0.98),rgba(4,7,18,0.98))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(transparent_96%,rgba(56,189,248,0.08)),linear-gradient(90deg,transparent_96%,rgba(56,189,248,0.08))] [background-size:28px_28px]" />
            <div className="relative">
              {activeLab ? (
                <>
                <div className={`lab-hub-hero ${isPracticeHub ? "is-practice-hub" : ""}`}>
                  <div className="lab-hub-hero__copy">
                    <div className="lab-hub-hero__badge">
                      <PlayCircle className="h-4 w-4" />
                      Live Practice Hub
                    </div>
                    <h2 className="lab-hub-hero__title">{activeLab.title}</h2>
                    <p className="lab-hub-hero__subtitle">{activeLab.description}</p>
                    <div className="lab-hub-hero__stats">
                      <div>
                        <span>Tools</span>
                        <strong>{activeLab.recommendedTools.length}</strong>
                      </div>
                      <div>
                        <span>Steps</span>
                        <strong>{activeLab.steps.length}</strong>
                      </div>
                      <div>
                        <span>Commands</span>
                        <strong>{activeLab.allowedCommands.length}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="lab-hub-hero__actions">
                    <button
                      type="button"
                      className="home-clean-mini-cta-link neon-hover-glow"
                      onClick={() => {
                        markLabProgress("started").catch(() => undefined);
                        setConsoleLines((prev) => [...prev, "Practice session started. Run `help` to begin."]);
                        setLabModalOpen(true);
                      }}
                    >
                      <Rocket className="h-4 w-4" /> Start Practice Now
                    </button>
                    <button type="button" className="home-clean-mini-cta-link neon-hover-glow" onClick={() => setLabModalOpen(true)}>
                      <Wrench className="h-4 w-4" /> Launch Secure Sandbox
                    </button>
                    <button
                      type="button"
                      className="home-clean-mini-cta-link neon-hover-glow"
                      onClick={() => {
                        setCommand("complete");
                        setConsoleLines((prev) => [...prev, `Challenge Mode: ${activeLab.challengeModeHint}`]);
                      }}
                    >
                      <Bot className="h-4 w-4" /> Challenge Mode
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-300/25 bg-black/30 p-4 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-sm inline-flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> Practice Sandbox</p>
                    <p className="text-xs text-muted-foreground">Execution runs in a secure modal with allowlist enforcement</p>
                  </div>
                  <p className="text-xs text-cyan-100/80">Use the secure modal for command execution, output inspection, and guided practice flow.</p>
                  <button type="button" className="mt-3 text-xs border border-cyan-300/30 rounded px-3 py-2 hover:bg-cyan-500/10 neon-hover-glow" onClick={() => setLabModalOpen(true)}>
                    Open Lab Modal
                  </button>
                </div>

                <div className="lab-hub-grid">
                  <div className="lab-hub-card">
                    <h3>Suggested Flow</h3>
                    <ol>
                      {activeLab.steps.slice(0, 4).map((step, idx) => (
                        <li key={step}>
                          <span>{idx + 1}</span>
                          <p>{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="lab-hub-card">
                    <h3>Quick Commands</h3>
                    <div className="lab-hub-command-grid">
                      {quickCommands.map((cmd) => (
                        <button
                          key={cmd}
                          type="button"
                          onClick={() => {
                            setCommand(cmd);
                            setLabModalOpen(true);
                          }}
                        >
                          {cmd}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCommand("help");
                          setLabModalOpen(true);
                        }}
                      >
                        help
                      </button>
                    </div>
                    <p className="lab-hub-card__hint">Commands run in a secure allowlist. Try one and view output in the modal.</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]">
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-cyan-300" /> Objective</p>
                    <p className="mt-1">{activeLab.objective}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]">
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5 text-cyan-300" /> Task</p>
                    <ol className="mt-1 list-decimal ml-4 space-y-1">
                      {activeLab.steps.slice(0, 3).map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]">
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-cyan-300" /> Result</p>
                    <p className="mt-1">{activeLab.practiceEnvironment}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]">
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-cyan-300" /> Reward</p>
                    <p className="mt-1">{activeLab.challengeModeHint}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 mb-4 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]">
                  <p className="text-xs text-muted-foreground mb-2">Recommended tools</p>
                  <div className="flex flex-wrap gap-2">
                    {activeLab.recommendedTools.map((tool) => (
                      <span key={tool} className="text-[11px] border border-primary/20 rounded-full px-2 py-1">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-300/20 bg-black/35 p-3 text-xs text-cyan-100/80 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)]">
                  This sandbox is a safe simulation. Commands are allow-listed and never run on your real system.
                </div>
                </>
              ) : null}
            </div>
          </section>

          <aside className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_20%_12%,rgba(34,211,238,0.18),transparent_42%),linear-gradient(180deg,rgba(7,12,26,0.98),rgba(4,7,18,0.98))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(transparent_96%,rgba(56,189,248,0.08)),linear-gradient(90deg,transparent_96%,rgba(56,189,248,0.08))] [background-size:28px_28px]" />
            <div className="relative">
              <h2 className="font-mono text-base mb-3 inline-flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                Practice Modules
              </h2>
              <div className="grid gap-3">
                {labs.map((lab) => (
                  <button
                    key={lab.id}
                    type="button"
                    className={`text-left rounded-xl border border-cyan-300/20 bg-black/40 p-3 transition-colors hover:bg-cyan-500/10 neon-hover-glow ${
                      lab.id === activeLabId ? "border-cyan-300/60 bg-cyan-500/15 shadow-[0_0_24px_rgba(34,211,238,0.18)]" : "hover:border-cyan-300/40"
                    }`}
                    onClick={() => {
                      setActiveLabId(lab.id);
                      setConsoleLines([`Loaded ${lab.title}. Run 'help' to begin.`]);
                      setLabModalOpen(true);
                    }}
                  >
                    <h3 className="font-mono text-sm">{lab.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{lab.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
        </div>
        </div>
      </div>

      {mentorOpen ? (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_55%),linear-gradient(180deg,rgba(7,12,26,0.98),rgba(3,6,16,0.98))] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-lg text-cyan-50">Ask NeuroBot Mentor</h3>
              <button type="button" className="text-xs border border-cyan-300/30 rounded-lg px-2 py-1 hover:bg-cyan-500/10 neon-hover-glow" onClick={() => setMentorOpen(false)}>
                Close
              </button>
            </div>
            {mentorAutoReason ? (
              <div className="mb-3 rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 inline-flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{mentorAutoReason}</span>
              </div>
            ) : null}
            <p className="text-xs text-cyan-100/70 mb-2">Context-aware prompt (editable):</p>
            <textarea
              value={mentorPrompt}
              onChange={(e) => setMentorPrompt(e.target.value)}
              className="w-full h-28 rounded-lg border border-cyan-300/20 bg-black/40 p-3 text-sm text-cyan-50"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="text-xs border border-cyan-300/30 rounded-lg px-3 py-1 hover:bg-cyan-500/10 neon-hover-glow" onClick={() => setMentorOpen(false)}>
                Minimize
              </button>
              <button type="button" className="text-xs border border-cyan-300/40 rounded-lg px-3 py-1 hover:bg-cyan-500/10 neon-hover-glow" onClick={openMentorWithPrompt}>
                Open Mentor Mode
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <LabExecutionModal
        open={labModalOpen}
        activeLab={activeLab}
        command={command}
        running={running}
        consoleLines={consoleLines}
        onCommandChange={setCommand}
        onClose={() => setLabModalOpen(false)}
        onSubmit={runCommand}
        onPickAllowedCommand={setCommand}
      />
    </div>
  );
};

export default LabPage;
