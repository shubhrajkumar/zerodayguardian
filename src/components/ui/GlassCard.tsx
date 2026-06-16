import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export interface GlassCardProps {
  /** Visual variant. `default` = subtle border; `accent` = neon accent border; `locked` = dimmed */
  variant?: "default" | "accent" | "locked";
  /** Apply glow effect on hover */
  glowOnHover?: boolean;
  children: ReactNode;
  className?: string;
  /** Inline styles for animation delays, custom colors, etc. */
  style?: React.CSSProperties;
  /** Optional click handler */
  onClick?: () => void;
  /** aria-label for interactive cards */
  ariaLabel?: string;
  /** Role override */
  role?: string;
}

const variantStyles: Record<string, string> = {
  default:
    "border-[var(--theme-border)] bg-[var(--theme-surface)]",
  accent:
    "border-[var(--theme-accent-blue)]/40 bg-[var(--theme-surface)] shadow-[0_0_12px_var(--theme-glow)]",
  locked:
    "border-[var(--theme-border)] bg-[var(--theme-surface)] opacity-50",
};

const hoverEffect = cn(
  "will-change-transform transition-all duration-300 motion-reduce:transition-none",
  "hover:-translate-y-0.5",
  "active:scale-[0.98]",
);

/**
 * GlassCard — Premium glassmorphism card with optional neon glow on hover.
 *
 * 🔍 Cyber Rationale: GPU-accelerated transforms (translateY, scale) for jank-free
 * 60fps interactions even on low-end devices. Glassmorphism adds depth hierarchy
 * to the cyber theme. ARIA attributes ensure screen readers announce interactive cards.
 */
export default function GlassCard({
  variant = "default",
  glowOnHover = true,
  children,
  className,
  style,
  onClick,
  ariaLabel,
  role,
  ...rest
}: GlassCardProps & Record<string, unknown>) {
  const isInteractive = Boolean(onClick);

  return (
    <div
      style={style}
      className={cn(
        "rounded-2xl border backdrop-blur-xl",
        variantStyles[variant],
        glowOnHover && hoverEffect,
        glowOnHover && "hover:shadow-[0_0_20px_var(--theme-glow),0_0_40px_var(--theme-glow)]",
        isInteractive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]",
        className,
      )}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      tabIndex={isInteractive ? 0 : undefined}
      role={role || (isInteractive ? "button" : undefined)}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </div>
  );
}
