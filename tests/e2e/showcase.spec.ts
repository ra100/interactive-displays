import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { identify, setState } from "./support/api.ts";

// Screenshots for the PR and docs/showcase. Run with: SHOWCASE=phase-1 pnpm test:e2e showcase
// Each phase captures what it added; earlier phases' images stay in their own folders.
const phase = process.env["SHOWCASE"];
const out = (name: string) => path.join("docs", "showcase", phase ?? "", `${name}.png`);

const shoot = async (page: Page, name: string, url: string, ready: RegExp | string) => {
  await page.goto(url);
  await expect(page.getByText(ready).first()).toBeVisible();
  // Let the self-hosted font settle before capturing.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out(name) });
};

test.describe("showcase", () => {
  test.skip(!phase, "set SHOWCASE=<phase> to capture screenshots");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
  });

  test("screens", async ({ page }) => {
    await shoot(page, "bridge-sidebar", "/d/test", /bridge operations/i);
    await shoot(page, "engineering-header-main", "/d/engineering-1", /main engineering/i);
    await shoot(page, "tactical-dashboard", "/d/tactical-1", /long range sensors/i);
    await shoot(page, "standby-canvas", "/d/corridor-1", /please stand by/i);
  });

  test("states", async ({ page, request }) => {
    for (const [state, text] of [
      ["yellow-alert", /shields up/i],
      ["red-alert", /battle stations/i],
      ["damaged", /hull breach/i],
    ] as const) {
      await setState(request, state);
      await shoot(page, `bridge-${state}`, "/d/test", text);
    }
    await setState(request, "red-alert");
    await shoot(page, "tactical-red-alert", "/d/tactical-1", /firing solution/i);
  });

  test("themes and variants", async ({ page }) => {
    await shoot(page, "bridge-base-theme", "/d/test?theme=base", /bridge operations/i);
    await shoot(page, "engineering-nemesis", "/d/engineering-1?variant=nemesis", /main engineering/i);
    await shoot(page, "tactical-picard", "/d/tactical-1?variant=picard", /long range sensors/i);
  });

  test("identify", async ({ page, request }) => {
    await page.goto("/d/engineering-1");
    await expect(page.getByText(/main engineering/i)).toBeVisible();
    await identify(request, "engineering-1");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.screenshot({ path: out("identify") });
  });

  test("portrait", async ({ page }) => {
    await page.setViewportSize({ width: 540, height: 960 });
    await shoot(page, "bridge-9x16", "/d/test", /bridge operations/i);
  });

  test("gallery", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/gallery");
    await expect(page.locator(".frame").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // The gallery scrolls inside its own box; grow the viewport to fit it all in one image.
    const height = await page.locator(".gallery").evaluate((element) => element.scrollHeight);
    await page.setViewportSize({ width: 1280, height });
    await page.screenshot({ path: out("gallery") });
  });
});
