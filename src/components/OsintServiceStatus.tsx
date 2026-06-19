/**
 * OsintServiceStatus — Live backend integration status panel.
 *
 * Pings each known OSINT backend service endpoint and displays:
 * - Connection status (online / degraded / offline)
 * - Response latency in ms
 * - Last checked timestamp
 * - Auto-refresh every 30s with manual refresh button
 *
 * Designed for the left column of the OSINT Command Center page.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Wifi, WifiOff, AlertTriangle, TerminalSquare } from "lucide-react";
import { resolveApiUrl, resolvePyApiUrl } from "@/lib/apiConfig";

// ── Types ──
type ServiceStatus = "online" | "degraded" | "offline" | "checking";

interface ServiceEntry {
  id: string;
  label: string;
  endpoint: string;
  method: "GET" | "HEAD" | "POST";
  category: "express" | "python" | "external";
  status: ServiceStatus;
  latencyMs: number | null;
  lastChecked: string | null;
  error?: string;
}

const INITIAL_SERVICES: ServiceEntry[] = [
  {
    id: "express-backend",
    label: "Express API Core",
    endpoint: "/api/health",
    method: "GET",
    category: "express",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
  {
    id: "osint-providers",
    label: "OSINT Providers",
    endpoint: "/api/osint/providers",
    method: "GET",
    category: "express",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
  {
    id: "http-headers",
    label: "HTTP Header Inspector",
    endpoint: "/api/tools/headers",
    method: "GET",
    category: "express",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
  {
    id: "port-scan",
    label: "Port Scanner",
    endpoint: "/api/tools/portscan",
    method: "GET",
    category: "express",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
  {
    id: "subdomain",
    label: "Subdomain Discovery",
    endpoint: "/api/tools/subdomain",
    method: "GET",
    category: "express",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
  {
    id: "tls-cert",
    label: "TLS Certificate",
    endpoint: "/api/tools/tls",
    method: "GET",
    category: "express",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
  {
    id: "python-api",
    label: "Python Training Engine",
    endpoint: "/pyapi/health",
    method: "GET",
    category: "python",
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  },
];

const STATUS_COLORS: Record<ServiceStatus, { dot: string; text: string; bg: string; border: string }> = {
  online: {
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]",
    text: "text-emerald-400",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/20",
  },
  degraded: {
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
    text: "text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/20",
  },
  offline: {
    dot: "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]",
    text: "text-rose-400",
    bg: "bg-rose-500/8",
    border: "border-rose-500/20",
  },
  checking: {
    dot: "bg-slate-500 animate-pulse",
    text: "text-slate-500",
    bg: "bg-slate-500/5",
    border: "border-slate-700/30",
  },
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  online: "ONLINE",
  degraded: "DEGRADED",
  offline: "OFFLINE",
  checking: "SCANNING",
};

// ── Helpers ──
const formatLatency = (ms: number | null): string => {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const formatTimestamp = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
};

const resolveEndpoint = (endpoint: string, category: "express" | "python" | "external"): string => {
  if (category === "python") {
    return resolvePyApiUrl(endpoint);
  }
  return resolveApiUrl(endpoint);
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  online: <Wifi className="h-3 w-3 text-emerald-400" />,
  degraded: <AlertTriangle className="h-3 w-3 text-amber-400" />,
  offline: <WifiOff className="h-3 w-3 text-rose-400" />,
  checking: <TerminalSquare className="h-3 w-3 text-slate-500 animate-pulse" />,
};

// ── Component ──
export default function OsintServiceStatus() {
  const [services, setServices] = useState<ServiceEntry[]>(INITIAL_SERVICES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // ── Ping a single service ──
  const pingService = useCallback(async (service: ServiceEntry): Promise<ServiceEntry> => {
    const url = resolveEndpoint(service.endpoint, service.category);
    const startMs = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: service.method,
        signal: controller.signal,
        headers: { Accept: "application/json" },
        // Don't include credentials for status checks to avoid auth redirects
        credentials: "omit",
      });

      clearTimeout(timeout);
      const latencyMs = Math.round(performance.now() - startMs);

      // Any response (including 400/401/405) means the service is reachable
      if (response.status >= 200 && response.status < 500) {
        // 4xx means the route exists and responded — service is online
        const status: ServiceStatus = latencyMs > 3000 ? "degraded" : "online";
        return { ...service, status, latencyMs, lastChecked: new Date().toISOString(), error: undefined };
      }

      // 5xx means the service responded but with a server error
      return {
        ...service,
        status: "degraded",
        latencyMs,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${response.status}`,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startMs);
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      return {
        ...service,
        status: "offline",
        latencyMs,
        lastChecked: new Date().toISOString(),
        error: isTimeout ? "timeout" : "unreachable",
      };
    }
  }, []);

  // ── Ping all services ──
  const pingAll = useCallback(async () => {
    // Mark all as checking
    setServices((prev) => prev.map((s) => ({ ...s, status: "checking" as ServiceStatus })));
    setIsRefreshing(true);

    // Ping all in parallel
    const results = await Promise.allSettled(INITIAL_SERVICES.map(pingService));

    setServices((prev) =>
      prev.map((s) => {
        const result = results.find(
          (r) => r.status === "fulfilled" && r.value.id === s.id,
        );
        return result?.status === "fulfilled" ? result.value : s;
      }),
    );

    setIsRefreshing(false);
  }, [pingService]);

  // ── Initial ping + auto-refresh every 30s ──
  useEffect(() => {
    pingAll();

    intervalRef.current = setInterval(() => {
      pingAll();
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pingAll]);

  // ── Derived state ──
  const onlineCount = services.filter((s) => s.status === "online").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const offlineCount = services.filter((s) => s.status === "offline").length;
  const totalCount = services.length;
  const allChecked = services.every((s) => s.status !== "checking");

  return (
    <div className="rounded-lg border border-slate-800/40 bg-slate-900/30 p-3">
      {/* ── Header ── */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${
            offlineCount > 0
              ? "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]"
              : degradedCount > 0
                ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
          }`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
            SERVICE STATUS
          </span>
        </div>
        <button
          type="button"
          onClick={pingAll}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1 rounded border border-slate-700/40 px-2 py-1 font-mono text-[9px] text-slate-500 transition hover:border-cyan-500/30 hover:text-cyan-300 disabled:opacity-40"
          title="Refresh status"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "SCAN" : "REFRESH"}
        </button>
      </div>

      {/* ── Summary bar ── */}
      {allChecked && (
        <div className="mb-3 flex items-center gap-2 rounded border border-slate-800/30 bg-slate-950/40 px-2.5 py-1.5">
          <span className="font-mono text-[9px] text-slate-500">
            {onlineCount}/{totalCount} online
          </span>
          {degradedCount > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span className="font-mono text-[9px] text-amber-400/80">
                {degradedCount} degraded
              </span>
            </>
          )}
          {offlineCount > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span className="font-mono text-[9px] text-rose-400/80">
                {offlineCount} offline
              </span>
            </>
          )}
          <span className="ml-auto font-mono text-[8px] text-slate-600">
            auto 30s
          </span>
        </div>
      )}

      {/* ── Service list ── */}
      <div className="space-y-1">
        {services.map((service) => {
          const colors = STATUS_COLORS[service.status];

          return (
            <div
              key={service.id}
              className={`flex items-center gap-2 rounded border ${colors.border} ${colors.bg} px-2.5 py-1.5 transition-all duration-200`}
            >
              {/* Status dot */}
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />

              {/* Service info */}
              <div className="flex-1 min-w-0">
                <p className={`font-mono text-[9px] font-semibold ${colors.text} truncate`}>
                  {service.label}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-slate-600">
                    {STATUS_LABELS[service.status]}
                  </span>
                  {service.status !== "checking" && service.latencyMs !== null && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="font-mono text-[7px] tabular-nums text-slate-600">
                        {formatLatency(service.latencyMs)}
                      </span>
                    </>
                  )}
                  {service.error && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="font-mono text-[7px] text-rose-400/60">
                        {service.error}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Status icon */}
              <span className="shrink-0">
                {STATUS_ICONS[service.status]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Last refreshed ── */}
      {allChecked && services[0]?.lastChecked && (
        <p className="mt-2 font-mono text-[8px] text-slate-600">
          Last scan: {formatTimestamp(services[0].lastChecked)}
        </p>
      )}
    </div>
  );
}
