/**
 * ResourceErrorFallback — friendly error UI shown when a resource fails to load.
 *
 * Never shows raw error codes to users. Provides retry capability
 * and a reassuring message while the resource prepares.
 */
import { useState } from "react";

interface ResourceErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: string;
}

export default function ResourceErrorFallback({
  title = "Content Loading",
  message = "This resource is being prepared for you. Please try again in a moment.",
  onRetry,
  icon = "🔄",
}: ResourceErrorFallbackProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // Silently handle — retry button will remain available
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 p-6 text-center animate-fade-in"
      style={{
        background: "var(--bg-card, var(--theme-card))",
        border: "1px solid var(--border, var(--theme-border))",
        borderRadius: "var(--radius-md, 12px)",
        maxWidth: "400px",
        margin: "0 auto",
      }}
      role="alert"
    >
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <p
        className="text-sm font-semibold"
        style={{ color: "var(--text-primary, var(--theme-text))" }}
      >
        {title}
      </p>
      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--text-muted, var(--theme-text-muted))" }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-1 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "var(--accent, var(--theme-accent-blue))",
            color: "var(--bg-base, var(--theme-bg))",
          }}
        >
          {retrying ? "Retrying…" : "↺ Retry"}
        </button>
      )}
    </div>
  );
}
