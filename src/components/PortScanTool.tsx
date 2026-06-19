import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, Search, Terminal, Copy, Check } from "lucide-react";

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

type PortGroup = "web" | "mail" | "database" | "infra" | "all" | "custom";

const PORT_GROUPS: { id: PortGroup; label: string; color: string }[] = [
  { id: "web", label: "Web", color: "bg-cyan-400" },
  { id: "mail", label: "Mail", color: "bg-emerald-400" },
  { id: "database", label: "Database", color: "bg-amber-400" },
  { id: "infra", label: "Infra", color: "bg-violet-400" },
  { id: "all", label: "All", color: "bg-rose-400" },
  { id: "custom", label: "Custom", color: "bg-slate-400" },
];

const API_PATH = "/api/tools/portscan";

// Port counts per group for progress estimation
// NOTE: `all` must match backend DEFAULT_PORTS count (23 ports)
const PORT_COUNTS: Record<Exclude<PortGroup, "custom">, number> = {
  web: 4,
  mail: 5,
  database: 6,
  infra: 6,
  all: 23,
};

// Estimate scan time: each port takes ~1.5s with 5 concurrent workers
// So batch of 5 takes ~1.5s, each additional batch adds ~1.5s
const estimateScanMaxMs = (portCount: number): number => {
  return Math.ceil(portCount / 5) * 1500 + 500; // +500ms buffer for overhead
};

export default function PortScanTool() {
  const [host, setHost] = useState("");
  const [portGroup, setPortGroup] = useState<PortGroup>("web");
  const [customPorts, setCustomPorts] = useState("80,443,22,3306");
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const progressStartRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval>>();

  // ── Scan progress timer ──
  const portCount =
    portGroup === "custom"
      ? Math.max(1, customPorts
          .split(/[,\s]+/)
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n > 0 && n <= 65535).length)
      : PORT_COUNTS[portGroup];
  const estimatedMaxMs = estimateScanMaxMs(portCount);

  useEffect(() => {
    if (!loading) {
      setScanProgress(0);
      return;
    }
    progressStartRef.current = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - progressStartRef.current;
      const pct = Math.min(95, Math.round((elapsed / estimatedMaxMs) * 100));
      setScanProgress(pct);
    }, 150);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [loading, estimatedMaxMs]);

  const runScan = useCallback(async () => {
    let target = host.trim().toLowerCase();
    if (!target) return;

    // Normalize input
    target = target
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/\s/g, "");

    setLoading(true);
    setError("");
    setScanData(null);

    try {
      const payload: Record<string, unknown> = { target };

      if (portGroup === "custom") {
        const parsed = customPorts
          .split(/[,\s]+/)
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n > 0 && n <= 65535);
        if (parsed.length === 0) {
          setError("[!] ERROR: No valid ports specified in custom list.");
          setLoading(false);
          return;
        }
        payload.ports = parsed;
      } else {
        payload.group = portGroup;
      }

      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error
            ? `[!] ERROR: ${body.error}`
            : "[!] ERROR: Uplink rejected target structure."
        );
        return;
      }

      const data: ScanResponse = await res.json();
      setScanData(data);
    } catch {
      setError("[!] ERROR: Uplink rejected target structure.");
    } finally {
      setLoading(false);
    }
  }, [host, portGroup, customPorts]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) runScan();
  };

  const copyResults = () => {
    if (!scanData) return;
    const text = scanData.results
      .map(
        (r) =>
          `${r.port}/${r.service}\t${r.state}${r.latencyMs !== null ? `\t${r.latencyMs}ms` : ""}`
      )
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">PORT SCANNER</h2>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">
              // Scan common ports via backend proxy
            </p>
          </div>
        </div>
      </div>

      <div className="relative mb-4">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-rose-400/70">
          [TARGET HOST]
        </span>
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ENTER HOST (e.g., scanme.nmap.org)"
          className="h-12 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-32 pr-4 font-mono text-sm text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-rose-500/50 focus:shadow-[0_0_12px_rgba(244,63,94,0.08)] focus:outline-none"
        />
      </div>

      {/* Port group selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PORT_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setPortGroup(g.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold font-mono tracking-wider transition ${
              portGroup === g.id
                ? "bg-slate-800/80 text-white ring-1 ring-slate-600"
                : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${g.color} ${
                portGroup === g.id ? "shadow-[0_0_6px_rgba(0,0,0,0.5)]" : ""
              }`}
            />
            {g.label}
          </button>
        ))}
      </div>

      {/* Custom port input */}
      {portGroup === "custom" ? (
        <div className="relative mb-4">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500">
            PORTS
          </span>
          <input
            value={customPorts}
            onChange={(e) => setCustomPorts(e.target.value)}
            placeholder="Comma-separated port list (e.g., 22,80,443,8080)"
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-14 pr-4 font-mono text-xs text-slate-100 placeholder-slate-600 transition-all duration-200 focus:border-rose-500/30 focus:outline-none"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={runScan}
        disabled={loading || !host.trim()}
        className="h-10 w-full rounded-lg bg-gradient-to-r from-rose-400 via-red-400 to-orange-300 px-4 text-xs font-bold text-slate-950 shadow-[0_8px_24px_rgba(244,63,94,0.2)] transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            SCANNING {portCount} PORTS... {scanProgress}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Search className="h-4 w-4" />
            SCAN PORTS
          </span>
        )}
      </button>

      {/* ── Scan Progress Bar ── */}
      {loading && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${scanProgress}%`,
                  background: `linear-gradient(90deg, rgba(244,63,94,0.7), rgba(251,146,60,0.8))`,
                  boxShadow: `0 0 8px rgba(244,63,94,0.4)`,
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-slate-500 tabular-nums w-8 text-right">
              {scanProgress}%
            </span>
          </div>
          <p className="mt-1 font-mono text-[9px] text-slate-600">
            Probing {portCount} port{portCount !== 1 ? "s" : ""} with 5 concurrent workers
          </p>
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
          <p className="font-mono text-xs text-rose-300/90">{error}</p>
        </div>
      ) : null}

      {scanData ? (
        <div className="mt-4 rounded-lg border border-rose-500/20 bg-slate-950/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-rose-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-rose-400/80">
              src/scan/{scanData.target}.json
            </span>
          </div>

          {/* Summary stats */}
          <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-mono">
            <span className="text-slate-500">
              Target: <span className="text-slate-300">{scanData.target}</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-500">
              Duration:{" "}
              <span className="text-slate-300">{scanData.scanDurationMs}ms</span>
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-mono">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {scanData.open} open
            </span>
            {scanData.filtered > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {scanData.filtered} filtered
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              {scanData.closed} closed
            </span>
            <span className="text-slate-600">| {scanData.scanned} total</span>
          </div>

          {/* Results table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 border-b border-rose-500/10 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-rose-400/60">
            <span>Port</span>
            <span>Service</span>
            <span>State</span>
            <span className="text-right">Latency</span>
          </div>

          <div className="mt-1 max-h-80 space-y-0.5 overflow-y-auto">
            {scanData.results.map((r) => (
              <div
                key={r.port}
                className="grid grid-cols-[auto_1fr_auto_auto] gap-2 rounded px-2 py-1.5 text-xs font-mono transition-colors hover:bg-rose-500/5"
              >
                <span className="shrink-0 w-12 text-slate-400">
                  {r.port}
                </span>
                <span className="text-slate-300">{r.service}</span>
                <span
                  className={`shrink-0 font-semibold ${
                    r.state === "open"
                      ? "text-emerald-400"
                      : r.state === "filtered"
                        ? "text-amber-400"
                        : "text-slate-500"
                  }`}
                >
                  {r.state.toUpperCase()}
                </span>
                <span className="shrink-0 w-16 text-right text-slate-500">
                  {r.latencyMs !== null ? `${r.latencyMs}ms` : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Copy button */}
          <div className="mt-3 flex justify-end border-t border-rose-500/10 pt-3">
            <button
              type="button"
              onClick={copyResults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-mono text-slate-400 transition hover:border-rose-300/30 hover:text-rose-300"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  COPIED
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  COPY TO CLIPBOARD
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}

      {!scanData && !error ? (
        <p className="mt-3 font-mono text-[10px] text-slate-600">
          {">"} Select a port group, enter a host, and scan for open ports.
        </p>
      ) : null}
    </div>
  );
}
