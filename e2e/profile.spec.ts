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

/** Filter out expected backend errors that occur without a real backend */
const filterExpectedErrors = (errors: string[]) =>
  errors.filter((msg) => {
    if (msg.includes("is not authorized for OAuth operations")) return false;
    if (msg.includes("Source map") || msg.includes("source map")) return false;
    if (msg.includes("favicon.ico")) return false;
    if (msg.includes("Missing or insufficient permissions")) return false;
    if (msg.includes("500") || msg.includes("401") || msg.includes("Internal Server Error") || msg.includes("Server error") || msg.includes("Unauthorized")) return false;
    if (msg.includes("frame-ancestors")) return false;
    return true;
  });

// ── Profile Page — Rendering ──

test.describe("Profile page — renders correctly", () => {
  test("loads profile with mock auth and zero console errors", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/profile");

    // Wait for profile content to render
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });
    await page.waitForSelector("text=Recent Activity", { timeout: 10000 });

    // Wait for lazy-loaded gamification components
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/profile-loaded.png", fullPage: true });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("displays user profile information", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");

    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Display name
    await expect(page.locator("text=Test Guardian").first()).toBeVisible();

    // Email
    await expect(page.locator("text=test@example.com").first()).toBeVisible();

    // Handle derived from display name
    await expect(page.locator("text=@testuser").first()).toBeVisible();
  });

  test("displays stats row with XP, rank, labs, and streak", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");

    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Stats section labels
    await expect(page.locator("text=XP").first()).toBeVisible();
    await expect(page.locator("text=Rank").first()).toBeVisible();
    await expect(page.locator("text=Labs").first()).toBeVisible();
    await expect(page.locator("text=Streak").first()).toBeVisible();
  });

  test("displays gamification components", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");

    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Gamification sections should render (data-testid from mocked components)
    await expect(page.locator("[data-testid='xp-bar']")).toBeVisible();
    await expect(page.locator("[data-testid='streak-counter']")).toBeVisible();
    await expect(page.locator("[data-testid='badge-display']")).toBeVisible();
    await expect(page.locator("[data-testid='leaderboard-card']")).toBeVisible();
  });

  test("displays recent activity section", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");

    await page.waitForSelector("text=Recent Activity", { timeout: 20000 });

    // Recent activity should show at least one item (from gamification snapshot)
    const activityItems = page.locator("[role='listitem']");
    await expect(activityItems.first()).toBeVisible();
  });

  test("shows avatar with first letter of display name", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");

    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Avatar shows first letter uppercase: "T"
    const avatarText = page.locator("text=T").first();
    await expect(avatarText).toBeVisible();
  });
});

// ── Profile Page — Actions ──

test.describe("Profile page — actions", () => {
  test("back button navigates to previous page", async ({ page }) => {
    await enableMockAuth(page);

    // Go to dashboard first, then profile
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });
    await page.goto("/profile");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Click back button
    await page.locator("text=Back").click();

    // Should navigate back to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("settings button navigates to security page", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Click Settings button
    await page.locator("text=Settings").click();

    // Should navigate to security settings
    await page.waitForURL("**/security", { timeout: 10000 });
    await expect(page).toHaveURL(/\/security/);
  });

  test("logout button is visible and clickable", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Logout button should be visible
    const logoutBtn = page.locator("text=Logout");
    await expect(logoutBtn).toBeVisible();

    // Click logout — should redirect to home
    await logoutBtn.click();
    await page.waitForURL("**/", { timeout: 10000 });
    await expect(page).toHaveURL(/\/$/);
  });
});

// ── Profile Page — Resilience ──

test.describe("Profile page — resilience", () => {
  test("handles page refresh without crashing", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/profile");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Full page refresh
    await page.reload();
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Profile should still be intact
    await expect(page.locator("text=Recent Activity")).toBeVisible();
  });

  test("navigates from dashboard to profile and back without crashing", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Navigate to profile via sidebar
    await page.goto("/profile");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Navigate back to dashboard
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });
});
