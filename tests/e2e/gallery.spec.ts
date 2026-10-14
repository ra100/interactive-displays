import { expect, test } from "@playwright/test";

test.describe("gallery", () => {
  test("shows every frame, widget and decor without fallbacks", async ({ page }) => {
    await page.goto("/gallery");

    await expect(page.getByRole("heading", { name: "Gallery" })).toBeVisible();
    await expect(page.locator(".frame")).toHaveCount(3);
    await expect(page.locator(".decor-slot")).toHaveCount(4);
    await expect(page.locator(".widget-fallback")).toHaveCount(0);
  });

  test("switches theme, variant and effect", async ({ page }) => {
    await page.goto("/gallery");

    await page.getByLabel("Variant").selectOption("nemesis");
    await page.getByLabel("Effect").selectOption("alert");
    await expect(page).toHaveURL(/variant=nemesis/);
    await expect(page.locator(".screen").first()).toHaveAttribute("data-effect", "alert");

    await page.getByLabel("Theme").selectOption("base");
    await expect(page.locator(".screen").first()).toHaveAttribute("data-theme", "base");
    await expect(page.getByText("Base has no decor.")).toBeVisible();
  });
});
