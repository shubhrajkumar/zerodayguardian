import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValueEvent, useSpring, useTransform } from "framer-motion";

export interface ProgressRingProps {
  /** Current day number (1-based) */
  current: number;
  /** Total days (e.g. 60) */
  total: number;
  /** Optional label override */
  label?: string;
  /** Rotating motivational quotes shown inside the ring */
  quotes?: string[];
}

/** 🔍 Cyber Rationale: Circular progress triggers dopamine delivery; reframes "X/60"
 * loss aversion into a journey mindset ("Day X of 60"). Uses Framer Motion's spring
 * animation for GPU-accelerated, jank-free progress transitions. Color states:
 * locked (grey) → active (neon blue) → completed (gold). */

const DEFAULT_QUOTES: string[] = [
  "Every expert was once a beginner.",
  "Consistency beats intensity.",
  "Small steps lead to big breaches... of skill.",
  "The only way is through.",
  "Stay curious, stay dangerous.",
  "One day at a time builds mastery.",
  "Cybersecurity is a marathon, not a sprint.",
  "Your future self will thank you.",
];

export default function ProgressRing({
  current,
  total,
  label,
  quotes = DEFAULT_QUOTES,
}: ProgressRingProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [fadeQuote, setFadeQuote] = useState(true);

  const day = Math.min(current, total);
  const clampedProgress = total > 0 ? (day / total) * 100 : 0;
  const circumference = 2 * Math.PI * 54;
  const isCompleted = current >= total;
  const isActive = current > 0;

  // Framer Motion spring for smooth count-up animation
  const springProgress = useSpring(0, {
    stiffness: 60,
    damping: 15,
    restDelta: 0.5,
  });

  // Set the target value when progress changes
  useEffect(() => {
    springProgress.set(clampedProgress);
  }, [clampedProgress, springProgress]);

  // Transform the spring value to SVG stroke-dashoffset
  const dashOffset = useTransform(springProgress, (latest) => {
    const pct = Math.min(100, Math.max(0, latest));
    return circumference - (pct / 100) * circumference;
  });

  const displayValue$ = useTransform(springProgress, (latest) =>
    Math.round(latest),
  );
  const [displayValue, setDisplayValue] = useState(0);
  useMotionValueEvent(displayValue$, "change", (latest) => {
    setDisplayValue(latest);
  });

  // Color states: locked (grey), active (neon), completed (gold)
  const ringColor = isCompleted
    ? "#ffd700" // Gold for completed
    : isActive
      ? "var(--theme-accent-blue)" // Neon blue for active
      : "var(--theme-text-dim)"; // Grey for locked
  const trackColor = "color-mix(in srgb, var(--theme-border) 40%, transparent)";
  const glowFilter = isCompleted
    ? "drop-shadow(0 0 8px rgba(255, 215, 0, 0.4))"
    : isActive
      ? "drop-shadow(0 0 6px rgba(0, 212, 255, 0.4))"
      : undefined;

  // Rotate quotes every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFadeQuote(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % quotes.length);
        setFadeQuote(true);
      }, 300);
    }, 6000);
    return () => clearInterval(timer);
  }, [quotes.length]);

  const displayLabel = label || (isCompleted ? "Mission Complete" : `Day ${day} of ${total}`);

  return (
    <div
      className="inline-flex flex-col items-center gap-3"
      role="progressbar"
      aria-valuenow={day}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuetext={`Day ${day} of ${total}: ${Math.round(clampedProgress)}% complete`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width="140"
          height="140"
          viewBox="0 0 120 120"
          className="rotate-[-90deg]"
          aria-hidden="true"
        >
          {/* Track circle */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={trackColor}
            strokeWidth="6"
          />
          {/* Animated progress circle — Framer Motion */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              filter: glowFilter,
              transition: "stroke 0.5s ease",
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold tabular-nums"
            style={{ color: "var(--theme-text)" }}
          >
            {displayValue}
            <span className="text-sm text-[var(--theme-text-muted)]">%</span>
          </motion.span>
          {isActive && (
            <span
              className="mt-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ color: "var(--theme-text-muted)" }}
            >
              {displayLabel}
            </span>
          )}
        </div>
      </div>

      {/* Label */}
      <span
        className="text-sm font-semibold"
        style={{ color: isCompleted ? "#ffd700" : "var(--theme-text)" }}
      >
        {displayLabel}
      </span>

      {/* Motivational quote */}
      <div
        className="h-10 text-center transition-opacity duration-300"
        style={{ opacity: fadeQuote ? 1 : 0 }}
      >
        <p
          className="max-w-[200px] text-[11px] italic leading-tight"
          style={{ color: "var(--theme-text-muted)" }}
        >
          "{quotes[quoteIndex]}"
        </p>
      </div>
    </div>
  );
}
