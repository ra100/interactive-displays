import { expect, type Page, test } from "@playwright/test";
import { assignDisplay, setState } from "./support/api.ts";

// Phase 3: live values and controls on the displays themselves.
const setSignal = async (page: Page, id: string, value: number) => {
  const response = await page.request.put(`/api/signals/${id}/value`, { data: { value } });
  expect(response.ok()).toBe(true);
};

const setSettings = async (page: Page, settings: Record<string, boolean>) => {
  const response = await page.request.put("/api/show/settings", { data: settings });
  expect(response.ok()).toBe(true);
};

const node = (page: Page, nodeId: string) => page.locator(`[data-node-id="${nodeId}"]`);
// The tactical shield gauge is an arc, drawn by the base renderer in every theme.
const shields = (page: Page) => node(page, "sh-strength").locator(".base-gauge__value");

test.describe("display controls", () => {
  test.afterEach(async ({ page }) => {
    await setState(page.request, "normal");
    await setSignal(page, "shields", 0);
    await setSettings(page, { displayGlobalActions: true });
  });

  test("a button on one display puts the whole show on red alert, and another stands it down", async ({ page, browser }) => {
    const tactical = await browser.newPage();
    await tactical.goto("/d/tactical-1");
    await page.goto("/d/test");
    await expect(page.getByRole("button", { name: /stand down/i })).toHaveCount(0);

    await page.getByRole("button", { name: /red alert/i }).click();
    await expect(tactical.locator(".screen")).toHaveAttribute("data-state", "red-alert");
    await expect(shields(tactical)).toHaveText("100%");
    // The button has done its job; the way back appears in its place.
    await expect(page.getByRole("button", { name: /red alert/i })).toHaveCount(0);

    await page.getByRole("button", { name: /stand down/i }).click();
    await expect(tactical.locator(".screen")).toHaveAttribute("data-state", "normal");
    await expect(shields(tactical)).toHaveText("0%");
    await tactical.close();
  });

  test("the operator can stop display buttons from changing the show", async ({ page }) => {
    await setSettings(page, { displayGlobalActions: false });
    await page.goto("/d/test");
    await page.getByRole("button", { name: /red alert/i }).click();
    await page.waitForTimeout(300);
    await expect(page.locator(".screen")).toHaveAttribute("data-state", "normal");
  });

  test("buttons move one display to another screen and back", async ({ page }) => {
    await page.goto("/d/e2e-navigate");
    await page.getByRole("button", { name: /engineering/i }).click();
    await expect(page.getByRole("heading", { name: /main engineering/i })).toBeVisible();
    await page.getByRole("button", { name: /diagnostics/i }).click();
    await expect(page.getByRole("button", { name: /back/i })).toBeVisible();
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.getByRole("heading", { name: /main engineering/i })).toBeVisible();

    // A new assignment from the operator wins over wherever the buttons took it.
    await assignDisplay(page.request, "e2e-navigate", null);
    await expect(page.getByRole("heading", { name: /bridge operations/i })).toBeVisible();
  });

  test("values move by themselves", async ({ page }) => {
    await page.goto("/d/engineering-1");
    const output = node(page, "core-output");
    const first = await output.textContent();
    await expect.poll(() => output.textContent(), { timeout: 5000 }).not.toBe(first);
  });
});

test.describe("operator live controls", () => {
  test.afterEach(async ({ page }) => {
    await setSignal(page, "shields", 0);
  });

  test("a slider on the operator console moves a gauge on a display", async ({ page, browser }) => {
    const tactical = await browser.newPage();
    await tactical.goto("/d/tactical-1");
    await page.goto("/operator");
    await page.getByRole("slider", { name: "Shield strength" }).fill("45");
    await expect(shields(tactical)).toHaveText("45%");

    await page.getByRole("button", { name: "Raise Shield strength" }).click();
    await expect(shields(tactical)).toHaveText("50%");
    await tactical.close();
  });

  test("the operator plays and holds a video on a display", async ({ page, browser }) => {
    const viewscreen = await browser.newPage();
    await viewscreen.goto("/d/viewscreen-1");
    const video = viewscreen.locator("video");
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);

    await page.goto("/operator");
    const transport = page.getByRole("listitem", { name: "Viewscreen" }).getByRole("group", { name: "Video feed" });
    await transport.getByRole("button", { name: "Pause" }).click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);

    // The display's own replay button runs on the display alone.
    await viewscreen.getByRole("button", { name: /replay/i }).click();
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
    await viewscreen.close();
  });
});
