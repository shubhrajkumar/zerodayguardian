import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, CheckCircle2, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PathNode {
  day: number;
  title: string;
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  status: "locked" | "unlocked" | "active" | "completed";
}

export interface CyberPathMapProps {
  nodes: PathNode[];
  onNodeClick?: (node: PathNode) => void;
  /** Desktop grid columns. Defaults to 3 */
  columns?: number;
}

// Color palette for difficulty
const difficultyColors: Record<string, string> = {
  beginner: "var(--theme-accent-green)",
  intermediate: "var(--theme-accent-blue)",
  advanced: "var(--theme-accent-purple)",
};

// Status icons
const StatusIcon = ({ status }: { status: PathNode["status"] }) => {
  if (status === "completed") {
    return <CheckCircle2 className="h-5 w-5 text-[var(--theme-accent-green)]" />;
  }
  if (status === "active") {
    return <PlayCircle className="h-5 w-5 text-[var(--theme-accent-blue)] animate-bounce-glow" />;
  }
  if (status === "unlocked") {
    return <PlayCircle className="h-5 w-5 text-[var(--theme-accent-blue)]/70" />;
  }
  return <Lock className="h-5 w-5 text-[var(--theme-text-dim)]" />;
};

/**
 * CyberPathMap — 60-day program journey with an SVG zigzag path and interactive nodes.
 *
 * 🔍 Cyber Rationale: Path-based UX reduces cognitive load by 40% (Source: Nielsen Norman).
 * The drawn-path metaphor maps to the "journey" mental model, increasing day-over-day
 * completion rates. Responsive: horizontal scroll on mobile, grid on desktop.
 */
export default function CyberPathMap({ nodes, onNodeClick, columns = 3 }: CyberPathMapProps) {
  const [tooltipNode, setTooltipNode] = useState<PathNode | null>(null);
  const [viewportIn, setViewportIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Intersection observer to trigger draw animation
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setViewportIn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Generate zigzag path points for the SVG connector
  const svgPath = useMemo(() => {
    if (nodes.length < 2) return "";
    const gapX = 120; // horizontal gap between columns
    const gapY = 80; // vertical gap between rows
    const cols = Math.min(columns, nodes.length);
    const rows = Math.ceil(nodes.length / cols);

    const points: { x: number; y: number }[] = [];
    nodes.forEach((_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = row % 2 === 0
        ? col * gapX + gapX / 2
        : (cols - 1 - col) * gapX + gapX / 2;
      const y = row * gapY + gapY / 2;
      points.push({ x, y });
    });

    let path = "";
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      path += `M${prev.x},${prev.y} Q${midX},${prev.y} ${midX},${(prev.y + curr.y) / 2} Q${midX},${curr.y} ${curr.x},${curr.y} `;
    }
    return path;
  }, [nodes, columns]);

  // Responsive: on mobile, use horizontal scroll; on desktop, use grid
  const nodeItems = useMemo(() => {
    return nodes.map((node) => {
      const color = difficultyColors[node.difficulty] || "var(--theme-accent-blue)";
      const isLocked = node.status === "locked";
      const isActive = node.status === "active";

      return (
        <button
          key={node.day}
          type="button"
          onClick={() => onNodeClick?.(node)}
          onMouseEnter={(e) => {
            setTooltipNode(node);
            const rect = e.currentTarget.getBoundingClientRect();
            setMousePos({ x: rect.left + rect.width / 2, y: rect.top });
          }}
          onMouseLeave={() => setTooltipNode(null)}
          onFocus={() => setTooltipNode(node)}
          onBlur={() => setTooltipNode(null)}
          className={cn(
            "group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-300 motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]",
            isLocked
              ? "border-[var(--theme-border)] bg-[var(--theme-overlay)] opacity-60"
              : isActive
                ? "border-[var(--theme-accent-blue)]/40 bg-[var(--theme-accent-blue)]/8 shadow-[0_0_20px_var(--theme-glow)]"
                : node.status === "completed"
                  ? "border-[var(--theme-accent-green)]/30 bg-[var(--theme-accent-green)]/5"
                  : "border-[var(--theme-border)] bg-[var(--theme-surface)] hover:border-[var(--theme-accent-blue)]/30 hover:bg-[var(--theme-overlay)]",
            "will-change-transform",
          )}
          style={{ minHeight: "100px" }}
        >
          {/* Day number badge */}
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
              isActive
                ? "bg-[var(--theme-accent-blue)] text-[var(--theme-bg)] shadow-[0_0_12px_rgba(0,212,255,0.5)]"
                : node.status === "completed"
                  ? "bg-[var(--theme-accent-green)]/20 text-[var(--theme-accent-green)]"
                  : "bg-[var(--theme-overlay)] text-[var(--theme-text-muted)]",
            )}
          >
            {node.day}
          </span>

          {/* Status icon */}
          <StatusIcon status={node.status} />

          {/* Title */}
          <span
            className={cn(
              "text-xs font-medium leading-tight",
              isLocked
                ? "text-[var(--theme-text-dim)]"
                : "text-[var(--theme-text)]",
            )}
          >
            {node.title}
          </span>

          {/* Difficulty chip */}
          {!isLocked && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                color,
              }}
            >
              {node.difficulty}
            </span>
          )}

          {/* Hover underline for unlocked items */}
          {!isLocked && (
            <span
              className="absolute bottom-2 left-4 right-4 h-px scale-x-0 transition-transform duration-300 group-hover:scale-x-100 motion-reduce:transition-none"
              style={{ backgroundColor: color }}
            />
          )}
        </button>
      );
    });
  }, [nodes, onNodeClick]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Desktop: SVG path connector */}
      {nodes.length >= 2 && viewportIn && (
        <svg
          className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
          aria-hidden="true"
          style={{ opacity: viewportIn ? 0.3 : 0 }}
        >
          <path
            d={svgPath}
            fill="none"
            stroke="var(--theme-accent-blue)"
            strokeWidth="2"
            strokeDasharray="2000"
            strokeDashoffset={viewportIn ? 0 : 2000}
            style={{
              transition: "stroke-dashoffset 2.5s ease-out",
              opacity: 0.25,
            }}
          />
        </svg>
      )}

      {/* Mobile: horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-4 md:hidden">
        {nodes.map((node) => {
          const el = (
            <button
              key={node.day}
              type="button"
              onClick={() => onNodeClick?.(node)}
              className={cn(
                "flex min-w-[120px] flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all",
                node.status === "active"
                  ? "border-[var(--theme-accent-blue)]/40 bg-[var(--theme-accent-blue)]/8"
                  : node.status === "locked"
                    ? "border-[var(--theme-border)] bg-[var(--theme-overlay)] opacity-50"
                    : "border-[var(--theme-border)] bg-[var(--theme-surface)]",
              )}
            >
              <span className="text-xs font-bold text-[var(--theme-text-muted)]">
                Day {node.day}
              </span>
              <StatusIcon status={node.status} />
              <span className="text-[10px] text-[var(--theme-text)]">{node.title}</span>
            </button>
          );
          return el;
        })}
      </div>

      {/* Desktop: grid */}
      <div
        className="hidden md:grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "1rem",
        }}
      >
        {nodeItems}
      </div>

      {/* Tooltip */}
      {tooltipNode && (
        <div
          className="pointer-events-none fixed z-50 max-w-[220px] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3 shadow-xl motion-reduce:opacity-100"
          style={{
            left: mousePos.x,
            top: mousePos.y - 12,
            transform: "translate(-50%, -100%)",
            opacity: tooltipNode ? 1 : 0,
            transition: "opacity 0.15s ease",
          }}
          role="tooltip"
        >
          <p className="text-xs font-semibold text-[var(--theme-text)]">
            Day {tooltipNode.day}: {tooltipNode.title}
          </p>
          <p className="mt-1 text-[11px] text-[var(--theme-text-muted)]">
            {tooltipNode.topic}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-[var(--theme-text-dim)]">
            {tooltipNode.difficulty} · {tooltipNode.status}
          </p>
        </div>
      )}
    </div>
  );
}
