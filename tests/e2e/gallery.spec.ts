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

  test("keeps LCARS elbow sweeps from stretching into tall ovals", async ({ page }) => {
    await page.setViewportSize({ width: 2160, height: 3840 });
    await page.goto("/gallery?theme=lcars");
    await expect(page.locator(".lcars-frame__elbow").first()).toBeVisible();

    // A tall, narrow box is the worst case for a decor elbow; the frames get it from the portrait panel.
    await page.locator(".decor-slot").evaluateAll((slots) => {
      for (const slot of slots) Object.assign((slot as HTMLElement).style, { width: "120px", height: "900px" });
    });

    const sweeps = await page.locator(".lcars-frame__elbow, .lcars-elbow").evaluateAll((elbows) =>
      elbows.map((elbow) => {
        const style = getComputedStyle(elbow);
        const radius = [
          style.borderTopLeftRadius,
          style.borderTopRightRadius,
          style.borderBottomLeftRadius,
          style.borderBottomRightRadius,
        ].find((value) => value !== "0px");
        const [x = 0, y = x] = (radius ?? "0px").split(" ").map((part) => Number.parseFloat(part));
        return { x, y };
      }),
    );

    expect(sweeps.length).toBeGreaterThan(4);
    for (const { x, y } of sweeps) {
      expect(x).toBeGreaterThan(0);
      expect(y).toBeLessThanOrEqual(x * 1.2 + 1);
    }
  });
});
