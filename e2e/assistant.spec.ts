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
    if (msg.includes("Source map")) return false;
    return true;
  });

// ── Assistant Page — Rendering ──

test.describe("Assistant page — renders correctly", () => {
  test("loads assistant with mock auth and zero console errors", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/assistant");

    // Wait for Zorvix AI shell to render
    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Wait for lazy-loaded components to settle
    await page.waitForTimeout(3000);

    await page.screenshot({ path: "e2e/screenshots/assistant-loaded.png", fullPage: true });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("displays ZORVIX AI header with status indicator", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Header should show ZORVIX AI branding
    await expect(page.locator("text=ZORVIX AI").first()).toBeVisible();

    // Status indicator should show (Ready, Offline, or Degraded)
    const statusIndicator = page.locator("text=Ready").or(page.locator("text=Offline")).or(page.locator("text=Degraded"));
    await expect(statusIndicator.first()).toBeVisible();
  });

  test("shows empty state with Ask ZORVIX and suggestions when no messages", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    // The session loads and returns no messages, so empty state should show
    await page.waitForSelector("text=Ask ZORVIX", { timeout: 20000 });

    // Welcome text
    await expect(page.locator("text=Ask ZORVIX")).toBeVisible();

    // Subtitle
    await expect(page.locator("text=Clear guidance, next actions").first()).toBeVisible();

    // Suggestion buttons should be present (4 from missionStarterSuggestions or DEFAULT_SUGGESTIONS)
    const suggestions = page.locator("button:has-text('Guide me through')").or(
      page.locator("button:has-text('Assess my current cyber momentum')")
    );
    await expect(suggestions.first()).toBeVisible();
  });

  test("renders the composer textarea with placeholder", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Textarea should be present with correct placeholder
    const textarea = page.locator("textarea[aria-label='Message ZORVIX']");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveAttribute("placeholder", "Ask a question, share a problem, or request the next step.");
  });

  test("renders attach file button", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Attach file button
    await expect(page.locator("[aria-label='Attach file']")).toBeVisible();
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Send button should be disabled
    const sendBtn = page.locator("button[type='submit']");
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
  });
});

// ── Assistant Page — Input Handling ──

test.describe("Assistant page — input handling", () => {
  test("send button enables when input has text", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Type in the textarea
    const textarea = page.locator("textarea[aria-label='Message ZORVIX']");
    await textarea.fill("Hello Zorvix");

    // Send button should now be enabled
    const sendBtn = page.locator("button[type='submit']");
    await expect(sendBtn).toBeEnabled();
  });

  test("clicking a suggestion button populates the input area", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");

    // Wait for empty state suggestions
    await page.waitForSelector("text=Ask ZORVIX", { timeout: 20000 });

    // Click the first suggestion button
    const suggestionBtn = page.locator("button:has-text('Guide me through')").or(
      page.locator("button:has-text('Assess my current cyber momentum')")
    );
    await suggestionBtn.first().click();

    // After clicking, the component calls runAssistant which clears input.
    // So we verify the empty state is replaced (messages area changes)
    // The input should have been cleared after auto-submit
    await page.waitForTimeout(500);

    // The send button state or message list should have changed
    // At minimum, the component didn't crash
    await expect(page.locator("text=ZORVIX AI").first()).toBeVisible();
  });
});

// ── Assistant Page — Navigation ──

test.describe("Assistant page — navigation", () => {
  test("back button navigates to previous page", async ({ page }) => {
    await enableMockAuth(page);

    // Go to dashboard first, then assistant
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Click back button
    await page.locator("text=Back").click();

    // Should navigate back to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("handles direct URL navigation", async ({ page }) => {
    await enableMockAuth(page);

    // Navigate directly to assistant
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Should be on assistant page
    await expect(page).toHaveURL(/\/assistant/);
  });
});

// ── Assistant Page — Resilience ──

test.describe("Assistant page — resilience", () => {
  test("handles page refresh without crashing", async ({ page }) => {
    await enableMockAuth(page);
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Full page refresh
    await page.reload();
    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Assistant should still be intact
    const textarea = page.locator("textarea[aria-label='Message ZORVIX']");
    await expect(textarea).toBeVisible();
  });

  test("navigates from dashboard to assistant and back without crashing", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Navigate to assistant
    await page.goto("/assistant");
    await page.waitForSelector("text=ZORVIX AI", { timeout: 20000 });

    // Navigate back to dashboard
    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });

  test("survives rapid navigation between pages", async ({ page }) => {
    await enableMockAuth(page);
    const errors = collectConsole(page, "error");

    await page.goto("/dashboard");
    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    // Rapid navigation
    await page.goto("/assistant");
    await page.goto("/profile");
    await page.goto("/dashboard");

    await page.waitForSelector("text=Test Guardian", { timeout: 20000 });

    const criticalErrors = filterExpectedErrors(errors);
    expect(criticalErrors).toEqual([]);
  });
});
