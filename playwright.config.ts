import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// E2E runs against the production setup: the built app served by the single server process.
// Run `pnpm build` first. Each run starts from a freshly seeded data directory.
const PORT = 3011;
const dataDir = mkdtempSync(path.join(tmpdir(), "displays-e2e-"));
const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...(executablePath ? { launchOptions: { executablePath } } : {}) },
    },
  ],
  webServer: {
    command: "node packages/server/src/index.ts",
    url: `http://127.0.0.1:${PORT}/health`,
    env: { PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, LOG_LEVEL: "warn" },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
