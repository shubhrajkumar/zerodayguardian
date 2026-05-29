import { useState, useEffect } from "react";

const formatLiveTime = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return now.toLocaleDateString("en-US", options).replace(",", " •");
};

const formatRelativeTime = (date: Date): string => {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} ${Math.floor(diffDay / 7) === 1 ? "week" : "weeks"} ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const LiveClock = () => {
  const [time, setTime] = useState(formatLiveTime);

  useEffect(() => {
    setTime(formatLiveTime());
    const interval = setInterval(() => {
      setTime(formatLiveTime());
    }, 60_000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <time
      dateTime={new Date().toISOString()}
      title={new Date().toISOString()}
      style={{
        color: "var(--color-text-muted, #94a3b8)",
        fontSize: "13px",
        fontFamily: "monospace",
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {time}
    </time>
  );
};

export { formatRelativeTime };
export default LiveClock;
