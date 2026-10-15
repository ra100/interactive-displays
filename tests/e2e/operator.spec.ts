import { devices, expect, test } from "@playwright/test";
import { assignDisplay, setState } from "./support/api.ts";

// The crew runs the show from a phone: states, assignment and finding a display.
test.describe("operator console on a phone", () => {
  test.use({ viewport: devices["Pixel 7"].viewport, hasTouch: true });

  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
    await assignDisplay(request, "operator-e2e", null);
  });

  test("sets the show state, assigns a screen and flashes a display", async ({ page, browser }) => {
    const display = await browser.newPage();
    await display.goto("/d/operator-e2e");
    await expect(display.getByText(/bridge operations/i)).toBeVisible();

    await page.goto("/operator");
    await expect(page.getByRole("heading", { name: "Demo Show" })).toBeVisible();
    const card = page.getByRole("listitem", { name: "operator-e2e" });
    await expect(card.getByText("connected")).toBeVisible();

    await page.getByRole("button", { name: /Red alert/ }).click();
    await expect(display.locator(".screen")).toHaveAttribute("data-effect", "alert");
    await expect(page.getByRole("button", { name: /Red alert/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Blackout" }).click();
    await expect(display.locator(".screen")).toHaveAttribute("data-effect", "blackout");
    await page.getByRole("button", { name: "End blackout" }).click();
    await expect(display.locator(".screen")).toHaveAttribute("data-effect", "none");

    await card.getByLabel("Screen").selectOption("tactical");
    await expect(display.getByText(/long range sensors/i)).toBeVisible();

    await card.getByRole("button", { name: "Identify" }).click();
    await expect(display.getByRole("alert")).toBeVisible();
    await display.close();
  });
});
