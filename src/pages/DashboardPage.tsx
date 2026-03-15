import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, Flame, Lock, RefreshCw, ShieldCheck, ShieldOff, Terminal, Trash2, Trophy, WandSparkles } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGetJson, apiPostJson } from "@/lib/apiClient";
import { pyGetJson, pyPostJson } from "@/lib/pyApiClient";

type DashboardPayload = {
  intelligence: {
    xp: number;
    streak: number;
    rank: string;
    proficiency: number;
    completedLabs: number;
    totalLabsTouched: number;
    heatmap: Record<string, number>;
    continueLearning: { intent: string; action: string };
    recentToolUsage: Array<{ tool: string; intent: string; at: number }>;
    telemetry?: { events: number; toolsUsed: number; successRate: number; averageDurationMs: number };
    achievements?: string[];
  };
};

type SessionsPayload = { sessions: Array<{ sessionId: string; updatedAt: number; preview: string; messageCount: number }> };
type NewsPayload = { items: Array<{ id: string; title: string; category: string; link: string; publishedTs: number }> };
type AuthMePayload = { user: { id: string; email: string; name?: string | null } };
type ScanFinding = { id: string; severity: "low" | "medium" | "high"; title: string; description: string; recommendation: string };
type ScanReport = {
  id: string;
  target_url: string;
  final_url?: string | null;
  status_code?: string | null;
  score: number;
  summary?: string | null;
  findings: ScanFinding[];
  latency_ms?: number | null;
  created_at?: string | null;
};
type ScanHistory = { items: Array<{ id: string; target_url: string; score: number; created_at: string }> };
type ThreatDetectResponse = {
  id: string;
  risk_level: "low" | "medium" | "high";
  reasons: string[];
  suspicious: boolean;
  metrics: { requests_per_min: number; error_rate: number; failed_logins: number; anomaly_score: number; notes?: string | null };
};
const SAVED_TOOLS_KEY = "tools:saved:v1";

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const withBackoff = async <T,>(task: () => Promise<T>, retries = 2) => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
      await delay(220 * 2 ** attempt);
      attempt += 1;
    }
  }
  throw lastError;
};

const truncate = (text: string, max = 92) => (text.length <= max ? text : `${text.slice(0, max)}...`);

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardPayload["intelligence"] | null>(null);
  const [sessions, setSessions] = useState<SessionsPayload["sessions"]>([]);
  const [savedTools, setSavedTools] = useState<string[]>([]);
  const [news, setNews] = useState<NewsPayload["items"]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState<string[]>(["[sandbox] ready > choose a tool and execute"]);
  const [sandboxInput, setSandboxInput] = useState("example.com");
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [activeTool, setActiveTool] = useState<"hash" | "recon" | "headers" | "password">("recon");
  const [tip, setTip] = useState("Tip: Use authorized targets only and keep each run documented.");
  const [scanTarget, setScanTarget] = useState("example.com");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistory["items"]>([]);
  const [authUser, setAuthUser] = useState<AuthMePayload["user"] | null>(null);
  const [pyUserId, setPyUserId] = useState<string | null>(null);
  const [threatBusy, setThreatBusy] = useState(false);
  const [threatResult, setThreatResult] = useState<ThreatDetectResponse | null>(null);
  const [threatMetrics, setThreatMetrics] = useState({
    requests_per_min: 420,
    error_rate: 0.03,
    failed_logins: 4,
    anomaly_score: 0.2,
    notes: "",
  });

  const loadNews = async () => {
    setNewsLoading(true);
    try {
      const feed = await withBackoff(() => apiGetJson<NewsPayload>("/api/intelligence/news?category=all&limit=3"), 2);
      setNews((feed.items || []).slice(0, 3));
    } finally {
      setNewsLoading(false);
    }
  };

  const loadSecurityOps = async (userId?: string | null) => {
    try {
      const query = userId ? `/scan/history?limit=8&user_id=${encodeURIComponent(userId)}` : "/scan/history?limit=8";
      const history = await pyGetJson<ScanHistory>(query);
      setScanHistory(history.items || []);
    } catch {
      setScanHistory([]);
    }
  };

  const loadAuthUser = async () => {
    try {
      const payload = await apiGetJson<AuthMePayload>("/api/auth/me");
      setAuthUser(payload.user);
      if (payload.user?.email) {
        try {
          const pyUser = await pyPostJson<{ id: string; email: string; name?: string | null }>("/users", {
            email: payload.user.email,
            name: payload.user.name,
            external_id: payload.user.id,
          });
          setPyUserId(pyUser.id);
          return pyUser.id;
        } catch {
          setPyUserId(null);
        }
      }
    } catch {
      setAuthUser(null);
      setPyUserId(null);
    }
    return null;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [dash, hist] = await withBackoff(
        () =>
          Promise.all([
            apiGetJson<DashboardPayload>("/api/intelligence/dashboard"),
            apiGetJson<SessionsPayload>("/api/neurobot/history/sessions"),
          ]),
        2
      );
      setData(dash.intelligence);
      setSessions(hist.sessions || []);
      const userId = await loadAuthUser();
      await loadNews();
      await loadSecurityOps(userId);
      try {
        setSavedTools(JSON.parse(localStorage.getItem(SAVED_TOOLS_KEY) || "[]"));
      } catch {
        setSavedTools([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadNews().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const heatmapRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.heatmap || {})
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14);
  }, [data]);

  const scanChartData = useMemo(() => {
    return [...scanHistory]
      .reverse()
      .map((item) => ({
        name: new Date(item.created_at).toLocaleDateString(),
        score: Math.round(item.score),
      }));
  }, [scanHistory]);

  const threatChartData = useMemo(
    () => [
      { name: "RPM", value: threatMetrics.requests_per_min },
      { name: "Errors", value: Math.round(threatMetrics.error_rate * 100) },
      { name: "Failed", value: threatMetrics.failed_logins },
      { name: "Anomaly", value: Math.round(threatMetrics.anomaly_score * 100) },
    ],
    [threatMetrics]
  );

  const deleteSession = async (sessionId: string) => {
    await apiPostJson("/api/neurobot/history/delete-session", { sessionId });
    setSessions((prev) => prev.filter((item) => item.sessionId !== sessionId));
  };

  const runScan = async () => {
    const target = scanTarget.trim();
    if (!target) return;
    setScanBusy(true);
    try {
      const report = await pyPostJson<ScanReport>("/scan", { url: target, user_id: pyUserId || undefined });
      setScanReport(report);
      await loadSecurityOps(pyUserId);
    } catch (error) {
      setScanReport({
        id: "local-error",
        target_url: target,
        score: 0,
        summary: `Scan failed: ${String((error as Error)?.message || "unreachable")}`,
        findings: [
          {
            id: "scan_failed",
            severity: "high",
            title: "Scan failed",
            description: "The scanning API could not complete the request.",
            recommendation: "Confirm the Python API is running and the target is reachable.",
          },
        ],
      });
    } finally {
      setScanBusy(false);
    }
  };

  const runThreatDetect = async () => {
    setThreatBusy(true);
    try {
      const result = await pyPostJson<ThreatDetectResponse>("/threat/detect", { metrics: threatMetrics, user_id: pyUserId || undefined });
      setThreatResult(result);
    } catch (error) {
      setThreatResult({
        id: "local-error",
        risk_level: "medium",
        reasons: ["Threat detection service unavailable. Showing fallback heuristic."],
        suspicious: true,
        metrics: threatMetrics,
      });
    } finally {
      setThreatBusy(false);
    }
  };

  const runSandboxTool = async () => {
    const value = sandboxInput.trim();
    if (!value) {
      setConsoleLines((prev) => [...prev, "[sandbox] input required"]);
      return;
    }
    setSandboxBusy(true);
    setConsoleLines((prev) => [...prev, `[sandbox] running ${activeTool} -> ${value}`]);
    try {
      if (activeTool === "recon") {
        const payload = await withBackoff(
          () => apiPostJson<{ result: { target: string; subdomains: Array<{ hostname: string; confidence: number }> } }>("/api/intelligence/tools/subdomain-sim", { target: value }),
          1
        );
        const top = (payload.result.subdomains || []).slice(0, 3).map((row) => `${row.hostname} (${row.confidence}%)`).join(", ");
        setConsoleLines((prev) => [...prev, `[sandbox][recon] ${payload.result.target} => ${top}`]);
        setTip("Recon tip: prioritize admin/dev/staging hosts first.");
      }
      if (activeTool === "hash") {
        const payload = await withBackoff(
          () => apiPostJson<{ result: { algorithm: string; confidence: number } }>("/api/intelligence/tools/hash-identify", { hash: value }),
          1
        );
        setConsoleLines((prev) => [...prev, `[sandbox][hash] ${payload.result.algorithm} (${Math.round(payload.result.confidence * 100)}%)`]);
        setTip("Hash tip: prefer SHA-256+ in modern systems.");
      }
      if (activeTool === "headers") {
        const target = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        const payload = await withBackoff(
          () => apiPostJson<{ result: { riskScore: number; missing?: string[] } }>("/api/intelligence/tools/headers-url", { url: target }),
          1
        );
        setConsoleLines((prev) => [...prev, `[sandbox][headers] risk=${payload.result.riskScore} missing=${(payload.result.missing || []).slice(0, 3).join(", ") || "none"}`]);
        setTip("Header tip: enforce CSP + HSTS + X-Content-Type-Options.");
      }
      if (activeTool === "password") {
        const payload = await withBackoff(
          () => apiPostJson<{ result: { score: number; level: string } }>("/api/intelligence/tools/password-strength", { password: value }),
          1
        );
        setConsoleLines((prev) => [...prev, `[sandbox][password] score=${payload.result.score}/100 (${payload.result.level})`]);
        setTip("Password tip: length + entropy beats complexity-only rules.");
      }
    } catch (error) {
      setConsoleLines((prev) => [...prev, `[sandbox][error] ${String((error as Error)?.message || "execution failed")}`]);
      setTip("Execution failed. Open mentor mode for guided recovery.");
      window.dispatchEvent(
        new CustomEvent("neurobot:topic", {
          detail: {
            id: "sandbox-recovery",
            title: "Sandbox Recovery Mentor",
            query: `My sandbox tool run failed for ${activeTool}. Help me fix input and retry safely.`,
            tags: ["sandbox", "mentor", "recovery"],
            mentorMode: true,
          },
        })
      );
    } finally {
      setSandboxBusy(false);
    }
  };

  const openMentor = () => {
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: "sandbox-guide",
          title: "Live Sandbox Guide",
          query: `Guide me to use the ${activeTool} tool in sandbox mode with step-by-step hints and safe usage.`,
          tags: ["sandbox", "guide", activeTool],
          mentorMode: true,
        },
      })
    );
  };

  const latestScore = scanReport?.score ?? scanHistory[0]?.score ?? 0;
  const latestTarget = scanReport?.target_url ?? scanHistory[0]?.target_url ?? "Awaiting scan";
  const scoreTone = latestScore >= 80 ? "text-emerald-300" : latestScore >= 55 ? "text-amber-300" : "text-rose-300";
  const scoreBar = latestScore >= 80 ? "bg-emerald-400" : latestScore >= 55 ? "bg-amber-400" : "bg-rose-400";
  const reportFindings = scanReport?.findings?.slice(0, 3) || [];

  return (
    <div className="container mx-auto px-4 py-10 page-shell">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-xl border border-cyan-300/30 bg-[radial-gradient(circle_at_12%_20%,rgba(0,245,255,0.2),transparent_40%),radial-gradient(circle_at_82%_18%,rgba(124,58,237,0.2),transparent_45%),rgba(4,10,16,0.95)] p-5">
          <div className="pointer-events-none absolute inset-0 soc-grid-overlay opacity-70" />
          <h1 className="relative text-2xl md:text-3xl font-black">
            <span className="brand-gradient-text-animated">
              Sandbox Command Center
            </span>
          </h1>
          <p className="relative mt-2 text-sm text-cyan-100/85">Run practical cyber tooling with real API execution and console feedback.</p>

          <div className="relative mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <article className="rounded-lg border border-cyan-300/25 bg-black/35 p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  { id: "recon", label: "Recon" },
                  { id: "hash", label: "Hash" },
                  { id: "headers", label: "Headers" },
                  { id: "password", label: "Password" },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className={`rounded-md border px-3 py-1.5 text-xs transition hover:-translate-y-0.5 ${activeTool === tool.id ? "border-cyan-300/55 bg-cyan-500/20 text-cyan-100" : "border-cyan-300/25 bg-black/35 text-cyan-100/85 hover:bg-cyan-500/10"}`}
                    onClick={() => {
                      setActiveTool(tool.id as "hash" | "recon" | "headers" | "password");
                      setTip(`Tool tip: ${tool.label} selected. Keep input clean and authorized.`);
                    }}
                  >
                    <Terminal className="mr-1 inline h-3.5 w-3.5" />
                    {tool.label}
                  </button>
                ))}
                <button type="button" className="rounded-md border border-cyan-300/35 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20" onClick={openMentor}>
                  <Bot className="mr-1 inline h-3.5 w-3.5" />
                  Prompt AI Guide
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  value={sandboxInput}
                  onChange={(event) => setSandboxInput(event.target.value)}
                  className="min-w-[220px] flex-1 rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                  placeholder={activeTool === "hash" ? "Enter hash value" : activeTool === "password" ? "Enter password sample" : "Enter domain or URL"}
                />
                <button
                  type="button"
                  className="rounded-md border border-cyan-300/40 brand-gradient-bg px-4 py-2 text-xs font-semibold transition hover:scale-[1.02] disabled:opacity-60"
                  onClick={runSandboxTool}
                  disabled={sandboxBusy}
                >
                  {sandboxBusy ? "Executing..." : "Run Tool"}
                </button>
              </div>

              <div className="mt-3 max-h-[220px] overflow-y-auto rounded-md border border-cyan-300/20 bg-black/60 p-3 font-mono text-xs text-cyan-100/90">
                {consoleLines.slice(-16).map((line, idx) => (
                  <pre key={`${line}-${idx}`} className="whitespace-pre-wrap">{line}</pre>
                ))}
              </div>
            </article>

            <aside className="rounded-lg border border-cyan-300/25 bg-black/35 p-4 text-xs">
              <p className="inline-flex items-center gap-1 text-cyan-200"><WandSparkles className="h-3.5 w-3.5" /> Live Tips</p>
              <p className="mt-2 text-cyan-100/85">{tip}</p>
              <p className="mt-4 text-cyan-100/70">Hover + run each tool, then ask ZORVEX for remediation playbooks.</p>
              <button type="button" className="mt-3 w-full rounded-md border border-cyan-300/30 px-3 py-2 text-xs hover:bg-cyan-500/10" onClick={openMentor}>
                Open Mentor Popup
              </button>
            </aside>
          </div>
        </section>

        <section className="glass-card rounded-xl p-6">
          <h2 className="text-2xl font-black">User Intelligence Dashboard</h2>
          <p className="mt-2 text-muted-foreground">Real telemetry, XP progression, streak discipline, and secure history controls.</p>
          <div className="cyber-divider mt-4" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <article className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Website Security Scan</h2>
              <span className="text-xs text-muted-foreground">Google Cloud PostgreSQL ready</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Run a safe header and HTTPS audit, then store the report for review.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={scanTarget}
                onChange={(event) => setScanTarget(event.target.value)}
                className="min-w-[220px] flex-1 rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                placeholder="Enter a website domain"
              />
              <button
                type="button"
                className="rounded-md border border-cyan-300/40 brand-gradient-bg px-4 py-2 text-xs font-semibold transition hover:scale-[1.02] disabled:opacity-60"
                onClick={runScan}
                disabled={scanBusy}
              >
                {scanBusy ? "Scanning..." : "Scan Website"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-cyan-300/20 bg-black/20 p-4">
              <p className="text-xs text-muted-foreground">Security Score</p>
              <div className="mt-2 flex items-center justify-between">
                <span className={`text-2xl font-bold ${scoreTone}`}>{Math.round(latestScore)}</span>
                <span className="text-xs text-muted-foreground">{latestTarget}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                <div className={`h-2 rounded-full ${scoreBar}`} style={{ width: `${Math.min(100, Math.max(0, latestScore))}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{scanReport?.summary || "Run a scan to generate a vulnerability report."}</p>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold">Vulnerability Report</h3>
              <div className="mt-2 space-y-2 text-xs">
                {reportFindings.length ? (
                  reportFindings.map((finding) => (
                    <div key={finding.id} className="rounded-md border border-cyan-300/15 bg-black/25 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{finding.title}</span>
                        <span className={`text-[11px] ${finding.severity === "high" ? "text-rose-300" : finding.severity === "medium" ? "text-amber-300" : "text-emerald-300"}`}>
                          {finding.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{finding.description}</p>
                      <p className="mt-1 text-cyan-100/80">Fix: {finding.recommendation}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No scan findings yet. Launch a scan to populate the report.</p>
                )}
              </div>
            </div>
          </article>

          <article className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">AI Threat Detection</h2>
              <span className="inline-flex items-center gap-1 text-xs text-cyan-200">
                <Activity className="h-3.5 w-3.5" />
                Live model scoring
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Simulate abnormal traffic, logic attacks, and suspicious activity signals.</p>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-muted-foreground">Requests / min</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                  value={threatMetrics.requests_per_min}
                  onChange={(event) => setThreatMetrics((prev) => ({ ...prev, requests_per_min: Number(event.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Error rate</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                  value={threatMetrics.error_rate}
                  onChange={(event) => setThreatMetrics((prev) => ({ ...prev, error_rate: Number(event.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Failed logins</span>
                <input
                  type="number"
                  className="w-full rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                  value={threatMetrics.failed_logins}
                  onChange={(event) => setThreatMetrics((prev) => ({ ...prev, failed_logins: Number(event.target.value) }))}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Anomaly score</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                  value={threatMetrics.anomaly_score}
                  onChange={(event) => setThreatMetrics((prev) => ({ ...prev, anomaly_score: Number(event.target.value) }))}
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-md border border-cyan-300/25 bg-black/30 px-3 py-2 text-sm"
                placeholder="Optional notes about suspicious activity"
                value={threatMetrics.notes || ""}
                onChange={(event) => setThreatMetrics((prev) => ({ ...prev, notes: event.target.value }))}
              />
              <button
                type="button"
                className="rounded-md border border-cyan-300/40 bg-[linear-gradient(90deg,#facc15,#f97316)] px-4 py-2 text-xs font-semibold text-slate-950 transition hover:scale-[1.02] disabled:opacity-60"
                onClick={runThreatDetect}
                disabled={threatBusy}
              >
                {threatBusy ? "Analyzing..." : "AI Detect"}
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-cyan-300/20 bg-black/20 p-4 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Threat Assessment</p>
                <span className={`inline-flex items-center gap-1 ${threatResult?.risk_level === "high" ? "text-rose-300" : threatResult?.risk_level === "medium" ? "text-amber-300" : "text-emerald-300"}`}>
                  {threatResult?.risk_level ? (
                    threatResult.risk_level === "high" ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  )}
                  {(threatResult?.risk_level || "low").toUpperCase()}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {(threatResult?.reasons || ["Run AI detect to see abnormal traffic signals."]).map((reason) => (
                  <p key={reason}>{reason}</p>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-cyan-300/20 bg-black/20 p-3">
                <p className="text-xs text-muted-foreground">Security Score Trend</p>
                <div className="mt-2 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={scanChartData}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="score" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-lg border border-cyan-300/20 bg-black/20 p-3">
                <p className="text-xs text-muted-foreground">Threat Signal Mix</p>
                <div className="mt-2 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={threatChartData}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </article>
        </section>

        {loading ? <section className="glass-card rounded-xl p-6 text-sm text-muted-foreground">Loading intelligence signals...</section> : null}

        {data ? (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <article className="glass-card rounded-xl p-5">
                <p className="text-xs text-muted-foreground">XP</p>
                <h3 className="text-xl font-bold mt-1">{data.xp}</h3>
              </article>
              <article className="glass-card rounded-xl p-5 hidden sm:block">
                <p className="text-xs text-muted-foreground">Rank</p>
                <h3 className="text-xl font-bold mt-1">{data.rank}</h3>
              </article>
              <article className="glass-card rounded-xl p-5 hidden sm:block">
                <p className="text-xs text-muted-foreground">Streak</p>
                <h3 className="text-xl font-bold mt-1 inline-flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-300" /> {data.streak} days
                </h3>
              </article>
              <article className="glass-card rounded-xl p-5">
                <p className="text-xs text-muted-foreground">Proficiency</p>
                <h3 className="text-xl font-bold mt-1">{Math.round(data.proficiency * 100)}%</h3>
              </article>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <article className="glass-card rounded-xl p-5">
                <h2 className="font-bold">Continue Learning</h2>
                <p className="mt-2 text-sm text-muted-foreground">Intent: {data.continueLearning.intent}</p>
                <p className="mt-1 text-sm">{data.continueLearning.action}</p>
                <p className="mt-3 text-xs text-muted-foreground">Labs completed: {data.completedLabs} | Labs touched: {data.totalLabsTouched}</p>
              </article>
              <article className="glass-card rounded-xl p-5">
                <h2 className="font-bold">Telemetry Snapshot</h2>
                <div className="mt-3 text-xs space-y-1">
                  <p>Events: {data.telemetry?.events ?? 0}</p>
                  <p>Tools used: {data.telemetry?.toolsUsed ?? 0}</p>
                  <p>Success rate: {Math.round((data.telemetry?.successRate ?? 0) * 100)}%</p>
                  <p>Avg duration: {data.telemetry?.averageDurationMs ?? 0}ms</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-cyan-100/90">
                    <Trophy className="h-3.5 w-3.5 text-amber-300" />
                    {(data.achievements || []).join(" | ") || "No achievements unlocked yet"}
                  </p>
                </div>
              </article>
              <article className="glass-card rounded-xl p-5 hidden md:block">
                <h2 className="font-bold">Behavioral Heatmap (14 days)</h2>
                <div className="mt-3 text-xs space-y-1">
                  {heatmapRows.map(([day, count]) => (
                    <div key={day} className="flex items-center justify-between border-b border-white/10 py-1">
                      <span>{day}</span>
                      <span>{count} events</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="glass-card rounded-xl p-5">
                <h2 className="font-bold">Saved Tools</h2>
                <div className="mt-3 text-xs space-y-2">
                  {savedTools.length ? savedTools.map((item) => <p key={item} className="rounded border border-cyan-300/20 bg-black/20 px-2 py-1">{item}</p>) : <p className="text-muted-foreground">No saved tools yet.</p>}
                </div>
              </article>
            </section>

            <section className="glass-card rounded-xl p-5">
              <h2 className="font-bold">Activity Timeline</h2>
              <div className="mt-3 space-y-2 md:space-y-2 overflow-x-auto md:overflow-visible snap-x">
                {(data.recentToolUsage || []).slice(0, 10).map((row) => (
                  <div key={`${row.tool}-${row.at}`} className="rounded-md border border-cyan-300/20 bg-black/20 px-3 py-2 flex items-center justify-between min-w-[17rem] snap-start">
                    <div>
                      <p className="text-sm font-semibold">{row.tool}</p>
                      <p className="text-xs text-muted-foreground">Intent: {row.intent}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(row.at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">Security News</h2>
                <button onClick={() => loadNews().catch(() => undefined)} className="text-xs border border-cyan-300/30 rounded px-2 py-1 hover:bg-cyan-500/10 inline-flex items-center gap-1" disabled={newsLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${newsLoading ? "animate-spin" : ""}`} /> Refresh
                </button>
              </div>
              <div className="mt-3 flex md:block gap-2 overflow-x-auto md:overflow-visible snap-x">
                {news.map((item) => (
                  <a key={item.id} href={item.link} target="_blank" rel="noreferrer" className="block rounded-md border border-cyan-300/20 bg-black/20 px-3 py-2 hover:bg-cyan-500/10 min-w-[17rem] snap-start">
                    <p className="text-sm font-semibold">{truncate(item.title, 88)}</p>
                    <p className="text-xs text-muted-foreground">{item.category} - {new Date(item.publishedTs).toLocaleDateString()}</p>
                  </a>
                ))}
              </div>
            </section>

            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-bold">Chat History Manager</h2>
              </div>
              <div className="mt-4 space-y-2">
                {sessions.map((item) => (
                  <div key={item.sessionId} className="rounded-lg border border-cyan-300/20 bg-black/20 px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{truncate(item.preview, 72)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleString()} - {item.messageCount} msgs
                      </p>
                    </div>
                    <button className="text-xs border border-rose-300/30 rounded px-2 py-1 inline-flex items-center gap-1 hover:bg-rose-500/10" onClick={() => deleteSession(item.sessionId)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["Encrypted Sessions", "Secure Login", "Privacy First Architecture"].map((item) => (
                <article key={item} className="rounded-lg border border-cyan-300/20 bg-cyan-500/5 p-4 text-sm inline-flex items-center gap-2">
                  {item.includes("Login") ? <Lock className="h-4 w-4 text-cyan-300" /> : <ShieldCheck className="h-4 w-4 text-cyan-300" />}
                  {item}
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default DashboardPage;

