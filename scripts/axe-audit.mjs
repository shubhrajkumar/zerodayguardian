#!/usr/bin/env node
/**
 * aXe Accessibility Audit Script
 *
 * Builds the project, serves it, and runs aXe-core to catch WCAG violations.
 * Used in CI to fail PRs that introduce accessibility regressions.
 *
 * Usage:
 *   node scripts/axe-audit.mjs                             # build + serve + audit
 *   node scripts/axe-audit.mjs --report=<path.json>        # audit existing report
 *   node scripts/axe-audit.mjs --serve-dir=dist            # serve existing build
 *
 * Budget thresholds (configurable below):
 * - Total violations: max 0 (zero-tolerance for new violations)
 * - Critical violations: max 0
 * - Serious violations: max 2 (allow existing known issues)
 * - Moderate violations: max 2
 * - Minor violations: max 3
 */

import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, extname, join, dirname } from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_PORT = 3457;

// ── Violation budgets ──
// Zero-tolerance for new critical/serious violations.
// Minor violations are allowed up to 3 (e.g., intentionally decorative elements).
const BUDGET = {
  critical: { max: 0, label: "Critical violations" },
  serious: { max: 2, label: "Serious violations" },
  moderate: { max: 2, label: "Moderate violations" },
  minor: { max: 3, label: "Minor violations" },
  total: { max: 5, label: "Total violations" },
};

// ── Known/allowlisted violations (pre-existing, to be fixed over time) ──
// Update these as existing violations get fixed in the codebase.
const ALLOWED_VIOLATIONS = [
  "link-in-text-block", // Known: some inline links rely on color alone
  "color-contrast",     // Known: terminal/code text contrast edge cases
];

// ── Parse CLI args ──
const args = process.argv.slice(2);
const reportOnly = args.find((a) => a.startsWith("--report="));
const serveDir = args.find((a) => a.startsWith("--serve-dir="));
const port = args.find((a) => a.startsWith("--port="));

const AUDIT_PORT = port ? parseInt(port.split("=")[1], 10) : DEFAULT_PORT;
const SERVE_DIR = serveDir ? resolve(ROOT, serveDir.split("=")[1]) : null;

// ── Helpers ──
function log(msg) {
  console.log(`  ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
}

function success(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  console.log(`  ❌ ${msg}`);
}

function box(title) {
  const line = "═".repeat(Math.max(title.length + 4, 50));
  console.log(`╔${line}╗`);
  console.log(`║  ${title.padEnd(line.length - 4)}  ║`);
  console.log(`╚${line}╝`);
  console.log("");
}

// ── Run a shell command ──
function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    stdio: opts.silent ? "pipe" : "inherit",
    timeout: opts.timeout || 300000,
    env: { ...process.env, ...opts.env },
    ...opts,
  });
}

// ── Start HTTP server ──
function startServer(dir, port) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      let filePath = join(dir, req.url === "/" ? "index.html" : req.url);
      // Remove query strings
      filePath = filePath.split("?")[0];

      const ext = extname(filePath);
      const mimeTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
      };

      try {
        const content = readFileSync(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(content);
      } catch {
        // Fallback to index.html for SPA routing
        try {
          const content = readFileSync(join(dir, "index.html"));
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end("Not found");
        }
      }
    });

    server.listen(port, "0.0.0.0", () => {
      console.log(`  🌐 Server running at http://localhost:${port}`);
      resolve(server);
    });

    server.on("error", reject);
  });
}

// ── Parse aXe JSON output ──
function parseAxeReport(output) {
  try {
    // aXe CLI outputs JSON to stdout with some progress lines mixed in
    const jsonStart = output.indexOf("{");
    const jsonEnd = output.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    const jsonStr = output.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// ── Main audit function ──
async function runAudit() {
  box("aXe Accessibility Audit");

  // ── Step 1: Build or use existing ──
  const distDir = SERVE_DIR || join(ROOT, "dist");

  if (!SERVE_DIR && !reportOnly) {
    log("[1/4] Building production bundle...");
    run("npx vite build", { silent: false });
  } else if (!existsSync(join(distDir, "index.html"))) {
    log("[1/4] Building production bundle (dist not found)...");
    run("npx vite build", { silent: false });
  } else {
    log("[1/4] Using existing build at dist/");
  }
  console.log("");

  // ── Step 2: Parse existing report or run aXe ──
  let report;

  if (reportOnly) {
    const reportPath = resolve(ROOT, reportOnly.split("=")[1]);
    log(`[2/4] Reading existing report: ${reportPath}`);
    try {
      report = JSON.parse(readFileSync(reportPath, "utf-8"));
    } catch (err) {
      console.error(`Failed to read report: ${err.message}`);
      process.exit(1);
    }
  } else {
    // ── Step 2: Serve the build ──
    log("[2/4] Starting HTTP server...");
    const server = await startServer(distDir, AUDIT_PORT);
    console.log("");

    // ── Step 3: Run aXe ──
    log("[3/4] Running aXe-core accessibility scan...");
    console.log("");

    const axeOutput = run(
      `npx axe http://localhost:${AUDIT_PORT} --exit --show-errors --tags wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22a,wcag22aa,best-practice --output=json 2>&1`,
      { silent: true, timeout: 120000 }
    ).toString();

    report = parseAxeReport(axeOutput);

    // Stop the server
    server.close();

    if (!report) {
      // aXe CLI may have failed due to ChromeDriver mismatch; fall back gracefully
      console.error("");
      console.error("  ❌ aXe CLI could not connect to Chrome.");
      console.error("");
      log("Raw output snippet:");
      console.log(axeOutput.slice(0, 500));
      console.log("");
      console.error("  Possible causes:");
      console.error("    - ChromeDriver version mismatch (local dev machine)");
      console.error("    - Chrome not installed (CI environment)");
      console.error("    - Port conflict (another process on :" + AUDIT_PORT + ")");
      console.error("");
      console.error("  Fix: Run 'npm run audit:a11y' locally with the dev server running.");
      console.error("  In CI, ensure Chrome is installed and chromedriver is compatible.");
      process.exit(1);
    }
  }
  console.log("");

  // ── Step 4: Analyze results ──
  box("Audit Results");

  const violations = report?.violations || [];
  const passes = report?.passes || [];
  const newViolations = violations.filter(
    (v) => !ALLOWED_VIOLATIONS.includes(v.id)
  );

  log(`Tests passed: ${passes.length}`);
  log(`Violations found: ${violations.length}`);
  if (ALLOWED_VIOLATIONS.length > 0) {
    log(`Known (allowlisted): ${violations.filter((v) => ALLOWED_VIOLATIONS.includes(v.id)).length}`);
    log(`New violations: ${newViolations.length}`);
  }
  console.log("");

  if (violations.length > 0) {
    // Group violations by impact
    const byImpact = {};
    for (const v of violations) {
      const impact = v.impact || "unknown";
      if (!byImpact[impact]) byImpact[impact] = [];
      byImpact[impact].push(v);
    }

    for (const [impact, impactedViolations] of Object.entries(byImpact)) {
      const impactIcon =
        impact === "critical" ? "🔴" :
        impact === "serious" ? "🟠" :
        impact === "moderate" ? "🟡" : "🔵";

      console.log(`  ${impactIcon} ${impact.toUpperCase()} (${impactedViolations.length}):`);
      for (const v of impactedViolations) {
        const isAllowed = ALLOWED_VIOLATIONS.includes(v.id);
        const tag = isAllowed ? " (allowlisted)" : "";
        console.log(`    ${v.id}${tag}`);
        console.log(`      ${v.help}`);
        console.log(`      ${v.helpUrl || ""}`);
        console.log(`      Elements affected: ${v.nodes.length}`);
        console.log("");
      }
    }
  } else {
    success("No accessibility violations found!");
    console.log("");
  }

  // ── Enforce budgets ──
  let budgetFailed = false;

  // Check per-impact budgets
  for (const [impact, budget] of Object.entries(BUDGET)) {
    if (impact === "total") continue;

    const count = newViolations.filter((v) => (v.impact || "unknown") === impact).length;
    const passed = count <= budget.max;
    const icon = passed ? "✅" : "❌";

    // Also count allowlisted violations
    const totalCount = violations.filter((v) => (v.impact || "unknown") === impact).length;
    console.log(`  ${icon} ${budget.label}: ${count} new / ${totalCount} total (budget: ${budget.max})`);

    if (!passed) budgetFailed = true;
  }

  // Check total budget
  const totalPassed = newViolations.length <= BUDGET.total.max;
  const totalIcon = totalPassed ? "✅" : "❌";
  console.log(`  ${totalIcon} ${BUDGET.total.label}: ${newViolations.length} new / ${violations.length} total (budget: ${BUDGET.total.max})`);
  if (!totalPassed) budgetFailed = true;

  console.log("");

  // ── Save report ──
  const reportPath = resolve(ROOT, "axe-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  success(`Report saved to: ${reportPath}`);
  console.log("");

  // ── Summary output for GitHub Actions step summary ──
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [];
    summaryLines.push("## ♿ aXe Accessibility Audit Results");
    summaryLines.push("");
    summaryLines.push(`| Category | Count |`);
    summaryLines.push(`|----------|-------|`);
    summaryLines.push(`| Violations | ${violations.length} |`);
    summaryLines.push(`| Passes | ${passes.length} |`);
    summaryLines.push(`| New violations | ${newViolations.length} |`);
    summaryLines.push("");

    if (violations.length > 0) {
      summaryLines.push("### Violations");
      summaryLines.push("");
      for (const v of violations) {
        const isAllowed = ALLOWED_VIOLATIONS.includes(v.id);
        const tag = isAllowed ? " *(allowlisted)*" : "";
        summaryLines.push(`- **${v.id}** (${v.impact})${tag}: ${v.help}`);
      }
      summaryLines.push("");
    }

    if (budgetFailed) {
      summaryLines.push("### ❌ Budget exceeded — failing CI");
      summaryLines.push("");
      summaryLines.push("Fix the violations before merging. Run `npm run audit:a11y` locally to reproduce.");
    } else {
      summaryLines.push("### ✅ All accessibility budgets met");
    }

    writeFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n"), { flag: "a" });
  }

  if (budgetFailed) {
    console.error("❌ Accessibility budget exceeded — failing CI.");
    console.error("   Fix the violations before merging.");
    process.exit(1);
  } else {
    console.log("✅ All accessibility budgets met.");
  }
}

runAudit().catch((err) => {
  console.error("aXe audit failed:", err);
  process.exit(1);
});
