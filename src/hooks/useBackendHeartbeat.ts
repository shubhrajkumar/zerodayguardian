import { useEffect, useRef } from "react";

/**
 * useBackendHeartbeat — Prevents Render cold starts by pinging the backend
 * health endpoint every 14 minutes in the background.
 *
 * - Only runs when the browser tab is visible (via Page Visibility API)
 * - Cleans up the interval on unmount
 * - Silently catches network errors
 * - Does nothing in non-browser environments (SSR safety)
 */
export function useBackendHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const BACKEND_URL =
      (typeof __BACKEND_PUBLIC_URL__ !== "undefined" ? __BACKEND_PUBLIC_URL__ : "") ||
      String(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "").trim() ||
      "https://zerodayguardian-backend.onrender.com";

    if (!BACKEND_URL) return;

    const HEARTBEAT_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

    const ping = () => {
      if (document.hidden) return; // Skip if tab is not visible
      fetch(`${BACKEND_URL}/api/health`, {
        method: "GET",
        cache: "no-store",
      }).catch(() => {
        // Silent catch — heartbeat is best-effort
      });
    };

    // Initial ping after 30 seconds (give the page time to settle)
    const initialTimeout = window.setTimeout(ping, 30_000);

    // Recurring ping every 14 minutes
    intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);
}
