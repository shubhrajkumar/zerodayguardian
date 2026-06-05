/**
 * Skeleton — shimmer loading placeholder.
 *
 * Usage:
 *   <Skeleton />                   // full-width bar, 20px height
 *   <Skeleton w="120px" h="12px" /> // custom size
 *   <Skeleton w="100%" h="200px" r="16px" /> // large card placeholder
 */
type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Shorthand width (default: 100%) */
  w?: string;
  /** Shorthand height (default: 20px) */
  h?: string;
  /** Shorthand border-radius (default: 8px) */
  r?: string;
};

/**
 * Skeleton — shimmer loading placeholder.
 *
 * Accepts className/style like shadcn components, plus optional w/h/r shorthand.
 */
export function Skeleton({ w, h, r, className = "", style, ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer ${className}`}
      style={{
        ...(w ? { width: w } : {}),
        ...(h ? { height: h } : {}),
        ...(r ? { borderRadius: r } : {}),
        background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-hover, rgba(255,255,255,0.06)) 50%, var(--bg-card) 75%)",
        backgroundSize: "200% 100%",
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export default Skeleton;

/** Compound skeleton for common layouts */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`glass-card p-5 space-y-3 ${className}`} aria-busy="true" aria-label="Loading...">
      <Skeleton w="40%" h="14px" />
      <Skeleton w="100%" h="10px" />
      <Skeleton w="75%" h="10px" />
      <Skeleton w="60%" h="10px" />
    </div>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <Skeleton
      w={`${size}px`}
      h={`${size}px`}
      r="var(--radius-full, 9999px)"
    />
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <Skeleton w={width} h="14px" />;
}
