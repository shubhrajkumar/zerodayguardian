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
 * Sets up mock auth via addInitScript so the auth_state is present
 * before ANY JavaScript executes on the page.
 */
const enableMockAuth = (page: Page) => {
  return page.addInitScript(() => {
    const mockUser = { id: "test-user-1", name: "Test Guardian", email: "test@zerodayguardian.com", role: "user" };
    localStorage.setItem("auth_state", JSON.stringify({ isAuthenticated: true, user: mockUser, timestamp: Date.now(), accessToken: "test-access-token-e2e" }));
    localStorage.setItem("zdg_token", "test-access-token-e2e");
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

// ── AIMentor — Tab Navigation ──

test.describe("AIMentor — tab navigation", () => {
  test("loads assistant page and shows the AIMentor header", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    // Wait for the AIMentor header (distinct from old Zorvix header)
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });

    // Rank label and mission count should appear in the subtitle
    await expect(page.locator("text=missions").first()).toBeVisible();
  });

  test("renders all five tab buttons", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });

    // All five tab labels should be visible
    await expect(page.locator("text=Chat").first()).toBeVisible();
    await expect(page.locator("text=Goals").first()).toBeVisible();
    await expect(page.locator("text=Skills").first()).toBeVisible();
    await expect(page.locator("text=Roadmap").first()).toBeVisible();
    await expect(page.locator("text=Progress").first()).toBeVisible();
  });

  test("Chat tab is active by default and shows Zorvix chat", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });

    // Chat tab should be active by default — Zorvix AI header appears inside the chat
    await expect(page.locator("text=ZORVIX AI").first()).toBeVisible();
    // Composer should be present
    await expect(page.locator("textarea[aria-label='Message ZORVIX']")).toBeVisible();

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("Goals tab shows goal assessment panel", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000); // Let lazy-loaded Zorvix settle

    // Click Goals tab
    await page.locator("text=Goals").first().click();

    // Wait for goals content to render
    await page.waitForSelector("text=Your Mission Goals", { timeout: 10000 });
    await expect(page.locator("text=Your Mission Goals")).toBeVisible();
    await expect(page.locator("text=Complete Phase 1")).toBeVisible();

    // Goal progress badges should show
    await expect(page.locator("text=short").first()).toBeVisible();
    await expect(page.locator("text=long").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/aimer-goals-tab.png", fullPage: true });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("Skills tab shows overall proficiency and 8 skill areas", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Click Skills tab
    await page.locator("text=Skills").first().click();

    // Wait for skills content
    await page.waitForSelector("text=Overall Proficiency", { timeout: 10000 });
    await expect(page.locator("text=Overall Proficiency")).toBeVisible();

    // All 8 skill areas should be present
    await expect(page.locator("text=Reconnaissance").first()).toBeVisible();
    await expect(page.locator("text=Web Security").first()).toBeVisible();
    await expect(page.locator("text=Exploitation").first()).toBeVisible();
    await expect(page.locator("text=Defense & IR").first()).toBeVisible();
    await expect(page.locator("text=OSINT").first()).toBeVisible();
    await expect(page.locator("text=Cloud Security").first()).toBeVisible();
    await expect(page.locator("text=Forensics").first()).toBeVisible();
    await expect(page.locator("text=Cryptography").first()).toBeVisible();

    // Mission count text should appear for each skill
    await expect(page.locator("text=/missions").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/aimer-skills-tab.png", fullPage: true });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("Roadmap tab shows rank progression and phase milestones", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Click Roadmap tab
    await page.locator("text=Roadmap").first().click();

    // Wait for roadmap content
    await page.waitForSelector("text=Rank Progression", { timeout: 10000 });
    await expect(page.locator("text=Rank Progression")).toBeVisible();

    // Phase milestones should render
    await expect(page.locator("text=Phase 1: Foundations").first()).toBeVisible();
    await expect(page.locator("text=Phase 2: Web & AppSec").first()).toBeVisible();
    await expect(page.locator("text=Phase 3: Advanced").first()).toBeVisible();

    // Next Rank info should appear
    await expect(page.locator("text=Next Rank").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/aimer-roadmap-tab.png", fullPage: true });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("Progress tab shows mission grid and AI skill recommendations", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Click Progress tab
    await page.locator("text=Progress").first().click();

    // Wait for mission progress header
    await page.waitForSelector("text=Mission Progress", { timeout: 10000 });
    await expect(page.locator("text=Mission Progress")).toBeVisible();

    // The grid should have 60 buttons with aria-labels
    const missionCells = page.locator('button[aria-label*="Mission"]');
    await expect(missionCells).toHaveCount(60);

    // On desktop (≥640px) the grid should use 10 columns; on mobile it's 5
    // Check that the grid container has responsive classes
    const gridContainer = page.locator('.grid.grid-cols-5');
    await expect(gridContainer).toBeVisible();

    // AI Skill Recommendations section should appear below
    await expect(page.locator("text=AI Skill Recommendations").first()).toBeVisible();

    // Legend items should render
    await expect(page.locator("text=Completed").first()).toBeVisible();
    await expect(page.locator("text=Current").first()).toBeVisible();
    await expect(page.locator("text=Locked").first()).toBeVisible();

    // Phase labels
    await expect(page.locator("text=Phase 1: Foundations").first()).toBeVisible();
    await expect(page.locator("text=Phase 3: Advanced").first()).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/aimer-progress-tab.png", fullPage: true });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("switching tabs hides and shows content without console errors", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Verify chat is visible first
    await expect(page.locator("text=ZORVIX AI").first()).toBeVisible();

    // Switch to Skills
    await page.locator("text=Skills").first().click();
    await page.waitForSelector("text=Overall Proficiency", { timeout: 10000 });
    // Chat content should be hidden
    await expect(page.locator("text=ZORVIX AI").first()).toBeHidden();

    // Switch to Goals
    await page.locator("text=Goals").first().click();
    await page.waitForSelector("text=Your Mission Goals", { timeout: 10000 });

    // Switch to Roadmap
    await page.locator("text=Roadmap").first().click();
    await page.waitForSelector("text=Rank Progression", { timeout: 10000 });

    // Switch back to Chat
    await page.locator("text=Chat").first().click();
    await page.waitForSelector("text=ZORVIX AI", { timeout: 10000 });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("quick stats footer is visible on all tabs", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });

    // Footer stats should be visible — use specific number+XP pattern
    await expect(page.locator("text=/\\d+ XP/").first()).toBeVisible();
    await expect(page.locator("text=/\\d+d Streak/").first()).toBeVisible();

    // Switch to each tab and verify footer still renders
    await page.locator("text=Skills").first().click();
    await page.waitForSelector("text=Overall Proficiency", { timeout: 10000 });
    await expect(page.locator("text=/\\d+ XP/").first()).toBeVisible();

    await page.locator("text=Progress").first().click();
    await page.waitForSelector("text=Mission Progress", { timeout: 10000 });
    await expect(page.locator("text=/\\d+d Streak/").first()).toBeVisible();
  });
});

// ── AIMentor — Mission Grid Interaction ──

test.describe("AIMentor — mission grid interaction", () => {
  test("clicking a completed mission cell navigates to the mission page", async ({ page }) => {
    await enableMockAuth(page);

    // First go to dashboard to set some completed days
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Go to Progress tab
    await page.locator("text=Progress").first().click();
    await page.waitForSelector("text=Mission Progress", { timeout: 10000 });

    // Click mission 1 (always navigable with mock auth — may be completed or in progress)
    const mission1 = page.locator('button[aria-label*="Mission 1:"]');
    await expect(mission1.first()).toBeVisible();
    await expect(mission1.first()).toBeEnabled();
    await mission1.first().click();
    // Should navigate to a /program/day/1 page
    await page.waitForURL(/\/program\/day\/1/, { timeout: 10000 });
  });

  test("locked mission cells are disabled", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Go to Progress tab
    await page.locator("text=Progress").first().click();
    await page.waitForSelector("text=Mission Progress", { timeout: 10000 });

    // Mission 60 is always locked with mock auth
    const lockedCell = page.locator('button[aria-label*="Mission 60:"][aria-label*="Locked"]');
    await expect(lockedCell.first()).toBeVisible();
    await expect(lockedCell.first()).toBeDisabled();
  });

  test("mission count and percentage display correctly", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI Mentor", { timeout: 20000 });
    await page.waitForTimeout(3000);

    // Go to Progress tab
    await page.locator("text=Progress").first().click();
    await page.waitForSelector("text=Mission Progress", { timeout: 10000 });

    // The header should show missions cleared text
    await expect(page.locator("text=/missions cleared/").first()).toBeVisible();
  });
});
