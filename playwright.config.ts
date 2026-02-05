import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5176",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @interactive-displays/server dev",
      url: "http://localhost:3010/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30000,
    },
    {
      command: "pnpm --filter @interactive-displays/app dev",
      url: "http://localhost:5176",
      reuseExistingServer: !process.env["CI"],
      timeout: 30000,
    },
  ],
});
