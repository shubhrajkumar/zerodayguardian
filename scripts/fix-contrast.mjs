// ── WCAG Color Fix Calculator ──
// Finds the minimum color change needed to pass 4.5:1 for normal text

const hexToRgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

const linearize = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

const luminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
};

const ratio = (fg, bg) => {
  const l1 = luminance(fg), l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// Find lightest color by adjusting brightness to meet target ratio on a dark bg
const findMinimum = (baseHex, bgHex, target, channel = "all") => {
  const base = hexToRgb(baseHex);
  const best = { hex: baseHex, ratio: ratio(baseHex, bgHex) };
  if (best.ratio >= target) return best;

  for (let v = 255; v >= 0; v -= 1) {
    let test;
    if (channel === "b") {
      test = `#${base.r.toString(16).padStart(2, "0")}${base.g.toString(16).padStart(2, "0")}${v.toString(16).padStart(2, "0")}`;
    } else if (channel === "g") {
      test = `#${base.r.toString(16).padStart(2, "0")}${v.toString(16).padStart(2, "0")}${base.b.toString(16).padStart(2, "0")}`;
    } else {
      // All channels proportionally
      const pct = v / 255;
      const nr = Math.round(base.r + (255 - base.r) * pct);
      const ng = Math.round(base.g + (255 - base.g) * pct);
      const nb = Math.round(base.b + (255 - base.b) * pct);
      test = `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
    }
    const r = ratio(test, bgHex);
    if (r >= target) {
      return { hex: test, ratio: parseFloat(r.toFixed(2)) };
    }
  }
  return best;
};

const findMaximum = (baseHex, bgHex, target) => {
  const base = hexToRgb(baseHex);
  const best = { hex: baseHex, ratio: ratio(baseHex, bgHex) };
  if (best.ratio >= target) return best;

  for (let v = 0; v <= 255; v += 1) {
    const pct = 1 - v / 255;
    const nr = Math.round(base.r * pct);
    const ng = Math.round(base.g * pct);
    const nb = Math.round(base.b * pct);
    const test = `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
    const r = ratio(test, bgHex);
    if (r >= target) {
      return { hex: test, ratio: parseFloat(r.toFixed(2)) };
    }
  }
  return best;
};

console.log("═══ DARK THEME FIXES ═══\n");

// 1. --theme-text-dim on --theme-bg (#0a0a0f): need ≥ 4.5:1
const dimBg = "#0a0a0f";
const dimSurface = "#12121a";
const dimCard = "#1a1a2e";
const dimBase = "#555577";

console.log("Current --theme-text-dim (#555577) ratios:");
console.log(`  on bg (#0a0a0f): ${ratio(dimBase, dimBg).toFixed(2)}:1`);
console.log(`  on surface (#12121a): ${ratio(dimBase, dimSurface).toFixed(2)}:1`);
console.log(`  on card (#1a1a2e): ${ratio(dimBase, dimCard).toFixed(2)}:1`);

// Find min for card (darkest bg = hardest to pass)
const minDim = findMinimum(dimBase, dimCard, 4.5, "all");
console.log(`\nMinimum dim to pass on card: ${minDim.hex} (${minDim.ratio}:1)`);
console.log(`  on bg (#0a0a0f): ${ratio(minDim.hex, dimBg).toFixed(2)}:1`);
console.log(`  on surface (#12121a): ${ratio(minDim.hex, dimSurface).toFixed(2)}:1`);
console.log(`  on card (#1a1a2e): ${ratio(minDim.hex, dimCard).toFixed(2)}:1`);

// 2. --color-text-muted (#475569) on --color-bg-primary (#0a0a0f)
const mutedBase = "#475569";
console.log(`\nCurrent --color-text-muted (#475569) on bg: ${ratio(mutedBase, dimBg).toFixed(2)}:1`);
const minMuted = findMinimum(mutedBase, dimBg, 4.5, "all");
console.log(`Minimum: ${minMuted.hex} (${minMuted.ratio}:1)`);

// 3. --theme-border (#2a2a3e) on bg and surface (needs 3:1 for UI)
const borderBase = "#2a2a3e";
console.log(`\nCurrent --theme-border (#2a2a3e) on bg: ${ratio(borderBase, dimBg).toFixed(2)}:1`);
console.log(`  on surface: ${ratio(borderBase, dimSurface).toFixed(2)}:1`);
const minBorder = findMinimum(borderBase, dimSurface, 3.0, "all");
console.log(`Minimum for 3:1 on surface: ${minBorder.hex} (${minBorder.ratio}:1)`);
console.log(`  on bg: ${ratio(minBorder.hex, dimBg).toFixed(2)}:1`);

console.log("\n═══ LIGHT THEME FIXES ═══\n");

// 4. --theme-text-dim (#94a3b8) on light bg (#f0f2f5) and surface (#ffffff)
const lightBg = "#f0f2f5";
const lightSurface = "#ffffff";
const lightCard = "#ffffff";
const lightDim = "#94a3b8";

console.log("Current --theme-text-dim (#94a3b8) ratios:");
console.log(`  on bg (#f0f2f5): ${ratio(lightDim, lightBg).toFixed(2)}:1`);
console.log(`  on surface (#ffffff): ${ratio(lightDim, lightSurface).toFixed(2)}:1`);

const maxDim = findMaximum(lightDim, lightBg, 4.5);
console.log(`\nMinimum dim to pass on bg: ${maxDim.hex} (${maxDim.ratio}:1)`);
console.log(`  on surface (#ffffff): ${ratio(maxDim.hex, lightSurface).toFixed(2)}:1`);
console.log(`  on card (#ffffff): ${ratio(maxDim.hex, lightCard).toFixed(2)}:1`);

// 5. --theme-border (#d1d5db) on light bg
const lightBorder = "#d1d5db";
console.log(`\nCurrent --theme-border (#d1d5db) on bg: ${ratio(lightBorder, lightBg).toFixed(2)}:1`);
console.log(`  on surface: ${ratio(lightBorder, lightSurface).toFixed(2)}:1`);
const minLightBorder = findMaximum(lightBorder, lightSurface, 3.0);
console.log(`Minimum for 3:1 on surface: ${minLightBorder.hex} (${minLightBorder.ratio}:1)`);
console.log(`  on bg: ${ratio(minLightBorder.hex, lightBg).toFixed(2)}:1`);
