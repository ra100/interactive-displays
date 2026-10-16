import { expect, type Page, test } from "@playwright/test";
import { assignDisplay, deleteScreen, setState } from "./support/api.ts";

// Generating screens from the starship content pack, end to end: the dialog, the display, the alert and the editor.
const DISPLAY = "generate-e2e";

const generate = async (page: Page, section: string, seed: number, suite = false) => {
  await page.goto("/builder");
  await page.getByRole("button", { name: "Generate" }).click();
  const dialog = page.getByRole("dialog", { name: "Generate a screen" });
  await dialog.getByLabel("Section").selectOption({ label: section });
  await dialog.getByRole("textbox", { name: "Seed" }).fill(String(seed));
  await expect(dialog.locator(".thumbnail")).toHaveCount(3);
  if (suite) await dialog.getByRole("checkbox", { name: /screen for each system/ }).check();
  await dialog.getByRole("button", { name: suite ? /Create \d+ screens/ : "Create and edit" }).click();
};

// Every pressable thing on a display is at least 1 cm in both directions on the show's 90" panel (AGENTS.md:
// touch targets); the viewport stands in for the whole panel, so a centimetre is its diagonal over 228.6.
const smallTargets = async (page: Page) =>
  page.locator(".screen button").evaluateAll((buttons) => {
    const cm = Math.hypot(window.innerWidth, window.innerHeight) / (90 * 2.54);
    return buttons
      .map((button) => ({ text: button.textContent ?? "", rect: button.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && (rect.width < cm - 0.5 || rect.height < cm - 0.5))
      .map(({ text, rect }) => `${text} ${Math.round(rect.width)}×${Math.round(rect.height)}`);
  });

test.describe("generating screens", () => {
  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
    await assignDisplay(request, DISPLAY, null);
    const response = await request.get("/api/screens");
    const { screens } = (await response.json()) as { screens: { id: string; tags: string[] }[] };
    for (const screen of screens.filter((each) => each.tags.includes("generated"))) await deleteScreen(request, screen.id);
  });

  test("generates a section screen that runs on a display and reacts to red alert", async ({ page, browser, request }) => {
    await generate(page, "Medical", 4242);
    await expect(page).toHaveURL(/\/builder\/medical$/);
    await expect(page.getByRole("heading", { name: "Medical", level: 1, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();

    await assignDisplay(request, DISPLAY, "medical");
    const display = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await display.goto(`/d/${DISPLAY}`);
    await expect(display.getByText(/SICKBAY|MEDICAL STATUS|PATIENT MONITOR/).first()).toBeVisible();
    expect(await smallTargets(display)).toEqual([]);
    await expect(display.getByRole("alert")).toHaveCount(0);

    await setState(request, "red-alert");
    await expect(display.getByRole("alert")).toBeVisible();
    await display.close();
  });

  test("regenerates around a locked title and undoes it", async ({ page }) => {
    await generate(page, "Engineering", 77);
    await expect(page.getByRole("heading", { name: "Engineering", level: 1, exact: true })).toBeVisible();
    const outline = page.getByRole("tree", { name: "Outline" });
    await outline.getByRole("treeitem", { name: /^Title · / }).first().click();
    const title = await page.getByRole("tabpanel", { name: "Selection" }).getByLabel("Text").inputValue();
    await page.getByRole("tabpanel", { name: "Selection" }).getByRole("checkbox", { name: /Locked/ }).check();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    // The outline, not the preview: readings in the preview keep moving.
    const before = await outline.innerText();

    await page.getByRole("button", { name: "Regenerate", exact: true }).click();
    await expect(page.getByText(/Regenerated everything that is not locked/)).toBeVisible();
    await expect.poll(() => outline.innerText()).not.toBe(before);
    await expect(page.locator(".preview-stage").getByText(title, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => outline.innerText()).toBe(before);
  });

  test("generates a suite whose nav buttons move between its screens", async ({ page, browser, request }) => {
    await generate(page, "Security", 9, true);
    await expect(page).toHaveURL(/\/builder\/security$/);
    for (const id of ["security", "security-internal", "security-fields", "security-access"]) {
      const published = await request.post(`/api/screens/${id}/publish`, { data: {} });
      expect(published.ok()).toBe(true);
    }
    await assignDisplay(request, DISPLAY, "security");
    const display = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await display.goto(`/d/${DISPLAY}`);
    await display.getByRole("button", { name: "FIELDS", exact: true }).click();
    await expect(display.getByRole("heading", { name: "FORCE FIELDS" }).first()).toBeVisible();
    await display.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(display.getByRole("button", { name: "FIELDS", exact: true })).toBeVisible();
    expect(await smallTargets(display)).toEqual([]);
    await display.close();
  });
});
