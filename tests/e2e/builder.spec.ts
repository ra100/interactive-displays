import { test, expect } from "@playwright/test";

test.describe("Builder - Layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder");
  });

  test("renders builder interface with palette, canvas, and sidebar", async ({ page }) => {
    await expect(page.locator(".palette")).toBeVisible();
    await expect(page.locator(".canvas")).toBeVisible();
    await expect(page.locator(".builder-sidebar")).toBeVisible();
  });

  test("palette contains all 5 element types", async ({ page }) => {
    const palette = page.locator(".palette");
    await expect(palette.getByText("Elbow")).toBeVisible();
    await expect(palette.getByText("Bar")).toBeVisible();
    await expect(palette.getByText("Frame")).toBeVisible();
    await expect(palette.getByText("Button")).toBeVisible();
    await expect(palette.getByText("Text")).toBeVisible();
  });

  test("canvas shows grid cells", async ({ page }) => {
    const gridCells = page.locator(".canvas-grid-cell");
    // 12 columns × 10 rows = 120 cells
    await expect(gridCells).toHaveCount(120);
  });
});

test.describe("Builder - Drag and Drop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder");
  });

  test("can drag element from palette to canvas", async ({ page }) => {
    const palette = page.locator(".palette");
    const canvas = page.locator(".canvas");
    const buttonPaletteItem = palette.locator('[data-element-type="button"]');

    // Get initial element count
    const initialCount = await page.locator(".canvas-element").count();

    // Drag button to canvas
    await buttonPaletteItem.dragTo(canvas, {
      targetPosition: { x: 100, y: 100 },
    });

    // Verify element was added
    const newCount = await page.locator(".canvas-element").count();
    expect(newCount).toBe(initialCount + 1);
  });

  test("clicking element selects it", async ({ page }) => {
    // First add an element
    const palette = page.locator(".palette");
    const canvas = page.locator(".canvas");
    await palette.locator('[data-element-type="button"]').dragTo(canvas);

    // Click the element
    const element = page.locator(".canvas-element").first();
    await element.click();

    // Should have selected class
    await expect(element).toHaveClass(/canvas-element--selected/);
  });

  test("property panel shows when element is selected", async ({ page }) => {
    // Add and select an element
    const palette = page.locator(".palette");
    const canvas = page.locator(".canvas");
    await palette.locator('[data-element-type="button"]').dragTo(canvas);
    await page.locator(".canvas-element").first().click();

    // Property panel should show element properties
    const propertyPanel = page.locator(".property-panel");
    await expect(propertyPanel.locator(".property-label")).toContainText("Type");
    await expect(propertyPanel.locator(".property-value")).toContainText("BUTTON");
  });
});

test.describe("Builder - Property Editing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/builder");
    // Add and select an element
    const palette = page.locator(".palette");
    const canvas = page.locator(".canvas");
    await palette.locator('[data-element-type="button"]').dragTo(canvas);
    await page.locator(".canvas-element").first().click();
  });

  test("can change element color", async ({ page }) => {
    const colorSwatch = page.locator(".color-swatch").nth(2); // Pick a different color
    await colorSwatch.click();

    // Verify color swatch is selected
    await expect(colorSwatch).toHaveClass(/color-swatch--selected/);
  });

  test("can delete element", async ({ page }) => {
    const deleteButton = page.locator(".delete-button");
    const initialCount = await page.locator(".canvas-element").count();

    await deleteButton.click();

    const newCount = await page.locator(".canvas-element").count();
    expect(newCount).toBe(initialCount - 1);
  });
});

test.describe("Builder - Undo/Redo", () => {
  test("can undo element addition", async ({ page }) => {
    await page.goto("/builder");

    // Add element
    const palette = page.locator(".palette");
    const canvas = page.locator(".canvas");
    await palette.locator('[data-element-type="bar"]').dragTo(canvas);

    const countAfterAdd = await page.locator(".canvas-element").count();

    // Click undo button
    await page.click('button:has-text("Undo")');

    const countAfterUndo = await page.locator(".canvas-element").count();
    expect(countAfterUndo).toBe(countAfterAdd - 1);
  });

  test("can redo undone action", async ({ page }) => {
    await page.goto("/builder");

    // Add element
    const palette = page.locator(".palette");
    const canvas = page.locator(".canvas");
    await palette.locator('[data-element-type="frame"]').dragTo(canvas);

    const countAfterAdd = await page.locator(".canvas-element").count();

    // Undo
    await page.click('button:has-text("Undo")');

    // Redo
    await page.click('button:has-text("Redo")');

    const countAfterRedo = await page.locator(".canvas-element").count();
    expect(countAfterRedo).toBe(countAfterAdd);
  });
});
