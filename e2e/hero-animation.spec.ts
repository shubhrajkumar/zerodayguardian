import { test, expect, Page } from "@playwright/test";

/**
 * E2E visual snapshot test for the LandingHero cyber ops terminal effect.
 *
 * The hero was transformed into a Command Center with:
 * - Terminal typing animation (boot sequence)
 * - System status grid (SYSTEM, AI CORE, THREAT LEVEL, NETWORK)
 * - Value props row (60+ Missions, AI Mentor, Live Labs, Rank System)
 * - CTAs: "Deploy Free Mission", "Career Paths"
 * - Rank display + Next Mission info
 *
 * The hero section is on the public homepage, so no auth is needed.
 */

/** Wait for hero heading to render (framer-motion h1 committed to DOM) */
const waitForHeroArmed = async (page: Page) => {
  await page.locator("h1").filter({ hasText: "Cyber Operations" }).first().waitFor({ timeout: 15000 });
};

/**
 * Check if the page rendered an error boundary instead of the app.
 * Call this before waiting for hero content so failures produce
 * a clear message instead of a silent timeout.
 */
const ensureAppRender = async (page: Page) => {
  const hasContent = await page.evaluate(() => {
    const body = document.body;
    return body && body.textContent && body.textContent.length > 0;
  });
  if (!hasContent) throw new Error("Page appears blank — app may have crashed");
  const errorText = await page.getByText("ErrorBoundary").first().isVisible().catch(() => false);
  if (errorText) throw new Error("App crashed with an error boundary");
};

/**
 * Dynamically wait for terminal text to appear by polling the DOM.
 * The terminal boot animation types out lines with random delays,
 * so fixed timeouts are unreliable.
 */
const waitForTerminalText = async (page: Page, text: string, timeout = 20000) => {
  await ensureAppRender(page);
  await page.waitForFunction(
    (searchText: string) => {
      // Search all div elements for the target text
      const allDivs = document.querySelectorAll("div");
      for (const el of allDivs) {
        if (el.textContent?.includes(searchText)) return true;
      }
      return false;
    },
    text,
    { timeout }
  );
};

test.describe("Hero animation — terminal boot + staggered entrance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
  });

  test("captures visual snapshots at boot stages", async ({ page }) => {
    await waitForHeroArmed(page);

    // ── Stage 0: t=~50ms ──
    await page.waitForTimeout(50);
    await page.screenshot({ path: "e2e/screenshots/hero-t0.png", fullPage: false });

    // ── Stage 1: t=~2000ms - CTAs should be attached ──
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "e2e/screenshots/hero-booting.png", fullPage: false });
    await expect(page.getByText("Deploy Free Mission").first()).toBeAttached();
    await expect(page.getByText("Career Paths").first()).toBeAttached();

    // ── Stage 2: t=~6000ms - Content visible ──
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "e2e/screenshots/hero-boot-complete.png", fullPage: false });
    await expect(page.getByText("Enter the").first()).toBeAttached();
    await expect(page.getByText("Cyber Operations").first()).toBeAttached();

    // ── Stage 3: Wait for terminal boot to finish dynamically ──
    await waitForTerminalText(page, "ZeroDay Guardian initialized");
    await page.waitForTimeout(500); // let animations settle
    await page.screenshot({ path: "e2e/screenshots/hero-terminal-booted.png", fullPage: false });

    // Value props should be visible
    await expect(page.getByText("60+ Missions").first()).toBeAttached();
    await expect(page.getByText("AI Mentor").first()).toBeAttached();
    await expect(page.getByText("Live Labs").first()).toBeAttached();
    await expect(page.getByText("Rank System").first()).toBeAttached();

    // Terminal boot should be complete
    await expect(page.getByText("ZeroDay Guardian initialized").first()).toBeAttached();

    // System status indicators
    await expect(page.getByText("SYSTEM").first()).toBeAttached();
    await expect(page.getByText("AI CORE").first()).toBeAttached();
    await expect(page.getByText("THREAT LEVEL").first()).toBeAttached();
    await expect(page.getByText("NETWORK").first()).toBeAttached();
  });

  test("terminal boot sequence completes with all lines", async ({ page }) => {
    await waitForHeroArmed(page);

    // Wait dynamically for each terminal line to appear
    await waitForTerminalText(page, "Initializing ZeroDay Guardian");
    await waitForTerminalText(page, "ZORVIX v3.2.1");
    await waitForTerminalText(page, "secure uplink");
    await waitForTerminalText(page, "ZeroDay Guardian initialized");

    // Verify all lines are attached
    await expect(page.getByText("Initializing ZeroDay Guardian").first()).toBeAttached();
    await expect(page.getByText("ZORVIX v3.2.1").first()).toBeAttached();
    await expect(page.getByText("secure uplink").first()).toBeAttached();
    await expect(page.getByText("ZeroDay Guardian initialized").first()).toBeAttached();
  });

  test("all key visual elements present after full load", async ({ page }) => {
    await waitForHeroArmed(page);
    // Wait for terminal boot dynamically, then let everything settle
    await waitForTerminalText(page, "ZeroDay Guardian initialized");
    await page.waitForTimeout(1000);

    // Headline
    await expect(page.getByText("Enter the").first()).toBeVisible();
    await expect(page.getByText("Cyber Operations").first()).toBeVisible();

    // CTAs visible
    await expect(page.getByText("Deploy Free Mission").first()).toBeVisible();
    await expect(page.getByText("Career Paths").first()).toBeVisible();

    // Value props visible
    await expect(page.getByText("60+ Missions").first()).toBeVisible();
    await expect(page.getByText("AI Mentor").first()).toBeVisible();
    await expect(page.getByText("Live Labs").first()).toBeVisible();
    await expect(page.getByText("Rank System").first()).toBeVisible();

    // Terminal visible
    await expect(page.getByText("zdg-terminal").first()).toBeVisible();

    // Rank display visible
    await expect(page.getByText("Current Rank").first()).toBeVisible();
    await expect(page.getByText("🪖 Recruit").first()).toBeVisible();
    await expect(page.getByText("Next Mission").first()).toBeVisible();
    await expect(page.getByText("Recon Initiation").first()).toBeVisible();

    // System status visible
    await expect(page.getByText("ONLINE").first()).toBeVisible();
    await expect(page.getByText("ACTIVE").first()).toBeVisible();
    await expect(page.getByText("SECURE").first()).toBeVisible();
    await expect(page.getByText("GUIDED").first()).toBeVisible();
  });

  test("zero console errors on hero load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.reload({ waitUntil: "load" });
    await waitForHeroArmed(page);
    await waitForTerminalText(page, "ZeroDay Guardian initialized");
    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter((msg) => {
      if (msg.includes("Source map") || msg.includes("source map")) return false;
      if (msg.includes("favicon.ico")) return false;
      if (msg.includes("Sentry") && msg.includes("placeholder")) return false;
      if (msg.includes("React DevTools")) return false;
      if (msg.includes("Vercel Speed Insights")) return false;
      if (msg.includes("Missing or insufficient permissions")) return false;
      if (msg.includes("is not authorized for OAuth operations")) return false;
      return true;
    });

    expect(criticalErrors).toEqual([]);
  });
});
