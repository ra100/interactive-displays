import { test, expect } from "@playwright/test";

test.describe("Display Client", () => {
  test("shows connected status when server is running", async ({ page }) => {
    await page.goto("/?screen=test-display");
    await expect(page.locator(".display-status")).toContainText("CONNECTED");
  });

  test("shows screen ID in status bar", async ({ page }) => {
    await page.goto("/?screen=bridge-main");
    await expect(page.locator(".display-status")).toContainText("bridge-main");
  });

  test("shows current global state", async ({ page }) => {
    await page.goto("/?screen=test");
    await expect(page.locator(".display-status")).toContainText("NORMAL");
  });

  test("renders layout elements", async ({ page }) => {
    await page.goto("/?screen=test");
    // Wait for layout to load
    await page.waitForSelector(".lcars-element", { timeout: 5000 });
    const elements = page.locator(".lcars-element");
    await expect(elements.first()).toBeVisible();
  });

  test("elements have theme styling", async ({ page }) => {
    await page.goto("/?screen=test");
    await page.waitForSelector(".lcars-element");
    const element = page.locator(".lcars-element").first();
    // Check that element has a background color (theme applied)
    const bgColor = await element.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("Display - State Changes", () => {
  test("updates display when state changes from builder", async ({ page, context }) => {
    // Open display
    await page.goto("/?screen=test-sync");
    await expect(page.locator(".display-status")).toContainText("NORMAL");

    // Open builder in new page
    const builderPage = await context.newPage();
    await builderPage.goto("/builder");

    // Click ALERT button
    await builderPage.click('button:has-text("ALERT")');

    // Verify display updated
    await expect(page.locator(".display-status")).toContainText("ALERT", { timeout: 2000 });

    // Reset to normal
    await builderPage.click('button:has-text("NORMAL")');
    await expect(page.locator(".display-status")).toContainText("NORMAL", { timeout: 2000 });

    await builderPage.close();
  });
});
