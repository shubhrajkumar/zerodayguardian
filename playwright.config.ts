import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for ZeroDay Guardian dashboard tests.
 *
 * - Starts Vite dev server on port 8080 (same as production config)
 * - Uses mock auth (zdg_mock_auth) to bypass backend
 * - Captures console errors for crash detection
 * - Screenshots on failure for debugging
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /* Capture console messages for error detection */
  },

  /* Run Vite dev server before tests */
  webServer: {
    command: "npx vite --port 8080 --host 0.0.0.0",
    url: "http://localhost:8080",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /* Bypass CSP restrictions for testing */
        bypassCSP: true,
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
});
