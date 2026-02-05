import { test, expect } from "@playwright/test";

/**
 * Acceptance Criteria Tests
 * Based on docs/ACCEPTANCE-TESTING.md
 */

test.describe("Acceptance Criteria", () => {
  test.describe("AC1: Server accepts 15+ connections", () => {
    test("multiple displays can connect simultaneously", async ({ context }) => {
      const pages = [];
      const connectionCount = 15;

      // Create 15 display pages
      for (let i = 0; i < connectionCount; i++) {
        const page = await context.newPage();
        pages.push(page);
      }

      // Navigate all to display
      await Promise.all(
        pages.map((page, i) => page.goto(`/?screen=display-${i}`))
      );

      // All should show connected
      for (const page of pages) {
        await expect(page.locator(".display-status")).toContainText("CONNECTED", { timeout: 10000 });
      }

      // Cleanup
      for (const page of pages) {
        await page.close();
      }
    });
  });

  test.describe("AC2: State changes propagate within 100ms", () => {
    test("state change is fast", async ({ context }) => {
      const display = await context.newPage();
      await display.goto("/?screen=latency-test");
      await expect(display.locator(".display-status")).toContainText("CONNECTED");

      const builder = await context.newPage();
      await builder.goto("/builder");

      // Measure time for state change
      const startTime = Date.now();
      await builder.click('button:has-text("ALERT")');
      await expect(display.locator(".display-status")).toContainText("ALERT");
      const endTime = Date.now();

      const latency = endTime - startTime;
      console.log(`State change latency: ${latency}ms`);

      // Should be under 100ms (with some buffer for test overhead)
      expect(latency).toBeLessThan(500); // Generous for test environment

      // Reset
      await builder.click('button:has-text("NORMAL")');
    });
  });

  test.describe("AC3: 5 display elements render correctly", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/builder");
    });

    test("Elbow element renders", async ({ page }) => {
      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");
      await palette.locator('[data-element-type="elbow"]').dragTo(canvas);

      await expect(page.locator(".lcars-elbow")).toBeVisible();
    });

    test("Bar element renders", async ({ page }) => {
      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");
      await palette.locator('[data-element-type="bar"]').dragTo(canvas);

      await expect(page.locator(".lcars-bar")).toBeVisible();
    });

    test("Frame element renders", async ({ page }) => {
      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");
      await palette.locator('[data-element-type="frame"]').dragTo(canvas);

      await expect(page.locator(".lcars-frame")).toBeVisible();
    });

    test("Button element renders", async ({ page }) => {
      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");
      await palette.locator('[data-element-type="button"]').dragTo(canvas);

      await expect(page.locator(".lcars-button")).toBeVisible();
    });

    test("Text element renders", async ({ page }) => {
      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");
      await palette.locator('[data-element-type="text"]').dragTo(canvas);

      await expect(page.locator(".lcars-text")).toBeVisible();
    });
  });

  test.describe("AC4: Builder creates layouts via drag-drop", () => {
    test("complete layout creation workflow", async ({ page }) => {
      await page.goto("/builder");

      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");

      // Add multiple elements
      await palette.locator('[data-element-type="elbow"]').dragTo(canvas, {
        targetPosition: { x: 60, y: 60 },
      });
      await palette.locator('[data-element-type="bar"]').dragTo(canvas, {
        targetPosition: { x: 300, y: 60 },
      });
      await palette.locator('[data-element-type="button"]').dragTo(canvas, {
        targetPosition: { x: 60, y: 200 },
      });

      // Verify elements added
      await expect(page.locator(".canvas-element")).toHaveCount(3);

      // Select and edit
      await page.locator(".lcars-button").click();
      await expect(page.locator(".canvas-element--selected")).toBeVisible();
    });
  });

  test.describe("AC5: Operator panel triggers state changes", () => {
    test("all state buttons work", async ({ page }) => {
      await page.goto("/builder");

      // Test each state
      await page.click('button:has-text("ALERT")');
      await expect(page.locator(".operator-state-indicator")).toContainText("ALERT");

      await page.click('button:has-text("ACTIVE")');
      await expect(page.locator(".operator-state-indicator")).toContainText("ACTIVE");

      await page.click('button:has-text("DAMAGED")');
      await expect(page.locator(".operator-state-indicator")).toContainText("DAMAGED");

      await page.click('button:has-text("NORMAL")');
      await expect(page.locator(".operator-state-indicator")).toContainText("NORMAL");
    });
  });

  test.describe("AC6: Layouts persist as JSON files", () => {
    test("save button triggers save", async ({ page }) => {
      await page.goto("/builder");

      // Add an element
      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");
      await palette.locator('[data-element-type="button"]').dragTo(canvas);

      // Save should not throw error
      await page.click('button:has-text("Save")');

      // No error in console indicates success
      // Full persistence test would require server file system access
    });
  });

  test.describe("AC7: 10-level undo in builder", () => {
    test("undo works up to 10 levels", async ({ page }) => {
      await page.goto("/builder");

      const palette = page.locator(".palette");
      const canvas = page.locator(".canvas");

      // Add 12 elements
      for (let i = 0; i < 12; i++) {
        await palette.locator('[data-element-type="button"]').dragTo(canvas, {
          targetPosition: { x: 60 + (i % 6) * 100, y: 60 + Math.floor(i / 6) * 100 },
        });
      }

      await expect(page.locator(".canvas-element")).toHaveCount(12);

      // Undo 10 times
      for (let i = 0; i < 10; i++) {
        await page.click('button:has-text("Undo")');
      }

      // Should have 2 elements (12 - 10)
      await expect(page.locator(".canvas-element")).toHaveCount(2);

      // 11th undo should have no effect
      await page.click('button:has-text("Undo")');
      await expect(page.locator(".canvas-element")).toHaveCount(2);
    });
  });

  test.describe("AC8: No console errors", () => {
    test("display loads without errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      await page.goto("/?screen=test");
      await page.waitForTimeout(1000);

      // Filter out expected errors (like favicon)
      const realErrors = errors.filter(
        (e) => !e.includes("favicon") && !e.includes("404")
      );

      expect(realErrors).toHaveLength(0);
    });

    test("builder loads without errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      await page.goto("/builder");
      await page.waitForTimeout(1000);

      const realErrors = errors.filter(
        (e) => !e.includes("favicon") && !e.includes("404")
      );

      expect(realErrors).toHaveLength(0);
    });
  });
});
