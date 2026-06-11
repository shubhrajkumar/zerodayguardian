/**
 * ResponsiveImage — Production-grade responsive image component with srcSet and lazy loading.
 *
 * Cyber Rationale: Proper srcSet/sizes reduce bandwidth by ~40% on mobile while
 * maintaining visual quality on retina displays. Lazy loading defers offscreen
 * images until the user scrolls near them.
 *
 * Usage:
 *   <ResponsiveImage src="/hero-banner.png" alt="Cyber security dashboard" />
 *   <ResponsiveImage src="/og-image.png" alt="OG Image" widths={[640, 1280]} />
 */
import { useState } from "react";

// ── Types ──
interface ResponsiveImageProps {
  src: string;
  alt: string;
  widths?: number[];
  className?: string;
  priority?: boolean;
  sizes?: string;
}

// ── Default breakpoints ──
const DEFAULT_WIDTHS = [320, 640, 960, 1280, 1920];
const DEFAULT_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";

// ── Component ──
export function ResponsiveImage({
  src,
  alt,
  widths = DEFAULT_WIDTHS,
  className = "",
  priority = false,
  sizes = DEFAULT_SIZES,
}: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Generate srcSet: appends ?w=N query param to each width
  const srcSet = widths.map((w) => `${src}?w=${w} ${w}w`).join(", ");

  // Fallback to original src on error
  if (error) {
    return (
      <img
        src={src}
        alt={alt}
        className={`w-full h-auto ${className}`}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        srcSet={srcSet}
        sizes={sizes}
        src={`${src}?w=1280`}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`w-full h-auto transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Low-quality placeholder while loading */}
      {!loaded && (
        <div
          className="absolute inset-0 bg-white/[0.03] animate-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default ResponsiveImage;
