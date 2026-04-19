import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePublicApiUrl } from "@/lib/apiClient";

type BackendState = "checking" | "online" | "degraded" | "offline";

interface PingPayload {
  status?: string;
  message?: string;
  ts?: string;
}

const PING_INTERVAL_MS = 15000;
const PING_TIMEOUT_MS = 4000;

const toneFor = (state: BackendState) => {
  if (state === "online") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (state === "degraded") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (state === "offline") return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  return "border-slate-400/25 bg-slate-400/10 text-slate-200";
};

const labelFor = (state: BackendState) => {
  if (state === "online") return "Backend Connected ✅";
  if (state === "degraded") return "Backend degraded";
  if (state === "offline") return "Backend offline";
  return "Checking backend...";
};

const BackendStatusBanner = () => {
  const [state, setState] = useState<BackendState>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [note, setNote] = useState<string>("Initializing connectivity check...");
  const mountedRef = useRef(true);

  const tone = useMemo(() => toneFor(state), [state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const probe = async () => {
      const started = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      if (mountedRef.current) {
        setState("checking");
        setNote("Testing backend connection...");
      }
      try {
        const response = await fetch(resolvePublicApiUrl("/api/health"), {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const elapsed = Math.round(performance.now() - started);
        if (!mountedRef.current) return;

        if (!response.ok) {
          setState(response.status >= 500 ? "degraded" : "offline");
          setLatencyMs(elapsed);
          setNote(response.status >= 500 ? "The backend responded with a temporary server issue." : `Connection failed (${response.status}).`);
          return;
        }

        const payload = (await response.json()) as PingPayload;
        setState(payload.status === "ok" ? "online" : "degraded");
        setLatencyMs(elapsed);
        setNote(payload.status === "ok" ? `Health check passed (${elapsed}ms)` : "Backend responded, but not in a healthy state.");
      } catch (error) {
        clearTimeout(timeout);
        if (!mountedRef.current) return;
        setState(navigator.onLine ? "degraded" : "offline");
        setLatencyMs(null);
        setNote((error as Error)?.name === "AbortError" ? "Backend check timed out. Please retry shortly." : "Cannot reach backend right now.");
      }
    };

    probe();
    const interval = window.setInterval(probe, PING_INTERVAL_MS);
    const onOnline = () => probe();
    window.addEventListener("online", onOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return (
    <div className="relative z-20 px-4 pt-20">
      <div className={`mx-auto w-full max-w-6xl rounded-lg border px-3 py-2 text-xs md:text-sm ${tone}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{labelFor(state)}</span>
          <span>{note}</span>
          <span>{latencyMs != null ? `latency ${latencyMs}ms` : "latency n/a"}</span>
        </div>
      </div>
    </div>
  );
};

export default BackendStatusBanner;
