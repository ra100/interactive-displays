import { expect, test } from "@playwright/test";
import { createManagedServer } from "./support/server.ts";

test.describe("display", () => {
  test("renders the demo screen at /d/test", async ({ page }) => {
    await page.goto("/d/test");

    await expect(page.getByRole("heading", { name: /interactive displays/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /engineering/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /tactical/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /science/i })).toBeVisible();
    await expect(page.getByText("RECONNECTING")).toHaveCount(0);
  });

  test("gives a new browser a display id and keeps it", async ({ page }) => {
    await page.goto("/d");
    await expect(page).toHaveURL(/\/d\/d-[0-9a-f]{6}$/);
    const assigned = page.url();

    await page.goto("/");
    await expect(page).toHaveURL(assigned);
  });

  test("keeps touch targets at least 60px", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 450 });
    await page.goto("/d/test");

    for (const button of await page.getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(60);
      expect(box?.width).toBeGreaterThanOrEqual(60);
    }
  });

  test("rejects an invalid display id", async ({ page }) => {
    await page.goto("/d/Not%20Valid");
    await expect(page.getByText("INVALID DISPLAY ID")).toBeVisible();
  });
});

test.describe("server restart", () => {
  const server = createManagedServer(3012);

  test.afterAll(async () => {
    await server.stop();
  });

  test("the screen survives a restart and the display reconnects on its own", async ({ page }) => {
    await server.start();
    await page.goto(`${server.url}/d/stage-left`);
    const heading = page.getByRole("heading", { name: /interactive displays/i });
    await expect(heading).toBeVisible();

    await server.stop();
    await expect(page.getByText("RECONNECTING")).toBeVisible();
    await expect(heading).toBeVisible();

    await server.start();
    await expect(page.getByText("RECONNECTING")).toHaveCount(0, { timeout: 15_000 });
    await expect(heading).toBeVisible();
  });
});
