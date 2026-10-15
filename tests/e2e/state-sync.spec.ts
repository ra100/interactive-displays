import { expect, type Page, test } from "@playwright/test";
import { assignDisplay, identify, setState } from "./support/api.ts";

type Watched = Window & { switchedAt?: Promise<number> };

// Starts watching this page's screen for the given effect and, once the observer is in place, returns a function
// that resolves with the wall-clock time of the switch. Watching first means a fast switch cannot be missed.
const watchEffect = async (page: Page, effect: string): Promise<() => Promise<number>> => {
  await page.evaluate((expected) => {
    (window as Watched).switchedAt = new Promise<number>((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.querySelector(".screen")?.getAttribute("data-effect") === expected) {
          observer.disconnect();
          resolve(Date.now());
        }
      });
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-effect"] });
    });
  }, effect);
  return () => page.evaluate(() => (window as Watched).switchedAt ?? Promise.reject(new Error("not watching")));
};

test.describe("show state", () => {
  test.afterEach(async ({ request }) => {
    await setState(request, "normal");
  });

  test("a state change reaches every display within 100 ms", async ({ browser, request }) => {
    const pages = await Promise.all(
      ["test", "engineering-1", "tactical-1", "corridor-1"].map(async (displayId) => {
        const page = await browser.newPage();
        await page.goto(`/d/${displayId}`);
        await expect(page.locator('.screen[data-effect="none"]')).toBeVisible();
        return page;
      }),
    );

    const switched = await Promise.all(pages.map((page) => watchEffect(page, "alert")));
    const sent = Date.now();
    await setState(request, "red-alert");
    const delays = (await Promise.all(switched.map((at) => at()))).map((at) => at - sent);

    expect(Math.max(...delays)).toBeLessThan(100);
    await Promise.all(pages.map((page) => page.close()));
  });

  test("red alert restyles the screen and applies per-state overrides", async ({ page, request }) => {
    await page.goto("/d/test");
    await expect(page.getByText(/all systems nominal/i)).toBeVisible();

    await setState(request, "red-alert");

    await expect(page.locator(".screen")).toHaveAttribute("data-effect", "alert");
    await expect(page.getByText(/all hands to battle stations/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /stand down/i })).toBeVisible();
  });

  test("blackout hides the screen and normal brings it back", async ({ page, request }) => {
    await page.goto("/d/test");
    const heading = page.getByRole("heading", { name: /bridge operations/i });
    await expect(heading).toBeVisible();

    await setState(request, "blackout");
    await expect(heading).toBeHidden();

    await setState(request, "normal");
    await expect(heading).toBeVisible();
  });

  test("a display that connects later starts in the current state", async ({ page, request }) => {
    await setState(request, "damaged");
    await page.goto("/d/test");

    await expect(page.locator(".screen")).toHaveAttribute("data-effect", "damaged");
    await expect(page.getByText(/hull breach/i)).toBeVisible();
  });
});

test.describe("displays", () => {
  test("identify flashes the name on that display only", async ({ browser, request }) => {
    const target = await browser.newPage();
    const other = await browser.newPage();
    await target.goto("/d/test");
    await other.goto("/d/engineering-1");
    await expect(target.locator(".screen")).toBeVisible();
    await expect(other.locator(".screen")).toBeVisible();

    await identify(request, "test");

    await expect(target.getByRole("alert")).toHaveText("Test display");
    await expect(other.getByRole("alert")).toHaveCount(0);
    await Promise.all([target.close(), other.close()]);
  });

  test("a display follows its new assignment straight away", async ({ page, request }) => {
    await page.goto("/d/e2e-reassign");
    await expect(page.getByRole("heading", { name: /bridge operations/i })).toBeVisible();

    await assignDisplay(request, "e2e-reassign", "tactical");
    await expect(page.getByRole("heading", { name: /^tactical$/i })).toBeVisible();

    await assignDisplay(request, "e2e-reassign", null);
    await expect(page.getByRole("heading", { name: /bridge operations/i })).toBeVisible();
  });
});
