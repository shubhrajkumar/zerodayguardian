/**
 * EmptyState — Reusable empty state component for pages with no data.
 *
 * Usage:
 *   <EmptyState icon="🔬" title="No labs yet" subtitle="Start a lab to see it here" />
 *   <EmptyState icon="🎯" title="No missions" action={{ label: "View missions", onClick: () => navigate("/missions") }} />
 */

import React from "react";

interface EmptyStateProps {
  /** Emoji or icon element */
  icon?: string | React.ReactNode;
  /** Main heading */
  title: string;
  /** Supporting text */
  subtitle?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
}

export function EmptyState({ icon, title, subtitle, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in ${className}`}
      role="status"
      aria-label="Empty state"
    >
      {icon && (
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border"
          style={{
            borderColor: "var(--theme-border)",
            backgroundColor: "var(--theme-overlay)",
          }}
        >
          <span className="text-3xl" aria-hidden="true">
            {icon}
          </span>
        </div>
      )}

      <h3
        className="text-lg font-semibold"
        style={{ color: "var(--theme-text)" }}
      >
        {title}
      </h3>

      {subtitle && (
        <p
          className="mt-2 max-w-sm text-sm leading-relaxed"
          style={{ color: "var(--theme-text-muted)" }}
        >
          {subtitle}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-cyber mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
