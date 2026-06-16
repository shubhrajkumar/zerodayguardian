#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# validate-ui.sh — Automated UI quality validation suite
# Runs typecheck, build, and basic Lighthouse audit checks.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        ZeroDay Guardian UI Validation       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: TypeScript check ──
echo -e "${YELLOW}[1/4] Running TypeScript typecheck...${NC}"
if npx tsc --noEmit --strict --noUnusedLocals false --noUnusedParameters false --skipLibCheck 2>&1; then
  echo -e "${GREEN}  ✅ TypeScript check passed${NC}"
else
  echo -e "${RED}  ❌ TypeScript errors found. Review above.${NC}"
  exit 1
fi
echo ""

# ── Step 2: Build (Vite) ──
echo -e "${YELLOW}[2/4] Running production build...${NC}"
if npm run build 2>&1; then
  echo -e "${GREEN}  ✅ Build successful${NC}"
else
  echo -e "${RED}  ❌ Build failed. Check errors above.${NC}"
  exit 1
fi
echo ""

# ── Step 3: Bundle output check ──
echo -e "${YELLOW}[3/4] Checking build output...${NC}"
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
  echo -e "${GREEN}  ✅ dist/index.html exists${NC}"
  # Check that JS bundles exist
  JS_COUNT=$(find dist/assets -name '*.js' 2>/dev/null | wc -l)
  CSS_COUNT=$(find dist/assets -name '*.css' 2>/dev/null | wc -l)
  echo -e "${GREEN}  📦 ${JS_COUNT} JS bundles, ${CSS_COUNT} CSS bundles${NC}"
  echo -e "${GREEN}  📦 Total size: $(du -sh dist | cut -f1)${NC}"
else
  echo -e "${RED}  ❌ Build output missing dist/index.html${NC}"
  exit 1
fi
echo ""

# ── Step 4: CSP header verification ──
echo -e "${YELLOW}[4/4] Checking Security Headers (vercel.json)...${NC}"
if grep -q "Content-Security-Policy" vercel.json 2>/dev/null; then
  echo -e "${GREEN}  ✅ CSP header defined in vercel.json${NC}"
else
  echo -e "${YELLOW}  ⚠️  CSP header not found in vercel.json${NC}"
fi
if grep -q "Strict-Transport-Security" vercel.json 2>/dev/null; then
  echo -e "${GREEN}  ✅ HSTS header defined in vercel.json${NC}"
else
  echo -e "${YELLOW}  ⚠️  HSTS header not found in vercel.json${NC}"
fi
echo ""

# ── Step 5: Lighthouse audit (if lighthouse CLI is available) ──
echo -e "${YELLOW}[5/4] Running optional Lighthouse audit...${NC}"
if command -v npx lighthouse &>/dev/null || npx --yes lighthouse --help &>/dev/null 2>&1; then
  LIGHTHOUSE_REPORT="lighthouse-report-$(date +%Y%m%d-%H%M%S).html"
  if npx lighthouse "${VERCEL_URL:-http://localhost:8080}" \
    --view \
    --output=html \
    --output-path="${LIGHTHOUSE_REPORT}" \
    --only-categories=performance,accessibility,best-practices \
    --chrome-flags="--headless --no-sandbox" 2>&1; then
    echo -e "${GREEN}  ✅ Lighthouse audit complete: ${LIGHTHOUSE_REPORT}${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Lighthouse audit skipped (requires running dev server on :8080)${NC}"
  fi
else
  echo -e "${YELLOW}  ⚠️  Lighthouse CLI not available. Run: npm i -g lighthouse${NC}"
fi
echo ""

echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        🎉 UI Validation Complete!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
