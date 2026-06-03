#!/usr/bin/env node
/**
 * Bundle Size Check
 *
 * Scans dist/assets/ for JS chunks and enforces size budgets.
 * Used in CI to prevent bundle bloat.
 *
 * Usage: node scripts/bundle-size-check.mjs [dist-dir]
 *
 * Budget thresholds (configurable below):
 * - Index chunk (critical path): max 150 KB
 * - Any single chunk: max 300 KB
 * - Total JS payload: max 3,000 KB
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";

// ── Budget thresholds (uncompressed sizes) ──
const BUDGET = {
  indexChunkMaxKB: 150,
  singleChunkMaxKB: 300,
  totalPayloadMaxKB: 3000,
};

// ── Allowlist: known large vendor chunks that can't be split further ──
// These are checked against but exempt from the single-chunk limit.
// To add a new entry, use the chunk name prefix (without hash).
const ALLOWED_OVERSIZED_CHUNKS = [
  "firebase-firestore-",
  "sentry-vendor-",
  "react-vendor-",
  "html2canvas-vendor-",
];

// ── Find dist directory ──
const distDir = resolve(process.argv[2] || "dist");

let files;
try {
  files = readdirSync(join(distDir, "assets"));
} catch {
  console.error(`Could not read ${join(distDir, "assets")}. Did you run 'vite build' first?`);
  process.exit(1);
}

// ── Collect JS chunks ──
const jsChunks = files
  .filter((f) => f.endsWith(".js"))
  .map((f) => {
    const filePath = join(distDir, "assets", f);
    const sizeBytes = statSync(filePath).size;
    const sizeKB = Math.round(sizeBytes / 1024);
    return { name: f, sizeKB, sizeBytes };
  })
  .sort((a, b) => b.sizeKB - a.sizeKB);

if (jsChunks.length === 0) {
  console.error("No JS chunks found in dist/assets/.");
  process.exit(1);
}

// ── Categorize chunks ──
const indexChunk = jsChunks.find((c) => c.name.startsWith("index-"));
const totalSizeKB = jsChunks.reduce((sum, c) => sum + c.sizeKB, 0);

console.log("╔══════════════════════════════════════════════╗");
console.log("║         Bundle Size Budget Check            ║");
console.log("╚══════════════════════════════════════════════╝\n");
console.log(`  Total JS chunks: ${jsChunks.length}`);
console.log(`  Total JS payload: ${totalSizeKB} KB\n`);

// ── Print all chunks ──
console.log("  Top chunks by size:");
for (const chunk of jsChunks.slice(0, 10)) {
  const bar = "█".repeat(Math.min(Math.round(chunk.sizeKB / 10), 30));
  console.log(`    ${chunk.sizeKB.toString().padStart(4)} KB  ${bar}  ${chunk.name}`);
}
if (jsChunks.length > 10) {
  console.log(`    ... and ${jsChunks.length - 10} more chunks`);
}
console.log("");

let failed = false;

// ── Check index chunk ──
if (indexChunk) {
  const passed = indexChunk.sizeKB <= BUDGET.indexChunkMaxKB;
  const icon = passed ? "✅" : "❌";
  console.log(
    `  ${icon} Index chunk (critical path): ${indexChunk.sizeKB} KB (max: ${BUDGET.indexChunkMaxKB} KB)`
  );
  if (!passed) failed = true;
} else {
  console.log("  ⚠️  Index chunk not found in output — check manualChunks config");
}

// ── Check for oversized chunks ──
const oversized = jsChunks.filter((c) => c.sizeKB > BUDGET.singleChunkMaxKB);
const disallowed = oversized.filter(
  (c) => !ALLOWED_OVERSIZED_CHUNKS.some((prefix) => c.name.startsWith(prefix))
);
const allowed = oversized.filter((c) =>
  ALLOWED_OVERSIZED_CHUNKS.some((prefix) => c.name.startsWith(prefix))
);

for (const chunk of allowed) {
  console.log(
    `  ⚠️  Oversized (allowed): ${chunk.name} — ${chunk.sizeKB} KB (max: ${BUDGET.singleChunkMaxKB} KB)`
  );
}

if (disallowed.length > 0) {
  for (const chunk of disallowed) {
    console.log(
      `  ❌ Oversized chunk: ${chunk.name} — ${chunk.sizeKB} KB (max: ${BUDGET.singleChunkMaxKB} KB)`
    );
  }
  failed = true;
} else if (oversized.length === 0) {
  console.log(
    `  ✅ No chunks exceed ${BUDGET.singleChunkMaxKB} KB limit`
  );
} else {
  console.log(
    `  ✅ All oversized chunks are in the allowlist (${oversized.length} entries)`
  );
}

// ── Check total payload ──
const totalPassed = totalSizeKB <= BUDGET.totalPayloadMaxKB;
const totalIcon = totalPassed ? "✅" : "❌";
console.log(
  `  ${totalIcon} Total JS payload: ${totalSizeKB} KB (max: ${BUDGET.totalPayloadMaxKB} KB)`
);
if (!totalPassed) failed = true;

console.log("");

if (failed) {
  console.error("❌ Bundle size budget exceeded — failing CI.");
  console.error("   Reduce chunk sizes or adjust budget thresholds.");
  process.exit(1);
} else {
  console.log("✅ All bundle size budgets met.");
  process.exit(0);
}
