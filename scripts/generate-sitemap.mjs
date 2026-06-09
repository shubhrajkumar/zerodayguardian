/**
 * generate-sitemap.mjs
 *
 * Automatically generates sitemap.xml and robots.txt into the dist/ folder.
 * Run via: node scripts/generate-sitemap.mjs (called as part of npm run build)
 *
 * Cyber Rationale: Dynamic sitemap generation ensures search engines always
 * index the correct set of public routes while blocking sensitive API/admin
 * endpoints from crawler exposure, preventing information leakage via indexed
 * paths.
 *
 * Usage:
 *   - Automatically called by "postbuild" npm script
 *   - Or run manually: node scripts/generate-sitemap.mjs
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Read total program days from shared syllabus data.
 * Falls back to 60 if the file is missing or malformed.
 */
const readTotalDays = () => {
  try {
    const syllabusPath = resolve(__dirname, "..", "shared", "syllabus-data.json");
    const raw = readFileSync(syllabusPath, "utf-8");
    const data = JSON.parse(raw);
    return typeof data.totalDays === "number" ? data.totalDays : 60;
  } catch {
    return 60;
  }
};

// ── Configuration ──
const SITE_URL = process.env.VITE_SITE_URL || process.env.APP_BASE_URL || "https://zerodayguardian-delta.vercel.app";
const TODAY = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

/**
 * Route definitions with SEO metadata.
 * Cyber Rationale: Each public-facing route is explicitly listed with priority
 * and change frequency to control crawl budget — authenticated-only routes
 * (dashboard, profile, security) are intentionally omitted from the sitemap
 * to prevent crawlers from indexing private user data.
 */
const routes = [
  // ── Public landing pages (high priority) ──
  { path: "/", priority: "1.0", changefreq: "daily", lastmod: TODAY },
  { path: "/about", priority: "0.8", changefreq: "monthly", lastmod: TODAY },
  { path: "/contact", priority: "0.6", changefreq: "monthly", lastmod: TODAY },

  // ── Core platform features (high priority) ──
  { path: "/learn", priority: "0.9", changefreq: "weekly", lastmod: TODAY },
  { path: "/program", priority: "0.9", changefreq: "daily", lastmod: TODAY },
  { path: "/lab", priority: "0.9", changefreq: "daily", lastmod: TODAY },
  { path: "/labs", priority: "0.7", changefreq: "daily", lastmod: TODAY },
  { path: "/tools", priority: "0.8", changefreq: "daily", lastmod: TODAY },
  { path: "/osint", priority: "0.8", changefreq: "daily", lastmod: TODAY },
  { path: "/assistant", priority: "0.8", changefreq: "daily", lastmod: TODAY },
  { path: "/missions", priority: "0.8", changefreq: "daily", lastmod: TODAY },

  // ── Community & content (medium priority) ──
  { path: "/community", priority: "0.7", changefreq: "daily", lastmod: TODAY },
  { path: "/resources", priority: "0.7", changefreq: "weekly", lastmod: TODAY },
  { path: "/blog", priority: "0.7", changefreq: "weekly", lastmod: TODAY },

  // ── Static/legal pages (low priority) ──
  { path: "/privacy", priority: "0.5", changefreq: "monthly", lastmod: TODAY },
  { path: "/terms", priority: "0.5", changefreq: "monthly", lastmod: TODAY },

  // ── Program day pages (indexable educational content) ──
  ...Array.from({ length: readTotalDays() }, (_, i) => ({
    path: `/program/day/${i + 1}`,
    priority: "0.7",
    changefreq: "weekly",
    lastmod: TODAY,
  })),
];

// ── Generate sitemap.xml ──
const sitemapEntries = routes
  .map(
    (route) => `  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`,
  )
  .join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
                            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${sitemapEntries}
</urlset>`;

// ── Generate robots.txt ──
// Cyber Rationale: Explicitly blocking /api/*, /admin/*, and /pyapi/* prevents
// crawlers from indexing sensitive backend endpoints that could reveal API
// structure, authentication patterns, or internal routing to attackers.
const robotsTxt = `# ── ZeroDay Guardian Robots.txt ──
# Generated: ${TODAY}
# Cyber Rationale: Restrictive crawl policy blocks sensitive endpoints from
# search engine indexing to prevent information leakage.

User-agent: *
# ── Block sensitive paths ──
Disallow: /api/
Disallow: /pyapi/
Disallow: /admin/
Disallow: /auth/
Disallow: /verify-email
Disallow: /security
Disallow: /dashboard
Disallow: /profile

# ── Allow all public content ──
Allow: /
Allow: /learn
Allow: /program
Allow: /program/day/
Allow: /lab
Allow: /tools
Allow: /osint
Allow: /assistant
Allow: /missions
Allow: /community
Allow: /resources
Allow: /blog
Allow: /about
Allow: /privacy
Allow: /terms
Allow: /contact

# ── Crawl budget optimization ──
User-agent: Googlebot
Crawl-delay: 2
Allow: /

User-agent: Bingbot
Crawl-delay: 2
Allow: /

# ── Block AI training crawlers from scraping platform content ──
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Amazonbot
Disallow: /

# ── Sitemap & Host ──
Host: ${SITE_URL}
Sitemap: ${SITE_URL}/sitemap.xml
`;

// ── Write files ──
const distDir = resolve(__dirname, "..", "dist");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

writeFileSync(resolve(distDir, "sitemap.xml"), sitemap, "utf-8");
console.log(`[generate-sitemap] ✅ sitemap.xml generated (${routes.length} URLs)`);

writeFileSync(resolve(distDir, "robots.txt"), robotsTxt, "utf-8");
console.log("[generate-sitemap] ✅ robots.txt generated");
