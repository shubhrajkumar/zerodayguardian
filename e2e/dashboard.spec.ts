import { test, expect, Page } from "@playwright/test";

/**
 * Collects all console messages of a given type from the page.
 * Call this before navigating to start collection.
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
 * before ANY JavaScript executes on the page. Must be called
 * before the first page.goto() in each test.
 */
const enableMockAuth = (page: Page) => {
  return page.addInitScript(() => {
    localStorage.setItem("zdg_mock_auth", "true");
  });
};

/**
 * E2E tests for the ZeroDay Guardian dashboard using mock auth.
 *
 * Validates that the dashboard renders without console errors,
 * displays all key sections, and survives navigation/refresh.
 */
test.describe("Dashboard — no console errors", () => {
  test("loads dashboard with mock auth and zero console errors", async ({ page }) => {
    // Set mock auth BEFORE navigating (runs before page JS)
    await enableMockAuth(page);

    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");

    // Wait for the dashboard to fully render
    await page.waitForSelector("text=Cyber Sentinel", { timeout: 20000 });
    await page.waitForSelector("text=Quick Actions", { timeout: 10000 });
    await page.waitForSelector("text=Recent Activity", { timeout: 10000 });

    // Wait for lazy-loaded components (Zorvix overlay, SentryTestPanel)
    await page.waitForTimeout(3000);

    // Screenshot for visual debugging
    await page.screenshot({ path: "e2e/screenshots/dashboard-loaded.png", fullPage: true });

    // Assert: no critical console errors (backend 500/401 expected without real backend)
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

  test("dashboard renders all key sections", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/dashboard");

    // Wait for critical content
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Stats section — use stat labels for unambiguous matching
    await expect(page.locator("text=1,280")).toBeVisible();
    await expect(page.locator("text=7 days")).toBeVisible();
    await expect(page.locator("text=Badges").first()).toBeVisible();
    await expect(page.locator("text=Cyber Sentinel").first()).toBeVisible();

    // Quick actions
    await expect(page.locator("text=AI Assistant").first()).toBeVisible();
    await expect(page.locator("text=Run Lab")).toBeVisible();
    await expect(page.locator("text=Tools").first()).toBeVisible();
    await expect(page.locator("text=Learn").first()).toBeVisible();

    // Recent activity
    await expect(page.locator("text=Threat scan completed")).toBeVisible();
    await expect(page.locator("text=Weekly report generated")).toBeVisible();
    await expect(page.locator("text=Lab exercise completed")).toBeVisible();

    // System status
    await expect(page.locator("text=System Online")).toBeVisible();
  });
});

test.describe("Dashboard — resilience", () => {
  test("handles route refresh without crashing", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Full page refresh
    await page.reload();
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Dashboard should still be intact
    await expect(page.locator("text=Recent Activity")).toBeVisible();
  });

  test("navigates between pages and back without crashing", async ({ page }) => {
    await enableMockAuth(page);

    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Navigate to assistant via direct URL (avoids React click-handling races)
    await page.goto("/assistant");
    await page.waitForURL("**/assistant", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate back to dashboard
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

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
