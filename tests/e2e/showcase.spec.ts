import path from "node:path";
import { expect, test } from "@playwright/test";
import { createManagedServer } from "./support/server.ts";

// Screenshots for the PR and docs/showcase. Run with: SHOWCASE=phase-0 pnpm test:e2e showcase
const phase = process.env["SHOWCASE"];
const out = (name: string) => path.join("docs", "showcase", phase ?? "", `${name}.png`);

test.describe("showcase", () => {
  test.skip(!phase, "set SHOWCASE=<phase> to capture screenshots");

  const viewports = [
    { name: "welcome-16x9", width: 1280, height: 720 },
    { name: "welcome-4x3", width: 1024, height: 768 },
    { name: "welcome-9x16", width: 540, height: 960 },
  ];

  for (const { name, width, height } of viewports) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/d/test");
      await expect(page.getByRole("heading", { name: /interactive displays/i })).toBeVisible();
      await page.screenshot({ path: out(name) });
    });
  }

  test("reconnecting", async ({ page }) => {
    const server = createManagedServer(3013);
    await server.start();
    try {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`${server.url}/d/test`);
      await expect(page.getByRole("heading", { name: /interactive displays/i })).toBeVisible();
      await server.stop();
      await expect(page.getByText("RECONNECTING")).toBeVisible();
      await page.screenshot({ path: out("reconnecting") });
    } finally {
      await server.stop();
    }
  });

  test("invalid-id", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/d/Not%20Valid");
    await expect(page.getByText("INVALID DISPLAY ID")).toBeVisible();
    await page.screenshot({ path: out("invalid-id") });
  });
});
