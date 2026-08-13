import { useCallback, useEffect, useState } from "react";
import { Activity, Clock, History, Radar, RotateCcw, Search, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { ApiError, apiGetJson, apiPostJson } from "@/lib/apiClient";

type PortState = "open" | "closed" | "filtered";

type ScanResult = {
  port: number;
  service: string;
  state: PortState;
  latencyMs: number | null;
};

type ScanResponse = {
  status: string;
  target: string;
  scanned: number;
  open: number;
  filtered: number;
  closed: number;
  results: ScanResult[];
  scanDurationMs: number;
};

type ScanHistoryItem = {
  _id: string;
  target: string;
  openPorts: number[];
  scanDurationMs?: number;
  scannedAt: string;
};

const GROUPS = [
  { id: "web", label: "Web", hint: "80, 443, 8080, 8443" },
  { id: "mail", label: "Mail", hint: "25, 110, 143, 993, 995" },
  { id: "database", label: "Database", hint: "3306, 5432, 27017…" },
  { id: "infra", label: "Infra", hint: "22, 23, 445, 3389…" },
  { id: "all", label: "All (23)", hint: "full default set" },
];

const STATE_STYLES: Record<PortState, string> = {
  open: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  filtered: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  closed: "text-slate-500 bg-slate-500/10 border-slate-500/30",
};

const STATE_LABEL: Record<PortState, string> = {
  open: "OPEN",
  filtered: "FILTERED",
  closed: "CLOSED",
};

export default function ScanPage() {
  const [target, setTarget] = useState("");
  const [group, setGroup] = useState("web");
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const payload = await apiGetJson<{ scans?: ScanHistoryItem[] }>("/api/scan/history");
      setHistory(Array.isArray(payload.scans) ? payload.scans : []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    loadHistory().catch(() => undefined);
  }, [loadHistory]);

  const runScan = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = target.trim();
    if (!clean || loading) return;
    setLoading(true);
    setError("");
    setScan(null);
    try {
      const payload = await apiPostJson<ScanResponse>("/api/scan/port", { target: clean, group });
      setScan(payload);
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Scan failed. Check the target and try again.");
    } finally {
      setLoading(false);
    }
  };

  const rescanTarget = (value: string) => {
    setTarget(value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  };

  const openCount = scan?.open ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
          <Radar className="h-4 w-4" />
          <span>Port Scanner</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Recon any host, <span className="text-cyan-400">for real</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Scans 23 common ports with five concurrent workers, blocks private/internal targets (SSRF-safe), and stores
          every result to your scan history. Rate-limited to 5 scans per minute.
        </p>
      </div>

      {/* ── Scan form ── */}
      <form
        onSubmit={runScan}
        className="rounded-xl border border-border bg-card p-5 shadow-lg shadow-black/20"
      >
        <label htmlFor="scan-target" className="mb-2 block text-sm font-medium text-foreground">
          Target hostname or IP
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="scan-target"
              type="text"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="example.com or 8.8.8.8"
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 disabled:opacity-60"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {GROUPS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                onClick={() => setGroup(item.id)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                  group === item.id
                    ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                    : "border-border bg-background text-muted-foreground hover:border-cyan-400/40 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="submit"
              disabled={loading || !target.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Activity className="h-4 w-4 animate-pulse" /> : <Radar className="h-4 w-4" />}
              {loading ? "Scanning…" : "Scan"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* ── Scan results ── */}
      {scan && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-foreground">
              Results for <span className="text-cyan-400">{scan.target}</span>
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {scan.scanDurationMs}ms · {scan.scanned} ports
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Open
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-300">{scan.open}</div>
            </div>
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <Activity className="h-3.5 w-3.5" /> Filtered
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-300">{scan.filtered}</div>
            </div>
            <div className="rounded-lg border border-slate-500/30 bg-slate-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <XCircle className="h-3.5 w-3.5" /> Closed
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-300">{scan.closed}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Port</th>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">State</th>
                    <th className="px-4 py-3 font-semibold">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.results.map((result) => (
                    <tr key={result.port} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-foreground">{result.port}</td>
                      <td className="px-4 py-2.5 text-foreground">{result.service}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-bold tracking-wider ${STATE_STYLES[result.state]}`}
                        >
                          {STATE_LABEL[result.state]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {result.latencyMs != null ? `${result.latencyMs}ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {openCount > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              <ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
              Open ports are an attack surface — close anything you don&apos;t recognize.
            </p>
          )}
        </section>
      )}

      {/* ── Scan history ── */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-400" />
          <h2 className="text-lg font-bold text-foreground">Scan history</h2>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
            {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            No scans yet. Run your first scan above — results are saved to your account.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">Open ports</th>
                    <th className="px-4 py-3 font-semibold">Duration</th>
                    <th className="px-4 py-3 font-semibold">Scanned at</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item._id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-mono text-foreground">{item.target}</td>
                      <td className="px-4 py-2.5">
                        {item.openPorts.length === 0 ? (
                          <span className="text-muted-foreground">none</span>
                        ) : (
                          <span className="font-mono text-emerald-300">{item.openPorts.join(", ")}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">
                        {item.scanDurationMs != null ? `${item.scanDurationMs}ms` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(item.scannedAt)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => rescanTarget(item.target)}
                          title={`Rescan ${item.target}`}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition hover:border-cyan-400/40 hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" /> Rescan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
