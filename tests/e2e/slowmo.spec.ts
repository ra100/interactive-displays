import { expect, test } from "@playwright/test";
import { warpTime } from "./support/slowmo.ts";

// The showcase video records in slow motion: a page's clocks, timers and animation frames run at a fraction of real
// time, and everything that reads the time still works.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe("slow motion for the showcase recording", () => {
  test("a page's clocks and timers run at half speed", async ({ page }) => {
    await page.addInitScript(warpTime, { rate: 0.5, epoch: Date.now() });
    await page.goto("/d/test");

    const before = await page.evaluate(() => ({ date: Date.now(), clock: performance.now() }));
    const started = Date.now();
    await sleep(600);
    const after = await page.evaluate(() => ({ date: Date.now(), clock: performance.now() }));
    const real = Date.now() - started;
    expect(after.date - before.date).toBeGreaterThan(real * 0.5 - 60);
    expect(after.date - before.date).toBeLessThan(real * 0.5 + 60);
    expect(after.clock - before.clock).toBeLessThan(real * 0.5 + 60);

    // 200 ms of the page's time take 400 ms of ours.
    const timed = Date.now();
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(Date.now() - timed).toBeGreaterThanOrEqual(390);

    // Animation frames report the slow clock.
    const frames = await page.evaluate(
      () => new Promise<number[]>((resolve) => requestAnimationFrame((first) => requestAnimationFrame((second) => resolve([first, second, performance.now()])))),
    );
    expect(frames[1] ?? 0).toBeGreaterThan(frames[0] ?? 0);
    expect(Math.abs((frames[2] ?? 0) - (frames[1] ?? 0))).toBeLessThan(50);

    // Dates still behave like dates.
    expect(
      await page.evaluate(() => [new Date() instanceof Date, typeof Date(), Number.isInteger(Date.now()), new Date(0).getTime(), Date.UTC(2026, 0, 1)]),
    ).toEqual([true, "string", true, 0, 1767225600000]);
    // The display still runs on it.
    await expect(page.locator(".screen")).toBeVisible();
  });
});
