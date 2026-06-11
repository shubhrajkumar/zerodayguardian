/**
 * ApiHealthWidget — Lightweight real-time API health monitoring component.
 *
 * Cyber Rationale: You can't fix what you don't measure. Proactive monitoring
 * with 30s heartbeat interval provides instant visibility into backend status
 * without external monitoring tools.
 *
 * Usage:
 *   <ApiHealthWidget />
 *   // Shows: 🟢 API: HEALTHY (85ms) or 🔴 API: DOWN
 */
import { useEffect, useState, useCallback } from "react";

// ── Types ──
type HealthStatus = "healthy" | "degraded" | "down";

interface HealthCheckResult {
  status: HealthStatus;
  latency: number;
  lastChecked: string;
  error?: string;
}

// ── Constants ──
const HEALTH_ENDPOINT = "/api/health";
const CHECK_INTERVAL = 30000; // 30 seconds
const DEGRADED_THRESHOLD = 1000; // 1 second

// ── Component ──
export function ApiHealthWidget({ compact = false }: { compact?: boolean }) {
  const [health, setHealth] = useState<HealthCheckResult>({
    status: "healthy",
    latency: 0,
    lastChecked: new Date().toISOString(),
  });
  const [expanded, setExpanded] = useState(false);

  const checkHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch(HEALTH_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const latency = Math.round(performance.now() - start);
      setHealth({
        status: res.ok ? (latency > DEGRADED_THRESHOLD ? "degraded" : "healthy") : "down",
        latency,
        lastChecked: new Date().toISOString(),
        error: res.ok ? undefined : `HTTP ${res.status}`,
      });
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      setHealth({
        status: "down",
        latency,
        lastChecked: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Network error",
      });
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkHealth();

    // Periodic check
    const interval = setInterval(checkHealth, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Status color mapping
  const statusColors: Record<HealthStatus, string> = {
    healthy: "text-emerald-400",
    degraded: "text-amber-400",
    down: "text-red-400",
  };

  const statusLabels: Record<HealthStatus, string> = {
    healthy: "HEALTHY",
    degraded: "DEGRADED",
    down: "DOWN",
  };

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-200 ${
        compact ? "p-3" : "p-4"
      }`}
      role="status"
      aria-label="API Health Status"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3"
      >
        {/* Status indicator dot */}
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            health.status === "healthy"
              ? "bg-emerald-400"
              : health.status === "degraded"
                ? "bg-amber-400"
                : "bg-red-400"
          }`}
          style={{
            boxShadow:
              health.status === "healthy"
                ? "0 0 8px rgba(52,211,153,0.5)"
                : health.status === "degraded"
                  ? "0 0 8px rgba(251,191,36,0.5)"
                  : "0 0 8px rgba(248,113,113,0.5)",
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white">API</span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${statusColors[health.status]}`}
            >
              {statusLabels[health.status]}
            </span>
          </div>
          {!compact && (
            <p className="text-[10px] text-slate-500">
              {health.latency}ms · {new Date(health.lastChecked).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Error count badge */}
        {health.status === "down" && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[9px] font-bold text-red-400">
            !
          </span>
        )}

        {/* Expand indicator */}
        {!compact && (
          <svg
            className={`h-3 w-3 text-slate-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded details */}
      {expanded && !compact && (
        <div className="mt-3 space-y-2 border-t border-white/8 pt-3 text-[10px] text-slate-400">
          <div className="flex justify-between">
            <span>Endpoint</span>
            <span className="font-mono text-slate-500">{HEALTH_ENDPOINT}</span>
          </div>
          <div className="flex justify-between">
            <span>Latency</span>
            <span className={`font-mono ${health.latency > DEGRADED_THRESHOLD ? "text-amber-400" : "text-slate-300"}`}>
              {health.latency}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span>Last Check</span>
            <span className="font-mono text-slate-500">
              {new Date(health.lastChecked).toLocaleTimeString()}
            </span>
          </div>
          {health.error && (
            <div className="flex justify-between">
              <span>Error</span>
              <span className="font-mono text-red-400">{health.error}</span>
            </div>
          )}

          {/* Manual refresh button */}
          <button
            type="button"
            onClick={checkHealth}
            className="mt-2 w-full rounded-lg border border-white/8 bg-white/[0.04] py-1.5 text-[10px] uppercase tracking-wider text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-cyan-300"
          >
            Refresh Now
          </button>
        </div>
      )}
    </div>
  );
}

// ── Compact variant for embedding in headers/panels ──
export function ApiHealthBadge() {
  return <ApiHealthWidget compact />;
}

export default ApiHealthWidget;
