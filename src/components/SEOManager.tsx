/**
 * SEOManager — Elite production-grade SEO wrapper using react-helmet-async.
 *
 * Dynamically injects Title, Meta Description, OpenGraph, Twitter Cards,
 * Canonical URLs, and optional JSON-LD structured data per-route.
 *
 * Usage:
 *   <SEOManager
 *     title="Threat Dashboard | ZeroDay Guardian"
 *     description="Track missions, streaks, badges..."
 *     path="/dashboard"
 *     ogImage="/og-image.png"
 *     jsonLd={[{ "@type": "WebPage", ... }]}
 *   />
 *
 * Cyber Rationale: Consistent, server-rendered meta tags prevent content injection
 * via manipulative OpenGraph scraping and ensure accurate social preview rendering,
 * mitigating social-engineering phishing via spoofed previews.
 */
import { Helmet } from "react-helmet-async";

// ── Type Definitions ──
export interface JsonLdEntry {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

export interface SEOManagerProps {
  /** Page title — appended with site name if not already present */
  title: string;
  /** Meta description — truncated to 160 chars for optimal SERP display */
  description: string;
  /** Canonical path — e.g. "/dashboard". Origin is resolved automatically. */
  path: string;
  /** OG/Twitter image path or full URL — defaults to "/og-image.png" */
  ogImage?: string;
  /** OpenGraph type — defaults to "website" */
  ogType?: string;
  /** Page-specific keywords (comma-separated) */
  keywords?: string;
  /** JSON-LD structured data entries to inject */
  jsonLd?: JsonLdEntry[];
  /** Whether to set noindex for this page — defaults to false */
  noindex?: boolean;
  /** Robots directive string override — defaults to "index, follow, max-image-preview:large" */
  robots?: string;
}

// ── Constants ──
const SITE_NAME = "ZeroDay Guardian";
const SITE_ORIGIN =
  (typeof window !== "undefined" ? window.location.origin : "") ||
  String(
    import.meta.env.VITE_SITE_URL || (globalThis as Record<string, unknown>).__SITE_URL__ || "",
  ).replace(/\/+$/, "") ||
  "https://zerodayguardian-delta.vercel.app";
const DEFAULT_OG_IMAGE = "/og-image.png";

// ── Helpers ──
const resolveCanonical = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalizedPath === "/" ? "" : normalizedPath}`;
};

const resolveImageUrl = (image?: string): string => {
  const img = image || DEFAULT_OG_IMAGE;
  if (img.startsWith("http")) return img;
  return `${SITE_ORIGIN}${img.startsWith("/") ? img : `/${img}`}`;
};

const truncateDescription = (desc: string, maxLen = 160): string =>
  desc.length > maxLen ? `${desc.slice(0, maxLen - 3)}...` : desc;

// ── Component ──
const SEOManager = ({
  title,
  description,
  path,
  ogImage,
  ogType = "website",
  keywords,
  jsonLd,
  noindex = false,
  robots = "index, follow, max-image-preview:large",
}: SEOManagerProps) => {
  const canonical = resolveCanonical(path);
  const imageUrl = resolveImageUrl(ogImage);
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const metaDescription = truncateDescription(description);
  const robotsContent = noindex ? "noindex, nofollow" : robots;

  return (
    <Helmet prioritizeSeoTags>
      {/* ── Primary Meta ── */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      <meta name="robots" content={robotsContent} />
      <meta name="author" content={SITE_NAME} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />

      {/* ── Canonical ── */}
      <link rel="canonical" href={canonical} />

      {/* ── Open Graph ── */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={`${SITE_NAME} — AI Cybersecurity Platform`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />

      {/* ── Twitter Card ── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`${SITE_NAME} — AI Cybersecurity Platform`} />

      {/* ── JSON-LD Structured Data ── */}
      {jsonLd?.map((entry, index) => (
        <script key={`jsonld-${path}-${index}`} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOManager;


