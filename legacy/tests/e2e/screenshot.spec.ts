import { test, expect } from "@playwright/test";

test.describe("README Screenshots", () => {
  test("captures builder and display screenshots", async ({ page, context }) => {
    // --------------------------
    // 1. Builder Interface Screenshot
    // --------------------------
    await page.goto("/builder");

    // Wait for the builder page to fully load
    await page.waitForSelector(".palette", { state: "visible" });
    await page.waitForSelector(".canvas", { state: "visible" });
    await page.waitForSelector(".builder-sidebar", { state: "visible" });

    // Verify all palette items are visible
    await expect(page.locator('.palette-item[data-element-type="elbow"]')).toBeVisible();
    await expect(page.locator('.palette-item[data-element-type="bar"]')).toBeVisible();
    await expect(page.locator('.palette-item[data-element-type="frame"]')).toBeVisible();
    await expect(page.locator('.palette-item[data-element-type="button"]')).toBeVisible();
    await expect(page.locator('.palette-item[data-element-type="text"]')).toBeVisible();

    // Wait for any animations to settle
    await page.waitForTimeout(500);

    // Take builder screenshot
    await page.screenshot({
      path: "docs/screenshots/builder-interface.png",
      fullPage: true,
    });

    // --------------------------
    // 2. Display Client Screenshot
    // --------------------------
    const displayPage = await context.newPage();
    await displayPage.goto("/?screen=test-screenshot");

    // Wait for display to connect and render
    await displayPage.waitForSelector(".display-status", {
      state: "visible",
      timeout: 10000,
    });

    // Wait for layout elements to render
    await displayPage.waitForSelector(".lcars-element", {
      state: "visible",
      timeout: 10000,
    });

    // Wait for connection status
    await expect(displayPage.locator(".display-status")).toContainText("CONNECTED", {
      timeout: 5000,
    });

    // Take display screenshot
    await displayPage.screenshot({
      path: "docs/screenshots/display-client.png",
      fullPage: true,
    });

    // Cleanup
    await displayPage.close();
  });
});
