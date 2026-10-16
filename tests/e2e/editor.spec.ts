import { expect, type Page, test } from "@playwright/test";
import { assignDisplay, createScreen, deleteScreen } from "./support/api.ts";

// Each test edits its own screen on its own display, so the seeded screens stay as other specs expect them.
const SCREEN = "e2e-edit";
const DISPLAY = "editor-e2e";

// A 1×1 PNG, enough for an upload.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const openEditor = async (page: Page) => {
  await page.goto(`/builder/${SCREEN}`);
  await expect(page.getByRole("heading", { name: "E2E edit", level: 1 })).toBeVisible();
};

const changeNote = async (page: Page, text: string) => {
  await page.getByRole("tree", { name: "Outline" }).getByRole("treeitem", { name: /Text · / }).click();
  const field = page.getByRole("tabpanel", { name: "Selection" }).getByLabel("Text");
  await field.fill(text);
  await field.blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
};

test.describe("screen editor", () => {
  test.beforeEach(async ({ request }) => {
    await createScreen(request, SCREEN, "E2E edit");
    await assignDisplay(request, DISPLAY, SCREEN);
  });

  test.afterEach(async ({ request }) => {
    await request.put("/api/show/settings", { data: { liveEdit: false } });
    await request.delete(`/api/displays/${DISPLAY}/preview`);
    await assignDisplay(request, DISPLAY, null);
    await deleteScreen(request, SCREEN);
  });

  test("keeps edits off air until they are published", async ({ page, browser }) => {
    const display = await browser.newPage();
    await display.goto(`/d/${DISPLAY}`);
    await expect(display.getByText("Nothing to report.")).toBeVisible();

    await openEditor(page);
    await changeNote(page, "Warp core breach imminent.");
    await expect(page.locator(".preview-stage").getByText("Warp core breach imminent.")).toBeVisible();
    await expect(page.getByText("Unpublished changes")).toBeVisible();
    await expect(display.getByText("Nothing to report.")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("dialog", { name: "Publish E2E edit?" }).getByRole("button", { name: "Publish" }).click();
    await expect(display.getByText("Warp core breach imminent.")).toBeVisible();
    await expect(page.getByText("Published", { exact: true })).toBeVisible();
    await display.close();
  });

  test("previews a draft on one display, then restores an earlier revision", async ({ page, browser }) => {
    const display = await browser.newPage();
    await display.goto(`/d/${DISPLAY}`);
    await openEditor(page);
    await changeNote(page, "Draft only.");

    await page.getByRole("button", { name: "Send to display" }).click();
    await page.getByRole("dialog").getByRole("button", { name: `Preview on ${DISPLAY}` }).click();
    await expect(display.getByText("DRAFT PREVIEW")).toBeVisible();
    await expect(display.getByText("Draft only.")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "End preview" }).click();
    await expect(display.getByText("Nothing to report.")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: "History" }).click();
    const history = page.getByRole("tabpanel", { name: "History" });
    await history.getByRole("listitem").filter({ hasText: "Revision 0" }).getByRole("button", { name: "Restore" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText("Restored revision 0 as revision 2")).toBeVisible();
    await expect(page.locator(".preview-stage").getByText("Nothing to report.")).toBeVisible();
    await display.close();
  });

  test("live edit puts every change on air at once", async ({ page, browser }) => {
    const display = await browser.newPage();
    await display.goto(`/d/${DISPLAY}`);
    await openEditor(page);

    // The switch asks first, so it only turns on after the confirmation.
    await page.getByRole("switch", { name: "Live edit" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText("Live edit: changes go on air at once")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Live edit" })).toBeChecked();

    await changeNote(page, "Rehearsal take two.");
    await expect(display.getByText("Rehearsal take two.")).toBeVisible();
    await display.close();
  });

  test("uploads a picture and shows it with the image widget", async ({ page, request }) => {
    await openEditor(page);
    await page.getByRole("tab", { name: "Assets" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: "E2E Logo.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Uploaded e2e-logo.png")).toBeVisible();

    await page.getByRole("button", { name: "Add e2e-logo.png" }).click();
    await expect(page.locator('.preview-stage img[src="/media/e2e-logo.png"]')).toBeVisible();
    expect((await request.get("/media/e2e-logo.png")).headers()["content-type"]).toBe("image/png");
    await expect(page.getByRole("tabpanel", { name: "Selection" }).getByLabel("Image")).toHaveValue("e2e-logo.png");

    await request.delete("/api/assets/e2e-logo.png");
  });

  test("creates a screen from the library and arranges it by dragging in the outline", async ({ page, request }) => {
    await page.goto("/builder");
    await page.getByRole("button", { name: "New screen" }).click();
    const dialog = page.getByRole("dialog", { name: "New screen" });
    await dialog.getByLabel("Name").fill("E2E library");
    await dialog.getByText("Header and main").click();
    await dialog.getByRole("button", { name: "Create and edit" }).click();
    await expect(page).toHaveURL(/\/builder\/e2e-library$/);

    const outline = page.getByRole("tree", { name: "Outline" });
    const scan = outline.getByRole("treeitem", { name: /Button · SCAN/ });
    const report = outline.getByRole("treeitem", { name: /Button · REPORT/ });
    const target = await report.boundingBox();
    if (!target) throw new Error("no outline row");
    await scan.hover();
    await page.mouse.down();
    await page.mouse.move(target.x + 40, target.y + target.height / 2, { steps: 5 });
    await page.mouse.move(target.x + 40, target.y + target.height + 2, { steps: 5 });
    await page.mouse.up();

    await expect(outline.getByRole("treeitem", { name: /Button · / })).toHaveText([/ANALYSE/, /REPORT/, /SCAN/]);
    await deleteScreen(request, "e2e-library");
  });
});
