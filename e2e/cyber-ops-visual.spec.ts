import { test, expect, Page } from "@playwright/test";

/**
 * Comprehensive browser preview test for the ZeroDay Guardian Cyber Operations Academy.
 *
 * Verifies the immersive visual feel across key pages:
 * - LandingHero: terminal boot sequence, system status grid, CTAs, rank display
 * - Dashboard (mock auth): Mission Control layout, telemetry, quick actions, intel feed
 * - Global: animated background, glass cards, cyber grid pattern, typography
 *
 * This is a visual QA/debugging test — it takes screenshots at each stage
 * so you can review the actual rendered output.
 */

const SCREENSHOT_DIR = "e2e/screenshots";

/** Set up mock auth via auth_state for pages that require authentication */
const enableMockAuth = (page: Page) => {
  return page.addInitScript(() => {
    const mockUser = { id: "test-user-1", name: "Test Guardian", email: "test@zerodayguardian.com", role: "user" };
    localStorage.setItem("auth_state", JSON.stringify({ isAuthenticated: true, user: mockUser, timestamp: Date.now(), accessToken: "test-access-token-e2e" }));
    localStorage.setItem("zdg_token", "test-access-token-e2e");
  });
};

/** Wait for hero to render and boot animation to start */
const waitForHero = async (page: Page) => {
  await page.locator("h1").filter({ hasText: "Cyber Operations" }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1000);
};

test.describe("LandingHero — Terminal + Cyber Ops Feel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
  });

  test("full-page visual at complete load", async ({ page }) => {
    await waitForHero(page);
    // Wait for terminal boot to finish (6 terminal lines, last at 5200ms + buffer)
    await page.waitForTimeout(8000);

    // Full-page screenshot capturing the entire hero section
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/cyber-ops-hero-full.png`,
      fullPage: false,
    });

    // Verify key visual elements define the cyber ops feel
    await expect(page.getByText("ZORVIX AI Operations Center").first()).toBeVisible();
    await expect(page.getByText("Enter the").first()).toBeVisible();
    await expect(page.getByText("Deploy Free Mission").first()).toBeVisible();
    await expect(page.getByText("SYSTEM").first()).toBeVisible();
    await expect(page.getByText("ONLINE").first()).toBeVisible();
    await expect(page.getByText("Current Rank").first()).toBeVisible();
    await expect(page.getByText("zdg-terminal").first()).toBeVisible();
    await expect(page.getByText("ZeroDay Guardian initialized").first()).toBeVisible();
  });

  test("terminal has correct styling and boot animation", async ({ page }) => {
    await waitForHero(page);
    await page.waitForTimeout(8000);

    // Terminal window structure
    await expect(page.getByText("zdg-terminal").first()).toBeVisible();

    // Boot sequence lines present
    await expect(page.getByText("Initializing ZeroDay Guardian").first()).toBeVisible();
    await expect(page.getByText("ZORVIX v3.2.1").first()).toBeVisible();
    await expect(page.getByText("secure uplink").first()).toBeVisible();
    await expect(page.getByText("System ready").first()).toBeVisible();

    // Screenshot specific to terminal area
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/cyber-ops-terminal.png`,
      fullPage: false,
    });
  });

  test("system status indicators and rank display", async ({ page }) => {
    await waitForHero(page);
    await page.waitForTimeout(8000);

    // System status grid
    await expect(page.getByText("SYSTEM").first()).toBeVisible();
    await expect(page.getByText("AI CORE").first()).toBeVisible();
    await expect(page.getByText("THREAT LEVEL").first()).toBeVisible();
    await expect(page.getByText("NETWORK").first()).toBeVisible();

    // Status values
    await expect(page.getByText("ONLINE").first()).toBeVisible();
    await expect(page.getByText("ACTIVE").first()).toBeVisible();
    await expect(page.getByText("GUIDED").first()).toBeVisible();
    await expect(page.getByText("SECURE").first()).toBeVisible();

    // Rank + next mission info
    await expect(page.getByText("Current Rank").first()).toBeVisible();
    await expect(page.getByText("🪖 Recruit").first()).toBeVisible();
    await expect(page.getByText("Next Mission").first()).toBeVisible();
    await expect(page.getByText("Recon Initiation").first()).toBeVisible();
  });

  test("value props row with cyber styling", async ({ page }) => {
    await waitForHero(page);
    await page.waitForTimeout(8000);

    // All four value props
    await expect(page.getByText("60+ Missions").first()).toBeVisible();
    await expect(page.getByText("AI Mentor").first()).toBeVisible();
    await expect(page.getByText("Live Labs").first()).toBeVisible();
    await expect(page.getByText("Rank System").first()).toBeVisible();
  });
});

test.describe("Dashboard — Mission Control Center Layout", () => {
  test.beforeEach(async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/dashboard", { waitUntil: "load" });
  });

  test("full-page screenshot of dashboard Mission Control", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(3000);

    // Full-page screenshot of the dashboard
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/cyber-ops-dashboard-full.png`,
      fullPage: true,
    });
  });

  test("sidebar operations panel", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Sidebar items
    await expect(page.getByText("Command Center").first()).toBeVisible();
    await expect(page.getByText("AI Mentor").first()).toBeVisible();
    await expect(page.getByText("Operations").first()).toBeVisible();
    await expect(page.getByText("Combat Labs").first()).toBeVisible();
    await expect(page.getByText("Briefings").first()).toBeVisible();
    await expect(page.getByText("Intel Network").first()).toBeVisible();
    await expect(page.getByText("Operator Profile").first()).toBeVisible();

    // Branding in sidebar
    await expect(page.getByText("ZDG:").first()).toBeVisible();
    await expect(page.getByText("Command Interface").first()).toBeVisible();
  });

  test("command center header with greeting and system status", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // Command Center header
    await expect(page.getByText("COMMAND CENTER").first()).toBeVisible();
    await expect(page.getByText("ALL SYSTEMS OPERATIONAL").first()).toBeVisible();

    // System status telemetry grid
    await expect(page.getByText("Command Core").first()).toBeVisible();
    await expect(page.getByText("AI Uplink").first()).toBeVisible();
    await expect(page.getByText("Network").first()).toBeVisible();
    await expect(page.getByText("Threat Feed").first()).toBeVisible();
  });

  test("active mission briefing section", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    await expect(page.getByText("Active Operation").first()).toBeVisible();
    await expect(page.getByText("Advance to").first()).toBeVisible();
  });

  test("telemetry stats grid", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    await expect(page.getByText("Total XP").first()).toBeVisible();
    await expect(page.getByText("Streak").first()).toBeVisible();
    await expect(page.getByText("Rank").first()).toBeVisible();
  });

  test("quick deploy actions", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    await expect(page.getByText("Quick Deploy").first()).toBeVisible();
    await expect(page.getByText("AI Mentor").nth(1)).toBeVisible();
    await expect(page.getByText("Combat Lab").first()).toBeVisible();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/cyber-ops-dashboard-quick-actions.png`,
      fullPage: false,
    });
  });

  test("operator progress section with gamification", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    await expect(page.getByText("Operator Progress").first()).toBeVisible();
  });

  test("intel feed activity log", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    await expect(page.getByText("Intel Feed").first()).toBeVisible();

    // Activity items
    await expect(page.getByText("Threat scan completed").first()).toBeVisible();
    await expect(page.getByText("Weekly intel report generated").first()).toBeVisible();
  });

  test("cyber ops visual elements — animations and background", async ({ page }) => {
    await page.getByText("COMMAND CENTER").first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(3000);

    // Screenshot for visual review of animations and background
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/cyber-ops-dashboard-mid-scroll.png`,
      fullPage: false,
    });

    // Verify animated elements are present
    await expect(page.getByText("Total XP").first()).toBeVisible();
    await expect(page.getByText("Quick Deploy").first()).toBeVisible();
  });
});

test.describe("Global Cyber Ops Feel", () => {
  test("homepage full-page capture for visual review", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("h1").filter({ hasText: "Cyber Operations" }).first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(5000);

    // Full page screenshot of the homepage
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/cyber-ops-homepage-full.png`,
      fullPage: true,
    });
  });
});
