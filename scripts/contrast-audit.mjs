// ── WCAG 2.2 AA Color Contrast Auditor ──
// Computes contrast ratios for all text-on-background combinations
// Thresholds: normal text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};

const linearize = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const relativeLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
};

const contrastRatio = (hex1, hex2) => {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

const wcagLevel = (ratio, size) => {
  const aa = size === "large" ? 3.0 : 4.5;
  const aaa = size === "large" ? 4.5 : 7.0;
  if (ratio >= aaa) return "AAA ✅";
  if (ratio >= aa) return `AA ✅`;
  if (ratio >= 3.0) return "AA-large ✅";
  return "FAIL ❌";
};

const report = [];

const addCheck = (label, fg, bg, size = "normal") => {
  const ratio = contrastRatio(fg, bg);
  const level = wcagLevel(ratio, size);
  report.push({
    label,
    fg,
    bg,
    ratio: ratio.toFixed(2),
    level,
    size,
  });
};

// ── DARK THEME ──
const D = {
  bg: "#0a0a0f",
  surface: "#12121a",
  card: "#1a1a2e",
  text: "#e0e0f0",
  muted: "#8888aa",
  dim: "#555577",
  accent: "#00d4ff",
  green: "#00ff88",
  red: "#ff3355",
  border: "#2a2a3e",
};

console.log("\n═══ DARK THEME ═══\n");

// Primary foreground on backgrounds
addCheck("Body text on bg", D.text, D.bg);
addCheck("Muted text on bg", D.muted, D.bg);
addCheck("Dim text on bg", D.dim, D.bg);
addCheck("Accent on bg", D.accent, D.bg);
addCheck("Green on bg", D.green, D.bg);
addCheck("Red on bg", D.red, D.bg);

// Text on surface
addCheck("Body text on surface", D.text, D.surface);
addCheck("Muted text on surface", D.muted, D.surface);
addCheck("Dim text on surface", D.dim, D.surface);

// Text on card
addCheck("Body text on card", D.text, D.card);
addCheck("Muted text on card", D.muted, D.card);
addCheck("Dim text on card", D.dim, D.card);
addCheck("Accent on card", D.accent, D.card);
addCheck("Green on card", D.green, D.card);
addCheck("Red on card", D.red, D.card);

// Borders on backgrounds
addCheck("Border on bg", D.border, D.bg, "ui");
addCheck("Border on surface", D.border, D.surface, "ui");

// Color legacy variables
addCheck("color-text-muted (#475569) on bg", "#475569", D.bg);
addCheck("color-text-secondary (#94a3b8) on bg", "#94a3b8", D.bg);
addCheck("color-text-primary (#e2e8f0) on bg", "#e2e8f0", D.bg);
addCheck("zdg-muted (#64748b) on zdg-bg", "#64748b", D.bg);

// Button text
addCheck("btn-cyber text (#0a0a0f) on accent bg (#00d4ff)", "#0a0a0f", D.accent);
addCheck("btn-cyber-green text (#0a0a0f) on green bg (#00ff88)", "#0a0a0f", D.green);
addCheck("btn-cyber-ghost muted text on bg", D.muted, D.bg);
addCheck("btn-cyber-outline accent text on bg", D.accent, D.bg);

// Input placeholder
addCheck("Input placeholder (dim) on surface", D.dim, D.surface);

// Tag
addCheck("Tag accent text on tag bg (rgba blend approx)", D.accent, "#0f1733");
addCheck("Color tag-text (#00d4ff) on card", D.accent, D.card);

// ── LIGHT THEME ──
const L = {
  bg: "#f0f2f5",
  surface: "#ffffff",
  card: "#ffffff",
  text: "#1a1a2e",
  muted: "#64748b",
  dim: "#94a3b8",
  accent: "#0077b6",
  green: "#059669",
  red: "#dc2626",
  border: "#d1d5db",
};

console.log("\n═══ LIGHT THEME ═══\n");

// Primary foreground on backgrounds
addCheck("Body text on bg", L.text, L.bg);
addCheck("Muted text on bg", L.muted, L.bg);
addCheck("Dim text on bg", L.dim, L.bg);
addCheck("Accent on bg", L.accent, L.bg);
addCheck("Green on bg", L.green, L.bg);
addCheck("Red on bg", L.red, L.bg);

// Text on surface (white)
addCheck("Body text on surface", L.text, L.surface);
addCheck("Muted text on surface", L.muted, L.surface);
addCheck("Dim text on surface", L.dim, L.surface);

// Text on card (white)
addCheck("Body text on card", L.text, L.card);
addCheck("Muted text on card", L.muted, L.card);
addCheck("Dim text on card", L.dim, L.card);
addCheck("Accent on card", L.accent, L.card);
addCheck("Green on card", L.green, L.card);
addCheck("Red on card", L.red, L.card);

// Borders on backgrounds
addCheck("Border on bg", L.border, L.bg, "ui");
addCheck("Border on surface", L.border, L.surface, "ui");
addCheck("Border on card", L.border, L.card, "ui");

// Color legacy variables
addCheck("color-text-muted (#64748b) on bg (#f8fafc)", "#64748b", "#f8fafc");
addCheck("color-text-secondary (#334155) on bg (#f8fafc)", "#334155", "#f8fafc");
addCheck("color-text-primary (#0f172a) on bg (#f8fafc)", "#0f172a", "#f8fafc");

// Button text
addCheck("btn-primary text (#fff) on btn-bg (#0066cc)", "#ffffff", "#0066cc");
addCheck("btn-primary text (#fff) on btn-bg (#0066cc) large", "#ffffff", "#0066cc", "large");
addCheck("btn-ghost text on bg", L.text, L.bg);
addCheck("btn-outline accent text on bg", L.accent, L.bg);

// Tag
addCheck("Tag accent text on light bg", L.accent, "#eef4ff");
addCheck("Tag text (#0066cc) on card", "#0066cc", L.card);

// Input placeholder
addCheck("Input placeholder (dim) on surface", L.dim, L.surface);

// ── Print Report ──
console.log("\n═══════════════════════════════════════════");
console.log("WCAG 2.2 AA COLOR CONTRAST AUDIT REPORT");
console.log("═══════════════════════════════════════════\n");

const fails = report.filter((r) => r.level.includes("FAIL"));
const passes = report.filter((r) => !r.level.includes("FAIL"));

for (const r of report) {
  console.log(`[${r.level}] ${r.ratio}:1  ${r.label}`);
}

console.log(`\n────────────────────────────────────`);
console.log(`Total: ${report.length} | Pass: ${passes.length} | Fail: ${fails.length}`);
console.log(`────────────────────────────────────\n`);

if (fails.length > 0) {
  console.log("═══ FAILURES TO FIX ═══\n");
  for (const f of fails) {
    console.log(`❌ [${f.ratio}:1] ${f.label} (size: ${f.size})`);
    console.log(`   fg: ${f.fg}  bg: ${f.bg}`);
  }
} else {
  console.log("✅ All combinations pass WCAG 2.2 AA!");
}
