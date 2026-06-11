/**
 * LiveClock — real-time clock that updates every minute.
 *
 * Renders: "Mon, 04 Jun 2026 • 14:32"
 * Uses monospace font, muted color, updates every 60s.
 */
import { useState, useEffect } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatClock(date: Date): string {
  const day = DAYS[date.getDay()];
  const d = String(date.getDate()).padStart(2, "0");
  const month = MONTHS[date.getMonth()];
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${day}, ${d} ${month} ${y} \u2022 ${h}:${m}`;
}

/**
 * Format a Date as a relative time string (e.g. "2 minutes ago", "3 hours ago").
 */
// Cyber Rationale: formatRelativeTime is used by DashboardPage and other components for relative timestamps.
// eslint-disable-next-line react-refresh/only-export-components -- utility function used across modules
export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export default function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <time
      dateTime={now.toISOString()}
      className={`font-mono text-xs tabular-nums ${className}`}
      style={{ color: "var(--text-muted, #64748b)" }}
    >
      {formatClock(now)}
    </time>
  );
}
