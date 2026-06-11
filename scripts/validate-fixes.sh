#!/bin/bash
# No set -e — commands are evaluated via $? for controlled error handling

# ── ZeroDay Guardian Post-Fix Validation Suite ──
# Cyber Rationale: Automated validation reduces human error and ensures
# all critical paths work before deployment.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║   ZeroDay Guardian Validation Suite          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

FAILURES=0
PASSES=0

check_result() {
  local step="$1"
  local exit_code="$2"
  if [ "$exit_code" -eq 0 ]; then
    echo -e "  ${GREEN}✅${NC} $step"
    PASSES=$((PASSES + 1))
  else
    echo -e "  ${RED}❌${NC} $step"
    FAILURES=$((FAILURES + 1))
  fi
}

# ── 1. Node version ──
echo -e "\n${CYAN}[1/7]${NC} Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
echo "  Node: $NODE_VERSION"
check_result "Node.js available" $([ "$NODE_VERSION" != "none" ] && echo 0 || echo 1)

# ── 2. TypeScript typecheck ──
echo -e "\n${CYAN}[2/7]${NC} Running TypeScript typecheck..."
npx tsc -p tsconfig.app.json --noEmit
check_result "TypeScript typecheck" $?

# ── 3. Lint check ──
echo -e "\n${CYAN}[3/7]${NC} Running ESLint..."
npx eslint . --max-warnings 0
check_result "ESLint (0 warnings)" $?

# ── 4. Unit tests ──
echo -e "\n${CYAN}[4/7]${NC} Running unit tests..."
npx vitest run --config vitest.config.mjs --reporter=verbose
check_result "Unit tests" $?

# ── 5. Build test ──
echo -e "\n${CYAN}[5/7]${NC} Testing production build..."
npx vite build
check_result "Production build" $?

# ── 6. Build output verification ──
echo -e "\n${CYAN}[6/7]${NC} Verifying build output..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
  JS_COUNT=$(ls dist/assets/*.js 2>/dev/null | wc -l)
  CSS_COUNT=$(ls dist/assets/*.css 2>/dev/null | wc -l)
  TOTAL_SIZE=$(du -sh dist 2>/dev/null | cut -f1)
  echo "  JS bundles: $JS_COUNT"
  echo "  CSS files: $CSS_COUNT"
  echo "  Total size: $TOTAL_SIZE"
  check_result "Build output verified" 0
else
  echo -e "  ${RED}❌ dist/index.html not found${NC}"
  check_result "Build output verified" 1
fi

# ── 7. Bundle size check ──
echo -e "\n${CYAN}[7/7]${NC} Checking bundle size..."
if [ -f "scripts/bundle-size-check.mjs" ]; then
  node scripts/bundle-size-check.mjs dist
  check_result "Bundle size budget" $?
else
  echo -e "  ${YELLOW}⚠️  bundle-size-check.mjs not found — skipping${NC}"
  check_result "Bundle size budget (skipped)" 0
fi

# ── Summary ──
echo -e "\n${CYAN}══════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASSES${NC}"
echo -e "  ${RED}Failed: $FAILURES${NC}"

if [ "$FAILURES" -eq 0 ]; then
  echo -e "\n  ${GREEN}🎉 All validations passed! ZeroDay Guardian is production-ready.${NC}\n"
  exit 0
else
  echo -e "\n  ${RED}❌ Some validations failed. Review output above.${NC}\n"
  exit 1
fi
