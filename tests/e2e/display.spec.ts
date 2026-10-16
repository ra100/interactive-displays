import { expect, test } from "@playwright/test";
import { createManagedServer } from "./support/server.ts";

test.describe("display", () => {
  test("renders the LCARS bridge at /d/test", async ({ page }) => {
    await page.goto("/d/test");

    await expect(page.getByRole("heading", { name: /bridge operations/i })).toBeVisible();
    for (const name of ["Helm", "Tactical", "Engineering", "Science", "Comms"]) {
      await expect(page.getByRole("button", { name: new RegExp(name, "i") })).toBeVisible();
    }
    await expect(page.locator(".lcars-frame--sidebar")).toBeVisible();
    await expect(page.getByText("RECONNECTING")).toHaveCount(0);
  });

  test("shows each display its assigned screen", async ({ page }) => {
    await page.goto("/d/engineering-1");
    await expect(page.getByRole("heading", { name: /main engineering/i })).toBeVisible();

    await page.goto("/d/tactical-1");
    await expect(page.getByRole("heading", { name: /^tactical$/i })).toBeVisible();

    await page.goto("/d/corridor-1");
    await expect(page.getByText(/please stand by/i)).toBeVisible();
  });

  test("renders the same screen in the base theme", async ({ page }) => {
    await page.goto("/d/test?theme=base");

    await expect(page.locator('.base-frame[data-archetype="sidebar"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Helm" })).toBeVisible();
    await expect(page.locator(".lcars-bar")).toHaveCount(0);
  });

  test("gives a new browser a display id and keeps it", async ({ page }) => {
    await page.goto("/d");
    await expect(page).toHaveURL(/\/d\/d-[0-9a-f]{6}$/);
    const assigned = page.url();

    await page.goto("/");
    await expect(page).toHaveURL(assigned);
  });

  for (const displayId of ["test", "engineering-1", "tactical-1"]) {
    test(`keeps buttons 1–2 cm tall on a 90-inch 4K panel on ${displayId}`, async ({ page }) => {
      await page.setViewportSize({ width: 3840, height: 2160 });
      await page.goto(`/d/${displayId}`);
      await expect(page.locator(".screen")).toBeVisible();

      const cm = Math.hypot(3840, 2160) / (90 * 2.54);
      for (const button of await page.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(cm);
        expect(box?.height).toBeLessThanOrEqual(2 * cm);
        expect(box?.width).toBeGreaterThanOrEqual(cm);
      }
    });
  }

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
    const heading = page.getByRole("heading", { name: /bridge operations/i });
    await expect(heading).toBeVisible();

    await server.stop();
    await expect(page.getByText("RECONNECTING")).toBeVisible();
    await expect(heading).toBeVisible();

    await server.start();
    await expect(page.getByText("RECONNECTING")).toHaveCount(0, { timeout: 15_000 });
    await expect(heading).toBeVisible();
  });
});
