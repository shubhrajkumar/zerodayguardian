import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, apiGetJson, apiPostJson, getStoredAccessToken } from "@/lib/apiClient";
import { getPyApiUserMessage, pyGetJson, pyPostJson } from "@/lib/pyApiClient";
import { useToast } from "@/hooks/use-toast";

const MODULES = [
  { id: "whois", label: "WHOIS" },
  { id: "dns", label: "DNS" },
  { id: "rdns", label: "Reverse DNS" },
  { id: "asn", label: "ASN" },
  { id: "tls", label: "TLS/Certs" },
  { id: "geoip", label: "GeoIP" },
  { id: "breach", label: "Breach" },
  { id: "social", label: "Social" },
  { id: "news", label: "News" },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];
type PyRecommendationResponse = {
  user_id?: string | null;
  generated_at: string;
  recommendations: Array<{ title: string; reason: string; action: string; priority?: number }>;
  signals?: Record<string, unknown>;
};
type OsintResolveResponse = {
  verified?: boolean;
} & Record<string, unknown>;
type UploadAnalysisResponse = {
  result?: unknown;
} & Record<string, unknown>;

const formatValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (!value) return "--";
  return JSON.stringify(value, null, 2);
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const output = String(reader.result || "");
      const base64 = output.includes(",") ? output.split(",").pop() || "" : output;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });

const OsintPage = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<ModuleId[]>([
    "whois",
    "dns",
    "rdns",
    "asn",
    "tls",
    "geoip",
    "breach",
    "social",
    "news",
  ]);
  const [result, setResult] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [caseNotes, setCaseNotes] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [caseSummary, setCaseSummary] = useState("");
  const [caseFolder, setCaseFolder] = useState("");
  const [caseTags, setCaseTags] = useState<string[]>([]);
  const [caseTagInput, setCaseTagInput] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [entities, setEntities] = useState<string[]>([]);
  const [entityInput, setEntityInput] = useState("");
  const [includeCertHistory, setIncludeCertHistory] = useState(false);
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [watchLabel, setWatchLabel] = useState("");
  const [watchTarget, setWatchTarget] = useState("");
  const [watchInterval, setWatchInterval] = useState(60);
  const [ruleMinRiskScore, setRuleMinRiskScore] = useState(70);
  const [ruleBreachThreshold, setRuleBreachThreshold] = useState(1);
  const [ruleAlertNoDns, setRuleAlertNoDns] = useState(true);
  const [ruleAlertMissingTls, setRuleAlertMissingTls] = useState(true);
  const [routingMinSeverity, setRoutingMinSeverity] = useState<"low" | "medium" | "high">("medium");
  const [routingEmail, setRoutingEmail] = useState(true);
  const [routingWebhook, setRoutingWebhook] = useState(true);
  const [routingSlack, setRoutingSlack] = useState(true);
  const [routingMode, setRoutingMode] = useState<"all" | "severity">("all");
  const [routingLow, setRoutingLow] = useState({ email: false, webhook: true, slack: false });
  const [routingMedium, setRoutingMedium] = useState({ email: false, webhook: true, slack: false });
  const [routingHigh, setRoutingHigh] = useState({ email: true, webhook: true, slack: true });
  const [verificationBanner, setVerificationBanner] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [pyRecommendations, setPyRecommendations] = useState<PyRecommendationResponse | null>(null);
  const [pyRecLoading, setPyRecLoading] = useState(false);
  const [pyRecError, setPyRecError] = useState("");

  const loadProviders = useCallback(async () => {
    try {
      const payload = await apiGetJson<{ providers: unknown }>("/api/osint/providers");
      setProviders(payload.providers);
    } catch {
      setProviders(null);
    }
  }, []);

  const toggleModule = (id: ModuleId) => {
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const runOsint = async () => {
    if (!query.trim()) {
      toast({ title: "Add a target to investigate." });
      return;
    }
    setLoading(true);
    try {
      const payload = await apiPostJson<OsintResolveResponse>("/api/osint/resolve", {
        query: query.trim(),
        modules,
        options: {
          dnsTypes: ["A", "AAAA", "MX", "NS", "TXT", "CNAME"],
          maxSocialChecks: 10,
          newsLimit: 10,
          includeCertificateHistory: includeCertHistory,
        },
      });
      setResult(payload);
      const event = {
        at: Date.now(),
        type: "investigation_run",
        detail: `OSINT run completed for ${query.trim()}`,
      };
      setEvents((prev) => [event, ...prev].slice(0, 50));
      try {
        await pyPostJson("/events", {
          event_type: "osint_lookup",
          surface: "osint",
          target: query.trim(),
          metadata: { modules, verified: Boolean(payload?.verified) },
        });
      } catch {
        // best-effort telemetry only
      }
    } catch (error: any) {
      if (error?.code === "email_unverified") {
        setVerificationBanner("Please verify your email to use OSINT features.");
      }
      toast({ title: "OSINT request failed", description: getPyApiUserMessage(error, "Try again in a moment.") });
    } finally {
      setLoading(false);
    }
  };

  const analyzeUpload = async () => {
    if (!uploadFile) {
      toast({ title: "Select a file to analyze." });
      return;
    }
    if (uploadFile.size > 40_000_000) {
      setUploadError("File too large. Max 40 MB for upload analysis.");
      return;
    }
    setUploadBusy(true);
    setUploadError("");
    try {
      const base64 = await readFileAsBase64(uploadFile);
      const payload = await apiPostJson<UploadAnalysisResponse>("/api/intelligence/tools/metadata-upload", {
        filename: uploadFile.name,
        mimeType: uploadFile.type || "application/octet-stream",
        size: uploadFile.size,
        base64,
      });
      setUploadResult(payload?.result || payload);
      const event = {
        at: Date.now(),
        type: "evidence_upload",
        detail: `Uploaded evidence analyzed: ${uploadFile.name}`,
      };
      setEvents((prev) => [event, ...prev].slice(0, 50));
    } catch (error: any) {
      setUploadError(error?.message || "Upload analysis failed. Try again.");
    } finally {
      setUploadBusy(false);
    }
  };

  const loadCases = useCallback(async () => {
    try {
      const payload = await apiGetJson<{ cases: any[] }>("/api/osint/cases?limit=40");
      setCases(payload.cases || []);
    } catch {
      setCases([]);
    }
  }, []);

  const loadWatchlists = useCallback(async () => {
    try {
      const payload = await apiGetJson<{ watchlists: any[] }>("/api/osint/watchlists");
      setWatchlists(payload.watchlists || []);
    } catch {
      setWatchlists([]);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const payload = await apiGetJson<{ alerts: any[] }>("/api/osint/alerts?limit=40");
      setAlerts(payload.alerts || []);
    } catch {
      setAlerts([]);
    }
  }, []);

  const loadPyRecommendations = useCallback(async () => {
    if (!getStoredAccessToken()) {
      setPyRecommendations(null);
      setPyRecError("");
      return;
    }
    setPyRecLoading(true);
    setPyRecError("");
    try {
      const payload = await pyGetJson<PyRecommendationResponse>("/recommendations");
      setPyRecommendations(payload);
    } catch (error) {
      setPyRecommendations(null);
      setPyRecError(getPyApiUserMessage(error, "Live recommendations are temporarily unavailable."));
    } finally {
      setPyRecLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders().catch(() => undefined);
    loadCases().catch(() => undefined);
    loadWatchlists().catch(() => undefined);
    loadAlerts().catch(() => undefined);
    loadPyRecommendations().catch(() => undefined);
  }, [loadProviders, loadCases, loadWatchlists, loadAlerts, loadPyRecommendations]);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token || typeof window === "undefined" || typeof EventSource === "undefined") return;
    const stream = new EventSource(`/pyapi/recommendations/stream?access_token=${encodeURIComponent(token)}`, { withCredentials: true });
    const handleEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as PyRecommendationResponse;
        setPyRecommendations(payload);
        setPyRecError("");
      } catch {
        // ignore malformed payloads
      }
    };
    stream.addEventListener("recommendations", handleEvent as EventListener);
    stream.onmessage = handleEvent;
    stream.onerror = () => {
      setPyRecError("Live recommendations stream disconnected. The latest saved guidance is still available.");
      stream.close();
    };
    return () => stream.close();
  }, []);

  const selectCase = async (id: string) => {
    try {
      const payload = await apiGetJson<{ case: any }>(`/api/osint/cases/${id}`);
      const row = payload.case;
      setActiveCaseId(row?._id || id);
      setCaseTitle(row?.title || "");
      setCaseSummary(row?.summary || "");
      setCaseNotes(row?.notes || "");
      setCaseFolder(row?.folder || "");
      setCaseTags(row?.tags || []);
      setEntities(row?.entities || []);
      setEvents(row?.events ? [...row.events].reverse() : []);
      setResult(row?.results || null);
      setQuery(row?.target || "");
      setModules(row?.modules || modules);
    } catch (error: any) {
      toast({ title: "Failed to load case", description: error?.message || "Try again." });
    }
  };

  const saveCase = async () => {
    if (!query.trim()) {
      toast({ title: "Add a target before saving." });
      return;
    }
    try {
      const payload = await apiPostJson<{ case: any }>("/api/osint/cases", {
        title: caseTitle || `OSINT - ${query.trim()}`,
        target: query.trim(),
        summary: caseSummary,
        notes: caseNotes,
        folder: caseFolder,
        tags: caseTags,
        entities,
        modules,
        results: result,
      });
      setActiveCaseId(payload.case?._id || null);
      setShareUrl(null);
      loadCases();
      toast({ title: "Case saved." });
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Try again." });
    }
  };

  const updateCase = async () => {
    if (!activeCaseId) return;
    try {
      const response = await apiFetch(`/api/osint/cases/${activeCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: caseTitle,
          summary: caseSummary,
          notes: caseNotes,
          folder: caseFolder,
          tags: caseTags,
          entities,
        }),
      });
      if (!response.ok) throw new Error("Update failed.");
      loadCases();
      toast({ title: "Case updated." });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Try again." });
    }
  };

  const generateShare = async () => {
    if (!activeCaseId) return;
    try {
      const payload = await apiPostJson<{ shareUrl: string }>(`/api/osint/cases/${activeCaseId}/share`, {});
      setShareUrl(payload.shareUrl);
      toast({ title: "Share link generated." });
    } catch (error: any) {
      toast({ title: "Share failed", description: error?.message || "Sharing disabled." });
    }
  };

  const exportCase = () => {
    const payload = {
      title: caseTitle,
      target: query,
      summary: caseSummary,
      notes: caseNotes,
      folder: caseFolder,
      tags: caseTags,
      entities,
      modules,
      result,
      events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `osint-${query || "case"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadExport = async (format: "csv" | "pdf") => {
    if (!activeCaseId) {
      toast({ title: "Save the case before exporting." });
      return;
    }
    const response = await apiFetch(`/api/osint/cases/${activeCaseId}/export.${format}`);
    if (!response.ok) {
      toast({ title: `Export ${format.toUpperCase()} failed.` });
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `osint-${activeCaseId}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (!result?.results) return null;
    return Object.entries(result.results).map(([key, value]: any) => ({
      id: key,
      status: value?.status || "unknown",
      provider: value?.provider || "unknown",
    }));
  }, [result]);

  const graphNodes = useMemo(() => {
    const base = [{ id: "target", label: query || "Target", type: "core" }];
    const entityNodes = entities.map((entity, index) => ({ id: `entity-${index}`, label: entity, type: "entity" }));
    const moduleNodes = modules.map((module) => ({ id: `module-${module}`, label: module.toUpperCase(), type: "module" }));
    return [...base, ...entityNodes, ...moduleNodes];
  }, [entities, modules, query]);

  const graphLayout = useMemo(() => {
    const radius = 120;
    const center = { x: 180, y: 160 };
    const nodes = graphNodes.map((node, index) => {
      if (node.type === "core") return { ...node, x: center.x, y: center.y };
      const angle = (index / Math.max(2, graphNodes.length)) * Math.PI * 2;
      return {
        ...node,
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
    return nodes;
  }, [graphNodes]);

  const riskScore = result?.insight?.score ?? null;
  const riskLevel = result?.insight?.level ?? "unknown";

  return (
    <div className="page-shell">
      <section className="relative overflow-hidden">
        {verificationBanner ? (
          <div className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/80">
            <span>{verificationBanner}</span>
            <a href="/auth" className="rounded-full border border-amber-300/40 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-400/20">
              Manage auth
            </a>
          </div>
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.16),transparent_45%),radial-gradient(circle_at_85%_22%,rgba(251,191,36,0.12),transparent_40%)]" />
        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-12 pt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.3em] text-slate-200/80">
            OSINT COMMAND CENTER
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">
            World-Class OSINT Platform, <span className="brand-gradient-text">built into your site.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200/80 md:text-lg">
            Investigate domains, IPs, emails, and usernames with curated integrations across WHOIS, DNS, breach data,
            geolocation, social signals, and live threat news.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Risk Score</div>
              <div className="mt-2 text-3xl font-black text-white">{riskScore ?? "--"}</div>
              <div className="text-xs text-slate-300">Level: {riskLevel}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Active Watchlists</div>
              <div className="mt-2 text-3xl font-black text-white">{watchlists.filter((w) => w.active).length}</div>
              <div className="text-xs text-slate-300">Scheduled monitors</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Recent Alerts</div>
              <div className="mt-2 text-3xl font-black text-white">{alerts.length}</div>
              <div className="text-xs text-slate-300">Signals detected</div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:grid-cols-[1.5fr_1fr_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter domain, IP, email, or username"
              className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 text-sm text-white shadow-inner shadow-black/40 focus:border-cyan-300/50 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              {MODULES.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => toggleModule(module.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    modules.includes(module.id)
                      ? "bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-300/40"
                      : "bg-white/5 text-slate-300 ring-1 ring-white/10"
                  }`}
                >
                  {module.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={runOsint}
              className="h-12 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-amber-300 px-6 text-sm font-bold text-slate-950 shadow-[0_20px_40px_rgba(56,189,248,0.25)] transition hover:scale-[1.02]"
            >
              {loading ? "Running..." : "Run Investigation"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <input
                type="checkbox"
                checked={includeCertHistory}
                onChange={(event) => setIncludeCertHistory(event.target.checked)}
              />
              Include certificate history
            </label>
            {result?.meta?.durationMs ? <span>Last run: {result.meta.durationMs}ms</span> : null}
          </div>

          <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-400/5 px-4 py-3 text-xs text-amber-100/80">
            Use only on assets you own or are authorized to test. We log requests and enforce safe OSINT usage policies.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-[0_30px_60px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Investigation Summary</h2>
                  <p className="text-xs text-slate-400">Coverage across all enabled OSINT modules.</p>
                </div>
                <button
                  type="button"
                  onClick={loadProviders}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-300/40"
                >
                  Refresh Providers
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(summary || MODULES.map((module) => ({ id: module.id, status: "idle", provider: "pending" }))).map(
                  (item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300"
                    >
                      <div className="flex items-center justify-between text-sm font-semibold text-white">
                        <span className="uppercase tracking-wide">{item.id}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            item.status === "ok"
                              ? "bg-emerald-400/20 text-emerald-200"
                              : item.status === "error"
                                ? "bg-rose-400/20 text-rose-200"
                                : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">Provider: {item.provider}</p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Threat Intelligence</h2>
                  <p className="text-xs text-slate-400">Automated risk score and recommendations.</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                  {riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Highlights</div>
                  <ul className="mt-3 space-y-2 text-xs text-slate-200/80">
                    {(result?.insight?.highlights || ["Run a scan to generate highlights."]).map(
                      (item: string, index: number) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Recommendations</div>
                  <ul className="mt-3 space-y-2 text-xs text-slate-200/80">
                    {(result?.insight?.recommendations || ["Run a scan to generate recommendations."]).map(
                      (item: string, index: number) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {MODULES.map((module) => (
                <div key={module.id} className="glass-card rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white">{module.label}</h3>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400">
                      {result?.results?.[module.id]?.status || "idle"}
                    </span>
                  </div>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-[11px] text-slate-200/80">
                    {formatValue(result?.results?.[module.id]?.data)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Live Recommendations</h3>
                  <p className="text-xs text-slate-400">Guided recommendations from verified activity.</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadPyRecommendations().catch(() => undefined)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-300/40"
                  disabled={pyRecLoading}
                >
                  {pyRecLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              {pyRecError ? <p className="mt-2 text-xs text-rose-300">{pyRecError}</p> : null}
              <div className="mt-3 space-y-2 text-xs text-slate-200/80">
                {pyRecommendations?.recommendations?.length ? (
                  pyRecommendations.recommendations.map((item) => (
                    <div key={`${item.title}-${item.action}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <div className="text-[11px] text-slate-300">{item.reason}</div>
                      <div className="text-[11px] text-cyan-200/80">Action: {item.action}</div>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400">
                    {pyRecLoading ? "Streaming live recommendations..." : "Recommendations appear after verified activity."}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Investigation Graph</h3>
              <p className="text-xs text-slate-400">Entities and OSINT modules linked to the target.</p>
              <div className="mt-4 flex justify-center rounded-xl border border-white/10 bg-black/30 p-4">
                <svg width="360" height="320" role="img">
                  {graphLayout.map((node) => (
                    node.type !== "core" ? (
                      <line
                        key={`line-${node.id}`}
                        x1={graphLayout[0]?.x}
                        y1={graphLayout[0]?.y}
                        x2={node.x}
                        y2={node.y}
                        stroke="rgba(148,163,184,0.35)"
                        strokeWidth="1"
                      />
                    ) : null
                  ))}
                  {graphLayout.map((node) => (
                    <g key={node.id}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.type === "core" ? 18 : 12}
                        fill={node.type === "core" ? "rgba(56,189,248,0.7)" : "rgba(15,23,42,0.9)"}
                        stroke="rgba(148,163,184,0.6)"
                      />
                      <text
                        x={node.x}
                        y={node.y + 28}
                        textAnchor="middle"
                        fontSize="10"
                        fill="rgba(226,232,240,0.9)"
                      >
                        {node.label.slice(0, 18)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">OSINT Playbooks</h3>
              <p className="text-xs text-slate-400">Guided investigation paths for common scenarios.</p>
              <div className="mt-3 space-y-3 text-xs text-slate-200/80">
                {[
                  {
                    title: "Breach Impact Triage",
                    modules: ["breach", "whois", "dns", "geoip"],
                    desc: "Assess leaked identities and validate asset ownership.",
                  },
                  {
                    title: "Infrastructure Recon",
                    modules: ["dns", "rdns", "asn", "tls"],
                    desc: "Map network exposure and certificate history.",
                  },
                  {
                    title: "Brand Impersonation Sweep",
                    modules: ["whois", "tls", "news", "social"],
                    desc: "Check for spoof domains and reputation signals.",
                  },
                ].map((playbook) => (
                  <div key={playbook.title} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm font-semibold text-white">{playbook.title}</div>
                    <div className="text-[11px] text-slate-400">{playbook.desc}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {playbook.modules.map((module) => (
                        <span key={module} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px]">
                          {module.toUpperCase()}
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setModules(playbook.modules as ModuleId[])}
                        className="ml-auto rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200 hover:border-cyan-300/40"
                      >
                        Use Playbook
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Live Provider Status</h3>
              <p className="text-xs text-slate-400">Configured connectors and coverage readiness.</p>
              <div className="mt-4 space-y-2 text-xs text-slate-200/80">
                {providers
                  ? Object.entries(providers).map(([key, value]: any) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <span className="uppercase tracking-wide">{key}</span>
                      <span className="text-[11px] text-slate-400">
                        {value?.configured ? "configured" : "needs key"} . {value?.provider}
                      </span>
                    </div>
                  ))
                  : "Run refresh to see connector status."}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Watchlists</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-200/80">
                <input
                  value={watchLabel}
                  onChange={(event) => setWatchLabel(event.target.value)}
                  placeholder="Watchlist label"
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                />
                <input
                  value={watchTarget}
                  onChange={(event) => setWatchTarget(event.target.value)}
                  placeholder="Target domain, IP, email, username"
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={watchInterval}
                    onChange={(event) => setWatchInterval(Number(event.target.value))}
                    className="h-10 w-24 rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                  />
                  <span className="text-[11px] text-slate-400">minutes</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!watchTarget.trim()) {
                        toast({ title: "Add a watchlist target first." });
                        return;
                      }
                      try {
                        await apiPostJson("/api/osint/watchlists", {
                          label: watchLabel || watchTarget,
                          target: watchTarget,
                          intervalMinutes: watchInterval,
                          modules,
                          rules: {
                            minRiskScore: ruleMinRiskScore,
                            breachThreshold: ruleBreachThreshold,
                            alertOnNoDns: ruleAlertNoDns,
                            alertOnMissingTls: ruleAlertMissingTls,
                          },
                          routing: {
                            minSeverity: routingMinSeverity,
                            email: routingEmail,
                            webhook: routingWebhook,
                            slack: routingSlack,
                            mode: routingMode,
                            severityMap:
                              routingMode === "severity"
                                ? {
                                    low: routingLow,
                                    medium: routingMedium,
                                    high: routingHigh,
                                  }
                                : undefined,
                          },
                        });
                        setWatchLabel("");
                        setWatchTarget("");
                        loadWatchlists();
                      } catch (error: any) {
                        toast({ title: "Watchlist failed", description: error?.message || "Try again." });
                      }
                    }}
                    className="ml-auto rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/20"
                  >
                    Add Watchlist
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="text-[11px] text-slate-400">Min Risk Score</div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={ruleMinRiskScore}
                      onChange={(event) => setRuleMinRiskScore(Number(event.target.value))}
                      className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                    />
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="text-[11px] text-slate-400">Breach Threshold</div>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={ruleBreachThreshold}
                      onChange={(event) => setRuleBreachThreshold(Number(event.target.value))}
                      className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={ruleAlertNoDns}
                      onChange={(event) => setRuleAlertNoDns(event.target.checked)}
                    />
                    Alert if DNS missing
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px]">
                    <input
                      type="checkbox"
                      checked={ruleAlertMissingTls}
                      onChange={(event) => setRuleAlertMissingTls(event.target.checked)}
                    />
                    Alert if TLS missing
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="text-[11px] text-slate-400">Min Severity</div>
                    <select
                      value={routingMinSeverity}
                      onChange={(event) => setRoutingMinSeverity(event.target.value as "low" | "medium" | "high")}
                      className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                    >
                      <option value="low">Low+</option>
                      <option value="medium">Medium+</option>
                      <option value="high">High only</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="text-[11px] text-slate-400">Routing</div>
                    <select
                      value={routingMode}
                      onChange={(event) => setRoutingMode(event.target.value as "all" | "severity")}
                      className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                    >
                      <option value="all">All channels</option>
                      <option value="severity">Severity based</option>
                    </select>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={routingEmail}
                          onChange={(event) => setRoutingEmail(event.target.checked)}
                        />
                        Email
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={routingWebhook}
                          onChange={(event) => setRoutingWebhook(event.target.checked)}
                        />
                        Webhook
                      </label>
                      <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px]">
                        <input
                          type="checkbox"
                          checked={routingSlack}
                          onChange={(event) => setRoutingSlack(event.target.checked)}
                        />
                        Slack
                      </label>
                    </div>
                  </div>
                </div>
                {routingMode === "severity" ? (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                    <div className="text-[11px] text-slate-400">Per-Severity Routes</div>
                    {[
                      { label: "Low", value: routingLow, setter: setRoutingLow },
                      { label: "Medium", value: routingMedium, setter: setRoutingMedium },
                      { label: "High", value: routingHigh, setter: setRoutingHigh },
                    ].map((row) => (
                      <div key={row.label} className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="w-16 text-slate-300">{row.label}</span>
                        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <input
                            type="checkbox"
                            checked={row.value.email}
                            onChange={(event) => row.setter({ ...row.value, email: event.target.checked })}
                          />
                          Email
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <input
                            type="checkbox"
                            checked={row.value.webhook}
                            onChange={(event) => row.setter({ ...row.value, webhook: event.target.checked })}
                          />
                          Webhook
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          <input
                            type="checkbox"
                            checked={row.value.slack}
                            onChange={(event) => row.setter({ ...row.value, slack: event.target.checked })}
                          />
                          Slack
                        </label>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 space-y-2">
                  {watchlists.length ? (
                    watchlists.map((watch) => (
                      <div key={watch._id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex items-center justify-between text-sm text-white">
                          <span>{watch.label}</span>
                          <span className="text-[11px] text-slate-400">{watch.intervalMinutes}m</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{watch.target}</div>
                        <div className="text-[10px] text-slate-500">
                          Rules: score {" >= "} {watch.rules?.minRiskScore ?? 70}, breach {" >= "} {watch.rules?.breachThreshold ?? 1}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Routing: {watch.routing?.minSeverity || "medium"}+ . Mode: {watch.routing?.mode || "all"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await apiPostJson(`/api/osint/watchlists/${watch._id}/run`, {});
                              loadAlerts();
                            }}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200 hover:border-cyan-300/40"
                          >
                            Run Now
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/osint/watchlists/${watch._id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  rules: {
                                    minRiskScore: ruleMinRiskScore,
                                    breachThreshold: ruleBreachThreshold,
                                    alertOnNoDns: ruleAlertNoDns,
                                    alertOnMissingTls: ruleAlertMissingTls,
                                  },
                                  routing: {
                                    minSeverity: routingMinSeverity,
                                    email: routingEmail,
                                    webhook: routingWebhook,
                                    slack: routingSlack,
                                    mode: routingMode,
                                    severityMap:
                                      routingMode === "severity"
                                        ? {
                                            low: routingLow,
                                            medium: routingMedium,
                                            high: routingHigh,
                                          }
                                        : undefined,
                                  },
                                }),
                              });
                              loadWatchlists();
                            }}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200 hover:border-emerald-300/40"
                          >
                            Apply Rules
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/osint/watchlists/${watch._id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ active: !watch.active }),
                              });
                              loadWatchlists();
                            }}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200 hover:border-amber-300/40"
                          >
                            {watch.active ? "Pause" : "Resume"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/osint/watchlists/${watch._id}`, { method: "DELETE" });
                              loadWatchlists();
                            }}
                            className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200 hover:border-rose-300/40"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400">No watchlists yet.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Alert Feed</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-200/80">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <div key={alert._id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between text-sm text-white">
                        <span>{alert.title}</span>
                        <span className="text-[11px] text-slate-400">{alert.severity}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">{alert.message}</div>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400">No alerts yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Case Management</h3>
              <div className="mt-3 space-y-3 text-xs text-slate-200/80">
                <input
                  value={caseTitle}
                  onChange={(event) => setCaseTitle(event.target.value)}
                  placeholder="Case title"
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                />
                <textarea
                  value={caseSummary}
                  onChange={(event) => setCaseSummary(event.target.value)}
                  placeholder="Executive summary"
                  className="min-h-[80px] w-full rounded-lg border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-200"
                />
                <input
                  value={caseFolder}
                  onChange={(event) => setCaseFolder(event.target.value)}
                  placeholder="Folder (e.g., Brand Monitoring)"
                  className="h-10 w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                />
                <div className="flex gap-2">
                  <input
                    value={caseTagInput}
                    onChange={(event) => setCaseTagInput(event.target.value)}
                    placeholder="Add tag"
                    className="h-10 flex-1 rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!caseTagInput.trim()) return;
                      setCaseTags((prev) => [...prev, caseTagInput.trim()]);
                      setCaseTagInput("");
                    }}
                    className="h-10 rounded-lg bg-white/10 px-3 text-xs text-slate-100 hover:bg-white/20"
                  >
                    Add Tag
                  </button>
                </div>
                {caseTags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {caseTags.map((tag, index) => (
                      <span
                        key={`${tag}-${index}`}
                        className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveCase}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs text-slate-100 hover:bg-white/20"
                  >
                    Save Case
                  </button>
                  <button
                    type="button"
                    onClick={updateCase}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-cyan-300/40"
                  >
                    Update Case
                  </button>
                  <button
                    type="button"
                    onClick={exportCase}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-amber-300/40"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExport("csv")}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-amber-300/40"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadExport("pdf")}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-amber-300/40"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={generateShare}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-emerald-300/40"
                  >
                    Share
                  </button>
                </div>
                {shareUrl ? (
                  <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                    Share URL: {shareUrl}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Case Notes</h3>
              <textarea
                value={caseNotes}
                onChange={(event) => setCaseNotes(event.target.value)}
                placeholder="Log findings, hypotheses, and next steps."
                className="mt-3 min-h-[140px] w-full rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-200"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Evidence Upload (AI)</h3>
              <p className="mt-1 text-xs text-slate-400">Analyze documents and artifacts for metadata, hashes, and indicators.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setUploadFile(file);
                    setUploadResult(null);
                    setUploadError("");
                  }}
                  className="text-xs text-slate-200"
                />
                <button
                  type="button"
                  onClick={analyzeUpload}
                  disabled={uploadBusy || !uploadFile}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-cyan-300/40 disabled:opacity-60"
                >
                  {uploadBusy ? "Analyzing..." : "Analyze Upload"}
                </button>
              </div>
              {uploadError ? <p className="mt-2 text-xs text-rose-300">{uploadError}</p> : null}
              {uploadResult ? (
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-slate-200">
                  {JSON.stringify(uploadResult, null, 2)}
                </pre>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Entity Tracker</h3>
              <div className="mt-3 flex gap-2">
                <input
                  value={entityInput}
                  onChange={(event) => setEntityInput(event.target.value)}
                  placeholder="Add IP, domain, account..."
                  className="h-10 flex-1 rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!entityInput.trim()) return;
                    setEntities((prev) => [...prev, entityInput.trim()]);
                    setEntityInput("");
                  }}
                  className="h-10 rounded-lg bg-white/10 px-3 text-xs text-slate-100 hover:bg-white/20"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-200/80">
                {entities.length ? (
                  entities.map((entity, index) => (
                    <div key={`${entity}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      {entity}
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400">No entities yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Timeline</h3>
              <div className="mt-3 space-y-3 text-xs text-slate-300">
                {events.length ? (
                  events.slice(0, 12).map((event, index) => (
                    <div key={`${event.type}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-[11px] text-slate-400">
                        {new Date(event.at || Date.now()).toLocaleString()}
                      </div>
                      <div className="text-sm text-white">{event.detail || event.type}</div>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400">No events yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h3 className="text-base font-semibold text-white">Cases</h3>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                {cases.length ? (
                  cases.map((row) => (
                    <button
                      key={row._id}
                      type="button"
                      onClick={() => selectCase(row._id)}
                      className={`w-full rounded-lg border border-white/10 px-3 py-2 text-left transition ${
                        activeCaseId === row._id ? "bg-cyan-500/10 text-cyan-100" : "bg-white/5 text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-sm font-semibold">{row.title}</div>
                      <div className="text-[11px] text-slate-400">{row.target}</div>
                      {row.folder ? <div className="text-[10px] text-slate-500">Folder: {row.folder}</div> : null}
                      {Array.isArray(row.tags) && row.tags.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.tags.slice(0, 4).map((tag: string) => (
                            <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-slate-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400">No saved cases yet.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default OsintPage;
