import { test, expect, Page } from "@playwright/test";

/**
 * Collects all console messages of a given type from the page.
 */
const collectConsole = (page: Page, type: "error" | "warning" = "error") => {
  const messages: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === type) {
      messages.push(msg.text());
    }
  });
  return messages;
};

/**
 * Sets up mock auth via addInitScript so the flag is present
 * before ANY JavaScript executes on the page.
 */
const enableMockAuth = (page: Page) => {
  return page.addInitScript(() => {
    localStorage.setItem("zdg_mock_auth", "true");
  });
};

/**
 * E2E tests for the ZeroDay Guardian Dashboard — Mission Control Center.
 *
 * Validates the dashboard renders with the Cyber Operations Academy layout:
 * - Operations sidebar (Command Center, AI Mentor, Operations, etc.)
 * - Command Center header with COMMAND CENTER label
 * - System Status Telemetry grid (Command Core, AI Uplink, Network, Threat Feed)
 * - Active Mission Briefing
 * - Telemetry Stats (Total XP, Streak, Badges, Rank)
 * - Quick Deploy actions (AI Mentor, Combat Lab, Operations, Briefings)
 * - Operator Progress (XPBar, StreakCounter, BadgeDisplay)
 * - Intel Feed (activity log)
 */
test.describe("Dashboard — Mission Control Center", () => {
  test("loads dashboard with mock auth and zero console errors", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");

    // Wait for the dashboard to fully render
    await page.waitForSelector("text=COMMAND CENTER", { timeout: 20000 });
    await page.waitForSelector("text=System Status", { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Screenshot for visual debugging
    await page.screenshot({ path: "e2e/screenshots/dashboard-loaded.png", fullPage: true });

    // Assert: no critical console errors (backend errors expected without real backend)
    const criticalErrors = errors.filter((msg) => {
      if (msg.includes("is not authorized for OAuth operations")) return false;
      if (msg.includes("Source map") || msg.includes("source map")) return false;
      if (msg.includes("favicon.ico")) return false;
      if (msg.includes("Missing or insufficient permissions")) return false;
      if (msg.includes("500") || msg.includes("401") || msg.includes("Internal Server Error") || msg.includes("Server error") || msg.includes("Unauthorized")) return false;
      if (msg.includes("frame-ancestors")) return false;
      return true;
    });

    expect(criticalErrors).toEqual([]);
  });

  test("dashboard renders all key Mission Control sections", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/dashboard");

    // Wait for critical content
    await page.waitForSelector("text=COMMAND CENTER", { timeout: 20000 });
    await expect(page).toHaveURL(/\/dashboard/);

    // ── Sidebar ──
    await expect(page.locator("text=Command Center").first()).toBeAttached();
    await expect(page.locator("text=AI Mentor").first()).toBeAttached();
    await expect(page.locator("text=Operations").first()).toBeAttached();
    await expect(page.locator("text=Combat Labs").first()).toBeAttached();

    // ── Command Center Header ──
    await expect(page.locator("text=COMMAND CENTER").first()).toBeVisible();

    // ── System Status Telemetry ──
    await expect(page.locator("text=Command Core")).toBeVisible();
    await expect(page.locator("text=AI Uplink")).toBeVisible();
    await expect(page.locator("text=Network").first()).toBeVisible();
    await expect(page.locator("text=Threat Feed")).toBeVisible();

    // ── Active Mission Briefing ──
    await expect(page.locator("text=Active Operation").first()).toBeVisible();

    // ── Telemetry Stats ──
    await expect(page.locator("text=Total XP").first()).toBeVisible();
    await expect(page.locator("text=Streak").first()).toBeVisible();
    await expect(page.locator("text=Badges").first()).toBeVisible();
    await expect(page.locator("text=Rank").first()).toBeVisible();

    // ── Quick Deploy Actions ──
    await expect(page.locator("text=Quick Deploy").first()).toBeVisible();
    await expect(page.locator("text=AI Mentor").nth(1)).toBeVisible();
    await expect(page.locator("text=Combat Lab").first()).toBeVisible();

    // ── Operator Progress ──
    await expect(page.locator("text=Operator Progress").first()).toBeVisible();

    // ── Intel Feed ──
    await expect(page.locator("text=Intel Feed").first()).toBeVisible();
  });
});

test.describe("Dashboard — resilience", () => {
  test("handles route refresh without crashing", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/dashboard");
    await page.waitForSelector("text=COMMAND CENTER", { timeout: 20000 });

    // Full page refresh
    await page.reload();
    await page.waitForSelector("text=COMMAND CENTER", { timeout: 20000 });

    // Dashboard should still be intact
    await expect(page.locator("text=System Status").first()).toBeVisible();
    await expect(page.locator("text=Quick Deploy").first()).toBeVisible();
  });

  test("navigates between pages and back without crashing", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");
    await page.waitForSelector("text=COMMAND CENTER", { timeout: 20000 });

    // Navigate to assistant via direct URL
    await page.goto("/assistant");
    await page.waitForURL("**/assistant", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate back to dashboard
    await page.goto("/dashboard");
    await page.waitForSelector("text=COMMAND CENTER", { timeout: 20000 });

    // No critical console errors
    const criticalErrors = errors.filter(
      (msg) =>
        !msg.includes("is not authorized for OAuth operations") &&
        !msg.includes("source map") &&
        !msg.includes("favicon") &&
        !msg.includes("Missing or insufficient permissions") &&
        !msg.includes("500") &&
        !msg.includes("401") &&
        !msg.includes("Internal Server Error") &&
        !msg.includes("Server error") &&
        !msg.includes("Unauthorized") &&
        !msg.includes("frame-ancestors")
    );
    expect(criticalErrors).toEqual([]);
  });
});
