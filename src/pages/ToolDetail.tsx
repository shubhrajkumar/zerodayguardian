import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  Clock,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { apiFetch, apiGetJson, apiPostJson } from "@/lib/apiClient";
import { sanitize } from "@/utils/sanitize";
import {
  getToolsCatalog,
  getToolById,
  getToolIcon,
  relatedToolsFor,
  type ToolDefinition,
} from "@/lib/toolCatalog";
import NotFound from "./NotFound";

type PromptRec = { promptId: string; prompt: string; nextStep: string; intent: string; relevance: number };
type DorkTemplate = { name: string; template: string; explanation: string; defensiveAdvice: string };
type HeaderResult = {
  url?: string;
  statusCode?: number;
  riskScore: number;
  missing?: string[];
  recommendations?: string[];
  rating?: string;
  findings: Array<{ key: string; ok: boolean }>;
};
type ResourceVault = {
  resources?: Array<{ title: string; source: string; kind?: string; usage?: string }>;
};
type WebScanResult = {
  target: { input: string; normalizedUrl: string; hostname: string; protocol: string; isIp: boolean };
  responseTimeMs: number | null;
  httpResponseTimeMs: number | null;
  httpStatus: number | null;
  httpsStatus: number | null;
  httpsEnforced: boolean;
  redirectTarget: string | null;
  sslStatus: string;
  ssl: {
    enabled: boolean;
    authorized: boolean;
    authorizationError: string | null;
    validFrom: string | null;
    validTo: string | null;
    daysRemaining: number | null;
    subject: string | null;
    issuer: string | null;
    selfSigned: boolean | null;
  };
  headers: {
    server: string;
    poweredBy: string;
    contentType: string;
    contentLength: string;
    hsts: string | null;
    csp: string | null;
    xFrameOptions: string | null;
    xContentTypeOptions: string | null;
    referrerPolicy: string | null;
    permissionsPolicy: string | null;
  };
  missingHeaders?: string[];
  domain: { hostname: string; ipv4: string[]; ipv6: string[]; cname: string[] };
  openPorts?: Array<{ port: number; status: string }>;
  technologies: string[];
  riskScore?: number;
  riskLevel?: string;
  notes?: string | null;
};

type WebScanHistoryItem = {
  id: string;
  timestamp: string;
  target: string;
  grade: string;
  score: number;
  httpsEnforced: boolean;
  sslStatus: string;
};

const normalizeDomainInput = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const normalizeUrlInput = (value: string) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const formatMs = (value?: number | null) => (value && value > 0 ? `${Math.round(value)} ms` : "n/a");

const formatList = (value?: string[] | null) => (value && value.length ? value.join(", ") : "n/a");

const formatDate = (value?: string | null) => {
  if (!value) return "n/a";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "n/a";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const scoreFromChecks = (items: Array<{ ok: boolean }> = []) => {
  if (!items.length) return { score: 0, grade: "F" as const };
  const passed = items.filter((item) => item.ok).length;
  const score = Math.round((passed / items.length) * 100);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";
  return { score, grade };
};

const sendToolPromptToZorvix = (tool: ToolDefinition, prompt = "") => {
  window.dispatchEvent(
    new CustomEvent("neurobot:topic", {
      detail: {
        id: `tool-${tool.id}`,
        title: tool.name,
        query: prompt || tool.prompt || `Guide me through ${tool.name} with practical defensive steps.`,
        tags: [tool.category, tool.group, ...(tool.tags || [])],
      },
    })
  );
};

const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore clipboard errors
  }
};

const workspaceTrustMeta = (tool: ToolDefinition) => {
  if (tool.workspace === "lab" || tool.workspace === "learning") {
    return {
      label: "Demo Learning Flow",
      headline: "Practice stays separate from live security operations.",
      detail: "Use this workspace for guided learning, checkpoints, and skill-building. Verified live scans and operator evidence stay in the live tool workspaces.",
    };
  }
  return {
    label: "Verified Live Workspace",
    headline: "Use verified data and trusted operator review only.",
    detail: "This workspace is intended for real DNS, MX, WHOIS, headers, website scans, and evidence-based AI analysis. If signals are weak, the product should fall back to No verified data.",
  };
};

const WorkspaceShell = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section className="rounded-[28px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(8,13,25,0.98),rgba(5,8,18,0.98))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-6">
    <div className="mb-5 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Dedicated Workspace</p>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <p className="max-w-3xl text-sm leading-6 text-slate-300/78">{description}</p>
    </div>
    {children}
  </section>
);

const ResearchWorkspace = ({ tool }: { tool: ToolDefinition }) => {
  const [query, setQuery] = useState(tool.prompt || "");
  const [result, setResult] = useState<PromptRec | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (regenerate = false) => {
    setLoading(true);
    try {
      const payload = await apiGetJson<{ recommendation: PromptRec }>(
        `/api/intelligence/prompts/recommendation?q=${encodeURIComponent(query)}&regenerate=${regenerate}`
      );
      setResult(payload.recommendation || null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    run(false).catch(() => undefined);
  }, [run]);

  return (
    <WorkspaceShell title={tool.name} description={tool.detail}>
      <div className="grid gap-4">
        <textarea
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-36 w-full rounded-2xl border border-cyan-300/15 bg-black/25 px-4 py-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/35"
          placeholder="Describe the research goal, target, or topic you want to investigate."
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => run(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Generate Brief
          </button>
          <button
            type="button"
            onClick={() => sendToolPromptToZorvix(tool, result?.prompt || query)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
          >
            <BrainCircuit className="h-4 w-4 text-cyan-200" />
            Send to ZORVIX
          </button>
          <button
            type="button"
            onClick={() => copyText(result?.prompt || query)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
          >
            <Copy className="h-4 w-4" />
            Copy Prompt
          </button>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
          {result ? (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Recommended Prompt</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-100">{result.prompt}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Next Step</p>
                  <p className="mt-2 text-sm text-slate-200">{result.nextStep}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Intent</p>
                  <p className="mt-2 text-sm text-slate-200">{result.intent}</p>
                  <p className="mt-2 text-xs text-slate-400">Relevance: {Math.round((result.relevance || 0) * 100)}%</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Generate a structured brief to start this workspace.</p>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
};

const KnowledgeWorkspace = ({ tool }: { tool: ToolDefinition }) => {
  const [query, setQuery] = useState("");
  const [resources, setResources] = useState<ResourceVault["resources"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetJson<ResourceVault>("/api/intelligence/resources")
      .then((payload) => setResources(payload.resources || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return resources || [];
    return (resources || []).filter((resource) =>
      [resource.title, resource.source, resource.kind, resource.usage].join(" ").toLowerCase().includes(needle)
    );
  }, [query, resources]);

  return (
    <WorkspaceShell title={tool.name} description={tool.detail}>
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/55" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter knowledge resources by title, source, or use case"
            className="h-12 w-full rounded-2xl border border-cyan-300/15 bg-black/25 pl-12 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/35"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(loading ? [] : filtered.slice(0, 8)).map((resource) => (
            <article key={`${resource.source}-${resource.title}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{resource.source}</p>
              <h3 className="mt-2 text-base font-medium text-slate-100">{resource.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300/78">{resource.usage}</p>
              {resource.kind ? <p className="mt-3 text-xs text-cyan-100/70">Kind: {resource.kind}</p> : null}
            </article>
          ))}
        </div>
        {!loading && !filtered.length ? <p className="text-sm text-slate-400">No resources matched this search.</p> : null}
        {loading ? <p className="text-sm text-slate-400">Loading curated resources...</p> : null}
      </div>
    </WorkspaceShell>
  );
};

const DorkWorkspace = ({ tool }: { tool: ToolDefinition }) => {
  const [target, setTarget] = useState("example.com");
  const [category, setCategory] = useState("File exposure");
  const [templates, setTemplates] = useState<DorkTemplate[]>([]);
  const [result, setResult] = useState<{ query: string; explanation: string; defensiveAdvice?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiGetJson<{ templates: DorkTemplate[] }>("/api/intelligence/tools/dork/templates")
      .then((payload) => setTemplates(payload.templates || []))
      .catch(() => setTemplates([]));
  }, []);

  const run = async () => {
    setLoading(true);
    try {
      const payload = await apiPostJson<{ result: { query: string; explanation: string; defensiveAdvice?: string } }>(
        "/api/intelligence/tools/dork",
        {
          target: normalizeDomainInput(target),
          category,
        }
      );
      setResult(payload.result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorkspaceShell title={tool.name} description={tool.detail}>
      <div className="grid gap-4">
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="h-12 rounded-2xl border border-cyan-300/15 bg-black/25 px-4 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-300/35"
          placeholder="Authorized domain target"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-12 rounded-2xl border border-cyan-300/15 bg-black/25 px-4 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-300/35"
        >
          {(templates.length ? templates.map((item) => item.name) : ["File exposure", "Login pages", "Directory listing"]).map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Generate Query
          </button>
          <button
            type="button"
            onClick={() => sendToolPromptToZorvix(tool)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
          >
            <BrainCircuit className="h-4 w-4 text-cyan-200" />
            Ask ZORVIX
          </button>
        </div>
        {result ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Generated Query</p>
            <code className="mt-3 block break-all rounded-2xl border border-cyan-300/10 bg-black/25 px-4 py-3 text-sm text-cyan-100">
              {result.query}
            </code>
            <p className="mt-4 text-sm leading-6 text-slate-300/82">{result.explanation}</p>
            {result.defensiveAdvice ? <p className="mt-3 text-sm text-cyan-100/75">Defensive advice: {result.defensiveAdvice}</p> : null}
          </div>
        ) : null}
      </div>
    </WorkspaceShell>
  );
};

const DomainWorkspace = ({ tool }: { tool: ToolDefinition }) => {
  const [target, setTarget] = useState("https://example.com");
  const [headerResult, setHeaderResult] = useState<HeaderResult | null>(null);
  const [busy, setBusy] = useState<"" | "headers">("");

  const runHeaders = async () => {
    setBusy("headers");
    try {
      const payload = await apiPostJson<{ result: HeaderResult }>("/api/intelligence/tools/headers-url", {
        url: normalizeUrlInput(target),
      });
      setHeaderResult(payload.result);
    } finally {
      setBusy("");
    }
  };

  return (
    <WorkspaceShell title={tool.name} description={tool.detail}>
      <div className="grid gap-4">
        <input
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="h-12 rounded-2xl border border-cyan-300/15 bg-black/25 px-4 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-300/35"
          placeholder="https://target.example"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runHeaders}
            disabled={busy.length > 0}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14 disabled:opacity-60"
          >
            {busy === "headers" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Analyze Headers
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Header Analysis</p>
            {headerResult ? (
              <div className="mt-4 space-y-3 text-sm text-slate-300/82">
                <p>Target: {headerResult.url}</p>
                <p>Status: {headerResult.statusCode}</p>
                <p>Risk score: {headerResult.riskScore}/100</p>
                <p>Rating: {headerResult.rating || "N/A"}</p>
                <ul className="space-y-1 text-sm">
                  {headerResult.findings.map((item) => (
                    <li key={item.key}>- {item.ok ? "Pass" : "Missing"}: {item.key}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Run a secure proxy check to inspect exposed response headers.</p>
            )}
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Surface Review</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300/82">
              <p>Verified exposure review is limited to live DNS, headers, TLS, and website scan evidence.</p>
              <p className="text-slate-400">Unverified subdomain discovery has been removed from this workspace.</p>
              <p className="text-cyan-100/75">Use the web scan and OSINT modules for verified signals only.</p>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
};

const WebScanWorkspace = ({ tool }: { tool: ToolDefinition }) => {
  const [url, setUrl] = useState("example.com");
  const [result, setResult] = useState<WebScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [lastScanAt, setLastScanAt] = useState<string>("");
  const [history, setHistory] = useState<WebScanHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem("webscan:history");
      return raw ? (JSON.parse(raw) as WebScanHistoryItem[]) : [];
    } catch {
      return [];
    }
  });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [reportTemplate, setReportTemplate] = useState<"classic" | "dark" | "neon">("neon");
  const [reportBrandName, setReportBrandName] = useState("ZeroDay Guardian");
  const [reportTagline, setReportTagline] = useState("Security posture snapshot");

  const runScan = async () => {
    const target = String(url || "").trim();
    if (!target) return;
    setLoading(true);
    setError("");
    setReportError("");
    try {
      const payload = await apiPostJson<{ result: WebScanResult }>("/api/intelligence/tools/webscan", {
        url: target,
      });
      setResult(payload.result);
      setLastScanAt(new Date().toISOString());
      const next = {
        id: `${Date.now()}-${payload.result.target.hostname}`,
        timestamp: new Date().toISOString(),
        target: payload.result.target.normalizedUrl,
        grade: scoreFromChecks([
          { ok: payload.result.httpsEnforced },
          { ok: payload.result.ssl?.enabled && payload.result.ssl?.authorized },
          { ok: !!payload.result.headers?.hsts },
          { ok: !!payload.result.headers?.csp },
          { ok: !!payload.result.headers?.xFrameOptions },
          { ok: !!payload.result.headers?.xContentTypeOptions },
          { ok: !!payload.result.headers?.referrerPolicy },
          { ok: !!payload.result.headers?.permissionsPolicy },
        ]).grade,
        score: scoreFromChecks([
          { ok: payload.result.httpsEnforced },
          { ok: payload.result.ssl?.enabled && payload.result.ssl?.authorized },
          { ok: !!payload.result.headers?.hsts },
          { ok: !!payload.result.headers?.csp },
          { ok: !!payload.result.headers?.xFrameOptions },
          { ok: !!payload.result.headers?.xContentTypeOptions },
          { ok: !!payload.result.headers?.referrerPolicy },
          { ok: !!payload.result.headers?.permissionsPolicy },
        ]).score,
        httpsEnforced: payload.result.httpsEnforced,
        sslStatus: payload.result.sslStatus,
      } as WebScanHistoryItem;
      setHistory((prev) => {
        const updated = [next, ...prev].slice(0, 10);
        localStorage.setItem("webscan:history", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const checks = result
    ? [
        { label: "HTTPS enforced", ok: result.httpsEnforced, severity: result.httpsEnforced ? "low" : "high" },
        { label: "Valid SSL certificate", ok: result.ssl?.enabled && result.ssl?.authorized, severity: result.ssl?.authorized ? "low" : "high" },
        { label: "HSTS enabled", ok: !!result.headers?.hsts, severity: result.headers?.hsts ? "low" : "medium" },
        { label: "Content-Security-Policy", ok: !!result.headers?.csp, severity: result.headers?.csp ? "low" : "medium" },
        { label: "X-Frame-Options", ok: !!result.headers?.xFrameOptions, severity: result.headers?.xFrameOptions ? "low" : "low" },
        { label: "X-Content-Type-Options", ok: !!result.headers?.xContentTypeOptions, severity: result.headers?.xContentTypeOptions ? "low" : "low" },
        { label: "Referrer-Policy", ok: !!result.headers?.referrerPolicy, severity: result.headers?.referrerPolicy ? "low" : "low" },
        { label: "Permissions-Policy", ok: !!result.headers?.permissionsPolicy, severity: result.headers?.permissionsPolicy ? "low" : "low" },
      ]
    : [];
  const score = scoreFromChecks(checks);
  const headerChecks = result
    ? [
        { label: "HSTS", value: result.headers?.hsts ? "Enabled" : "Missing", ok: !!result.headers?.hsts },
        { label: "CSP", value: result.headers?.csp ? "Present" : "Missing", ok: !!result.headers?.csp },
        { label: "X-Frame-Options", value: result.headers?.xFrameOptions ? "Set" : "Missing", ok: !!result.headers?.xFrameOptions },
        { label: "X-Content-Type-Options", value: result.headers?.xContentTypeOptions ? "Set" : "Missing", ok: !!result.headers?.xContentTypeOptions },
        { label: "Referrer-Policy", value: result.headers?.referrerPolicy ? "Set" : "Missing", ok: !!result.headers?.referrerPolicy },
        { label: "Permissions-Policy", value: result.headers?.permissionsPolicy ? "Set" : "Missing", ok: !!result.headers?.permissionsPolicy },
      ]
    : [];
  const summary = result
    ? [
        `Target: ${result.target.normalizedUrl}`,
        `Grade: ${score.grade} (${score.score}%)`,
        result.riskScore != null ? `Risk score: ${result.riskScore} (${result.riskLevel || "n/a"})` : null,
        `HTTPS enforced: ${result.httpsEnforced ? "Yes" : "No"}`,
        `SSL: ${result.sslStatus}`,
        `Server: ${result.headers.server || "n/a"}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const actionItems = result
    ? [
        !result.httpsEnforced ? "Force HTTPS redirects and disable plaintext HTTP." : null,
        !(result.ssl?.enabled && result.ssl?.authorized) ? "Install a valid, trusted SSL certificate." : null,
        !result.headers?.hsts ? "Enable HSTS to enforce HTTPS at the browser level." : null,
        !result.headers?.csp ? "Add a Content-Security-Policy to reduce injection risk." : null,
        !result.headers?.xFrameOptions ? "Set X-Frame-Options to prevent clickjacking." : null,
        !result.headers?.xContentTypeOptions ? "Set X-Content-Type-Options: nosniff." : null,
        !result.headers?.referrerPolicy ? "Set a strict Referrer-Policy." : null,
        !result.headers?.permissionsPolicy ? "Set Permissions-Policy to limit browser features." : null,
      ].filter((item): item is string => Boolean(item))
    : [];

  const reportHtml = result
    ? `
      <html>
        <head>
          <title>Web Security Scan Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 22px; margin-bottom: 6px; }
            h2 { font-size: 14px; margin-top: 20px; }
            .meta { color: #475569; font-size: 12px; }
            .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-top: 10px; }
            .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #e2e8f0; font-size: 11px; }
            ul { margin: 6px 0 0 18px; }
          </style>
        </head>
        <body>
          <h1>Web Security Scan Report</h1>
          <div class="meta">Target: ${result.target.normalizedUrl}</div>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="card">
            <div class="row"><strong>Grade</strong><span class="badge">${score.grade} (${score.score}%)</span></div>
            <div class="row"><strong>HTTPS enforced</strong><span>${result.httpsEnforced ? "Yes" : "No"}</span></div>
            <div class="row"><strong>SSL status</strong><span>${result.sslStatus}</span></div>
            <div class="row"><strong>Server</strong><span>${result.headers.server || "n/a"}</span></div>
            <div class="row"><strong>Response time</strong><span>${formatMs(result.responseTimeMs)}</span></div>
          </div>
          <h2>Security Checks</h2>
          <div class="card">
            ${checks
              .map((item) => `<div class="row"><span>${item.label}</span><span>${item.ok ? "Pass" : "Check"}</span></div>`)
              .join("")}
          </div>
          <h2>Recommended Fixes</h2>
          <div class="card">
            <ul>${(actionItems.length ? actionItems : ["No critical fixes found."]).map((item) => `<li>${item}</li>`).join("")}</ul>
          </div>
        </body>
      </html>
    `
    : "";

  const openReportPdf = () => {
    if (!result) return;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    win.document.open();
    win.document.write(reportHtml);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
    };
  };

  const downloadReportPdf = async () => {
    if (!result) return;
    setReportBusy(true);
    setReportError("");
    try {
      const response = await apiFetch("/api/intelligence/tools/webscan/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.target.normalizedUrl,
          report: {
            template: reportTemplate,
            brandName: reportBrandName,
            brandTagline: reportTagline,
          },
        }),
      });
      if (!response.ok) {
        let message = `Report failed (${response.status})`;
        try {
          const payload = await response.json();
          message = payload?.error || payload?.message || message;
        } catch {
          // ignore parse
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `webscan-report-${Date.now()}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Report download failed.");
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <WorkspaceShell title={tool.name} description={tool.detail}>
      <div className="grid gap-4">
        <div className="relative overflow-hidden rounded-[26px] border border-cyan-400/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_55%),linear-gradient(180deg,rgba(8,13,28,0.96),rgba(4,7,18,0.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_10%_15%,rgba(34,211,238,0.16),transparent_50%),radial-gradient(circle_at_85%_20%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(circle_at_40%_90%,rgba(244,114,182,0.12),transparent_60%)]" />
          <div className="absolute -top-6 right-10 h-20 w-20 rounded-full bg-cyan-400/10 blur-2xl animate-pulse" />
          <div className="absolute bottom-2 left-10 h-16 w-16 rounded-full bg-rose-400/10 blur-2xl animate-pulse" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Website URL</p>
              <p className="mt-2 text-sm text-slate-300/80">Scan your site for HTTPS enforcement, SSL health, security headers, and server signals.</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
              <ShieldAlert className="h-3.5 w-3.5" />
              Professional scan
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2 text-xs text-cyan-100/70">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">HTTPS + SSL</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Security headers</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Redirects + status</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Tech detection</span>
          </div>
          <div className="relative mt-5 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="h-12 w-full rounded-2xl border border-cyan-300/15 bg-black/35 px-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/35"
              placeholder="https://yourwebsite.com"
            />
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <button
                type="button"
                onClick={runScan}
                disabled={loading}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-5 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Scan Now
              </button>
              <button
                type="button"
                onClick={() => copyText(summary)}
                disabled={!result}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm text-slate-100 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                Copy Summary
              </button>
              <button
                type="button"
                onClick={downloadReportPdf}
                disabled={!result}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm text-slate-100 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
              >
                {reportBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Download PDF
              </button>
              <button
                type="button"
                onClick={openReportPdf}
                disabled={!result}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm text-slate-100 transition-colors hover:bg-white/[0.08] disabled:opacity-60"
              >
                <ExternalLink className="h-4 w-4" />
                Print Report
              </button>
              <button
                type="button"
                onClick={() => sendToolPromptToZorvix(tool, summary || tool.prompt)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
              >
                <BrainCircuit className="h-4 w-4 text-cyan-200" />
                Ask ZORVIX
              </button>
            </div>
          </div>
          {loading ? (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-400/60" />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-400">
            Tip: use a website you own or have explicit permission to test.
          </p>
          {lastScanAt ? <p className="mt-2 text-[11px] text-cyan-100/70">Last scan: {formatDate(lastScanAt)}</p> : null}
          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
          {reportError ? <p className="mt-3 text-sm text-rose-200">{reportError}</p> : null}
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300/90 md:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Report Template</p>
              <select
                value={reportTemplate}
                onChange={(event) => setReportTemplate(event.target.value as "classic" | "dark" | "neon")}
                className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-slate-100"
              >
                <option value="classic">Classic</option>
                <option value="dark">Dark</option>
                <option value="neon">Neon</option>
              </select>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Brand Name</p>
              <input
                value={reportBrandName}
                onChange={(event) => setReportBrandName(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-slate-100"
                placeholder="ZeroDay Guardian"
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Tagline</p>
              <input
                value={reportTagline}
                onChange={(event) => setReportTagline(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-slate-100"
                placeholder="Security posture snapshot"
              />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-cyan-100/70">Prefer print-ready report? Use "Print Report" below.</div>
        </div>

        {result ? (
          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr,0.9fr]">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Security Checks</p>
                <div
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
                    score.grade === "A"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : score.grade === "B"
                        ? "bg-cyan-400/15 text-cyan-200"
                        : score.grade === "C"
                          ? "bg-amber-400/15 text-amber-200"
                          : score.grade === "D"
                            ? "bg-orange-400/15 text-orange-200"
                            : "bg-rose-400/15 text-rose-200"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Grade {score.grade} - {score.score}%
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {checks.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-200">{item.label}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                          item.severity === "high"
                            ? "border-rose-400/40 text-rose-200"
                            : item.severity === "medium"
                              ? "border-amber-300/40 text-amber-200"
                              : "border-emerald-300/40 text-emerald-200"
                        }`}
                      >
                        {item.severity}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        item.ok ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
                      }`}
                    >
                      {item.ok ? "Pass" : "Check"}
                    </span>
                  </div>
                ))}
              </div>
              {result.notes ? <p className="mt-4 text-xs text-amber-200/80">{result.notes}</p> : null}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Quick Summary</p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <ShieldCheck className="h-4 w-4 text-cyan-200" />
                    Risk score
                  </div>
                  <span className="text-xs text-slate-300">
                    {result.riskScore != null ? `${result.riskScore} (${result.riskLevel || "n/a"})` : "n/a"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Clock className="h-4 w-4 text-cyan-200" />
                    Response time
                  </div>
                  <span className="text-xs text-slate-300">{formatMs(result.responseTimeMs)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Server className="h-4 w-4 text-cyan-200" />
                    Server
                  </div>
                  <span className="text-xs text-slate-300">{result.headers.server}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Globe2 className="h-4 w-4 text-cyan-200" />
                    Final URL
                  </div>
                  <span className="text-xs text-slate-300">{result.target.normalizedUrl}</span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {(result.technologies.length ? result.technologies : ["Unknown stack"]).map((tech) => (
                  <span key={tech} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-200">
                    {tech}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  HTTPS: {result.httpsStatus ?? "n/a"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  SSL: {result.sslStatus}
                </span>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Protocol & Redirects</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300/82">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>HTTP status</span>
                  <span className="text-xs text-slate-300">{result.httpStatus ?? "n/a"}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>HTTPS status</span>
                  <span className="text-xs text-slate-300">{result.httpsStatus ?? "n/a"}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>HTTP response time</span>
                  <span className="text-xs text-slate-300">{formatMs(result.httpResponseTimeMs)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Redirect target</span>
                  <span className="text-xs text-slate-300">{result.redirectTarget || "n/a"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Missing Headers</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(result.missingHeaders?.length ? result.missingHeaders : ["None detected"]).map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-200">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Open Ports (basic)</p>
              <div className="mt-4 grid gap-2 text-sm text-slate-300/82">
                {(result.openPorts?.length ? result.openPorts : [{ port: 0, status: "No common ports responded" }]).map((entry) => (
                  <div key={`${entry.port}-${entry.status}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span>{entry.port ? `Port ${entry.port}` : "Ports"}</span>
                    <span className="text-xs text-slate-300">{entry.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Recommended Fixes</p>
            <div className="mt-4 grid gap-2 text-sm text-slate-300/82">
              {(actionItems.length ? actionItems : ["No critical fixes found. Maintain current hardening."]).map((item) => (
                <label key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={!!checklist[item]}
                    onChange={(event) => setChecklist((prev) => ({ ...prev, [item]: event.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-black/40"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">SSL Status</p>
              <div className="mt-4 space-y-2 text-sm text-slate-300/82">
                <p>Status: {result.sslStatus}</p>
                <p>Valid from: {formatDate(result.ssl.validFrom)}</p>
                <p>Valid to: {formatDate(result.ssl.validTo)}</p>
                <p>Days remaining: {result.ssl.daysRemaining ?? "n/a"}</p>
                <p>Issuer: {result.ssl.issuer || "n/a"}</p>
                <p>Self-signed: {result.ssl.selfSigned === null ? "n/a" : result.ssl.selfSigned ? "Yes" : "No"}</p>
                <p>Authorized: {result.ssl.authorized ? "Yes" : "No"}</p>
                {result.ssl.authorizationError ? <p>Auth error: {result.ssl.authorizationError}</p> : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Domain Info</p>
              <div className="mt-4 space-y-2 text-sm text-slate-300/82">
                <p>Host: {result.domain.hostname}</p>
                <p>IPv4: {formatList(result.domain.ipv4)}</p>
                <p>IPv6: {formatList(result.domain.ipv6)}</p>
                <p>CNAME: {formatList(result.domain.cname)}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Server Info</p>
              <div className="mt-4 space-y-2 text-sm text-slate-300/82">
                <p>Powered by: {result.headers.poweredBy}</p>
                <p>Content type: {result.headers.contentType}</p>
                <p>Content length: {result.headers.contentLength || "n/a"}</p>
                <p>HSTS: {result.headers.hsts ? "Enabled" : "Missing"}</p>
                <p>CSP: {result.headers.csp ? "Present" : "Missing"}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Security Headers</p>
              <div className="mt-4 space-y-2 text-sm text-slate-300/82">
                {headerChecks.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span>{item.label}</span>
                    <span className={item.ok ? "text-emerald-200" : "text-amber-200"}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {history.length ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Recent Scans</p>
            <div className="mt-4 grid gap-3">
              {history.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300/82">
                  <div>
                    <p className="text-slate-100">{item.target}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(item.timestamp)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs">Grade {item.grade}</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs">{item.score}%</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs">
                      HTTPS {item.httpsEnforced ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </WorkspaceShell>
  );
};

const GuidedWorkspace = ({ tool }: { tool: ToolDefinition }) => (
  <WorkspaceShell title={tool.name} description={tool.detail}>
    <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Guided Prompt</p>
        <p className="mt-3 text-sm leading-7 text-slate-100">{tool.prompt}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => sendToolPromptToZorvix(tool)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14"
          >
            <BrainCircuit className="h-4 w-4" />
            Ask ZORVIX
          </button>
          <button
            type="button"
            onClick={() => copyText(tool.prompt || "")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
          >
            <Copy className="h-4 w-4" />
            Copy Prompt
          </button>
        </div>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Workflow</p>
        <ol className="mt-4 space-y-3 text-sm text-slate-300/82">
          <li>1. Scope the asset, symptom, or code path before expanding the investigation.</li>
          <li>2. Use ZORVIX for a guided analysis and keep the prompt tied to verified evidence.</li>
          <li>3. Continue in the lab environment to validate remediation and document the outcome.</li>
        </ol>
        <Link
          to={`/lab?tool=${tool.id}`}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
        >
          Open Lab Workspace
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  </WorkspaceShell>
);

const LabWorkspace = ({ tool }: { tool: ToolDefinition }) => (
  <WorkspaceShell title={tool.name} description={tool.detail}>
    <div className="grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Lab Launch</p>
        <p className="mt-3 text-sm leading-7 text-slate-300/82">
          Move into a dedicated practice flow to review the concept, rehearse the response, and keep your learning path organized.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to={`/lab?tool=${tool.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14"
          >
            Launch Practice
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => sendToolPromptToZorvix(tool)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
          >
            <BrainCircuit className="h-4 w-4 text-cyan-200" />
            Build a Guided Plan
          </button>
        </div>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">What This Workspace Delivers</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-300/82">
          {(tool.capabilities || []).map((capability) => (
            <li key={capability}>- {capability}</li>
          ))}
        </ul>
      </div>
    </div>
  </WorkspaceShell>
);

const LearningWorkspace = ({ tool }: { tool: ToolDefinition }) => (
  <WorkspaceShell title={tool.name} description={tool.detail}>
    <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Learning Prompt</p>
        <p className="mt-3 text-sm leading-7 text-slate-100">{tool.prompt}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => sendToolPromptToZorvix(tool)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14"
          >
            <BrainCircuit className="h-4 w-4" />
            Start Learning with ZORVIX
          </button>
          <Link
            to={`/lab?tool=${tool.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
          >
            Open Practice Environment
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Recommended Sequence</p>
        <ol className="mt-4 space-y-3 text-sm text-slate-300/82">
          <li>1. Ask for a concept-first explanation and one practical example.</li>
          <li>2. Move into a lab or practice scenario to reinforce the concept.</li>
          <li>3. Return with one focused follow-up to deepen the next layer of skill.</li>
        </ol>
      </div>
    </div>
  </WorkspaceShell>
);

const renderWorkspace = (tool: ToolDefinition) => {
  if (tool.workspace === "research") return <ResearchWorkspace tool={tool} />;
  if (tool.workspace === "knowledge") return <KnowledgeWorkspace tool={tool} />;
  if (tool.workspace === "dork") return <DorkWorkspace tool={tool} />;
  if (tool.workspace === "domain") return <DomainWorkspace tool={tool} />;
  if (tool.workspace === "webscan") return <WebScanWorkspace tool={tool} />;
  if (tool.workspace === "learning") return <LearningWorkspace tool={tool} />;
  if (tool.workspace === "lab") return <LabWorkspace tool={tool} />;
  return <GuidedWorkspace tool={tool} />;
};

const ToolDetail = () => {
  const { id } = useParams<{ id: string }>();
  const toolId = id ? Number.parseInt(id, 10) : Number.NaN;
  const [toolsCatalog, setToolsCatalog] = useState<ToolDefinition[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const tool = useMemo(() => getToolById(toolsCatalog, toolId), [toolId, toolsCatalog]);

  useEffect(() => {
    let active = true;

    getToolsCatalog()
      .then((tools) => {
        if (!active) return;
        setToolsCatalog(tools);
        setCatalogReady(true);
      })
      .catch(() => {
        if (!active) return;
        setToolsCatalog([]);
        setCatalogReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tool) return;
    try {
      const raw = localStorage.getItem("tools:recent");
      const ids = raw ? (JSON.parse(raw) as number[]) : [];
      const next = [tool.id, ...ids.filter((id) => id !== tool.id)].slice(0, 8);
      localStorage.setItem("tools:recent", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("tools:recent-updated"));
    } catch {
      // ignore local storage issues
    }
  }, [tool]);

  const related = useMemo(() => (tool ? relatedToolsFor(toolsCatalog, tool, 3) : []), [tool, toolsCatalog]);

  if (!catalogReady) {
    return (
      <div className="page-shell bg-[#050816]">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="skeleton-block h-10 w-40 rounded-full" />
            <div className="skeleton-block min-h-[260px] rounded-[32px]" />
            <div className="grid gap-6 xl:grid-cols-[1.25fr,0.75fr]">
              <div className="skeleton-block min-h-[520px] rounded-[28px]" />
              <div className="skeleton-block min-h-[420px] rounded-[28px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!tool) return <NotFound />;
  const trustMeta = workspaceTrustMeta(tool);

  const Icon = getToolIcon(tool.icon);

  return (
    <div className="page-shell bg-[#050816]">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="mx-auto max-w-7xl space-y-8">
          <Link to="/tools" className="inline-flex items-center gap-2 text-sm text-slate-300 transition-colors hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to tools
          </Link>

          <section className="overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(59,130,246,0.18),transparent_24%),linear-gradient(180deg,rgba(8,13,28,0.98),rgba(4,7,18,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] md:p-8">
            <div className="grid gap-8 xl:grid-cols-[1.15fr,0.85fr]">
              <div className="space-y-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                  <Icon className="h-7 w-7" />
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/72">{tool.category}</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-5xl">{sanitize(tool.name)}</h1>
                  <p className="max-w-3xl text-base leading-7 text-slate-300/82">{sanitize(tool.description)}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-cyan-100">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {trustMeta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => sendToolPromptToZorvix(tool)}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:bg-cyan-400/14"
                  >
                    <BrainCircuit className="h-4 w-4" />
                    Ask ZORVIX
                  </button>
                  <Link
                    to={`/lab?tool=${tool.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/[0.08]"
                  >
                    Open Lab
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Mission Group</p>
                  <p className="mt-3 text-xl font-semibold text-slate-50">{tool.group}</p>
                  <p className="mt-2 text-sm text-slate-300/75">{tool.detail}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Capabilities</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300/78">
                    {(tool.capabilities || []).map((capability) => (
                      <li key={capability}>- {capability}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[24px] border border-cyan-300/15 bg-cyan-400/[0.04] p-5 sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/72">Trust Profile</p>
                  <p className="mt-3 text-base font-medium text-slate-50">{trustMeta.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300/78">{trustMeta.detail}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-8 xl:grid-cols-[1.25fr,0.75fr]">
            <div>{renderWorkspace(tool)}</div>

            <aside className="space-y-5">
              <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,25,0.96),rgba(5,8,18,0.96))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Operational Notes</p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300/78">
                  <li>Use this workspace only on systems you own or are explicitly authorized to assess.</li>
                  <li>Keep prompts grounded in observable facts before escalating analysis or remediation.</li>
                  <li>Move into lab mode when you need hands-on verification or repeatable practice.</li>
                </ul>
              </section>

              {related.length ? (
                <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,25,0.96),rgba(5,8,18,0.96))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Related Workspaces</p>
                  <div className="mt-4 space-y-3">
                    {related.map((item) => (
                      <Link
                        key={item.id}
                        to={`/tools/${item.id}`}
                        className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-cyan-300/20 hover:bg-white/[0.06]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-100">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-400">{item.category}</p>
                          </div>
                          <ExternalLink className="mt-0.5 h-4 w-4 text-cyan-200/70" />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300/74">{item.description}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,25,0.96),rgba(5,8,18,0.96))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">Tags</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(tool.tags || []).map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300/82">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolDetail;
