import { expect, type Page, test } from "@playwright/test";
import { type Box, directorOf, directorPage } from "./support/director.ts";

// The director page that records the showcase video: its camera frames what each beat is about and moves without
// jumps, and a press is ringed where the control is on screen.

// A stand-in for the app: one box at a known place.
const TARGET: Box = { x: 1500, y: 700, width: 300, height: 200 };
const stage = `<!doctype html><html><body style="margin:0;width:1920px;height:1080px;background:#123">
<div id="target" style="position:absolute;left:${TARGET.x}px;top:${TARGET.y}px;width:${TARGET.width}px;height:${TARGET.height}px;background:#f90"></div>
<button id="far" style="position:absolute;left:1820px;top:1000px;width:80px;height:60px">Far</button>
</body></html>`;

const open = async (page: Page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/director.html", (route) => route.fulfill({ contentType: "text/html", body: directorPage() }));
  await page.route("**/stage.html", (route) => route.fulfill({ contentType: "text/html", body: stage }));
  await page.goto("/director.html");
  const director = directorOf(page);
  await director("go", "/stage.html");
  await director("fade", false);
  return director;
};

// Where the app's frame is in the picture, with the camera's move applied.
const frameRect = (page: Page) =>
  page.evaluate(() => {
    const rect = document.getElementById("main")?.getBoundingClientRect();
    return { x: rect?.x ?? 0, y: rect?.y ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0 };
  });

// Where a box of the app is in the picture.
const onScreen = (box: Box, frame: Box): Box => {
  const scale = frame.width / 1920;
  return { x: frame.x + scale * box.x, y: frame.y + scale * box.y, width: scale * box.width, height: scale * box.height };
};

test.describe("director page", () => {
  test("frames a box in the middle of an area, as close as it allows, never past the app's edges", async ({ page }) => {
    const director = await open(page);
    const middle: Box = { x: 800, y: 440, width: 300, height: 200 };
    const scale = await director("camera", middle, { x: 0, y: 0, width: 1100, height: 1080 }, 0);
    expect(scale).toBeCloseTo(2.4);
    const framed = onScreen(middle, await frameRect(page));
    expect(framed.x + framed.width / 2).toBeCloseTo(550, 0);
    expect(framed.y + framed.height / 2).toBeCloseTo(540, 0);

    // Near the right edge the camera stops at the edge, with the box still in the picture.
    await director("camera", TARGET, undefined, 0);
    const edge = await frameRect(page);
    const target = onScreen(TARGET, edge);
    expect(edge.x + edge.width).toBeCloseTo(1920, 0);
    expect(target.x + target.width).toBeLessThanOrEqual(1920);
    expect(target.y + target.height).toBeLessThanOrEqual(1080);

    // A box in the corner stays in the corner: the app always fills the picture.
    await director("camera", { x: 0, y: 0, width: 400, height: 300 }, undefined, 0);
    const frame = await frameRect(page);
    expect(frame.x).toBe(0);
    expect(frame.y).toBe(0);
    expect(frame.x + frame.width).toBeGreaterThanOrEqual(1920);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(1080);

    // A box bigger than the picture is the whole app.
    await director("camera", { x: 0, y: 0, width: 1900, height: 1000 }, undefined, 0);
    expect(await frameRect(page)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  test("fits the whole app into an area, so a caption can sit beside it", async ({ page }) => {
    const director = await open(page);
    const band: Box = { x: 0, y: 0, width: 1920, height: 835 };
    const scale = (await director("camera", null, band, 0)) as number;
    expect(scale).toBeCloseTo(835 / 1080);
    const frame = await frameRect(page);
    expect(frame.y).toBe(0);
    expect(frame.height).toBeCloseTo(835, 0);
    expect(frame.x).toBeCloseTo((1920 - frame.width) / 2, 0);
    // A press still rings where the control is.
    const target = onScreen(TARGET, frame);
    await director("tapApp", TARGET);
    const ring = await page.locator(".tap").evaluate((element) => Number.parseFloat((element as HTMLElement).style.left));
    expect(ring).toBeCloseTo(target.x + target.width / 2, 0);
  });

  test("pulls back in one smooth move, without a jump at the start", async ({ page }) => {
    const director = await open(page);
    await director("camera", TARGET, undefined, 0);
    const start = await frameRect(page);
    // Every frame of the move, sampled in the page.
    const samples = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const xs: number[] = [];
          const sample = () => {
            xs.push(document.getElementById("main")?.getBoundingClientRect().x ?? 0);
            if (xs.length < 90) requestAnimationFrame(sample);
            else resolve(xs);
          };
          void (window as unknown as { director: { camera: (box: null, area: null, seconds: number) => unknown } }).director.camera(null, null, 1);
          requestAnimationFrame(sample);
        }),
    );
    const travel = 0 - start.x;
    expect(travel).toBeGreaterThan(1000);
    // The first frames barely move (the old zoom-out jumped a quarter of the way at once)...
    expect(samples[0] ?? 0).toBeLessThan(start.x + travel * 0.05);
    // ...and every frame moves the same way, back to the whole app.
    samples.slice(1).forEach((x, index) => expect(x).toBeGreaterThanOrEqual(samples[index] ?? 0));
    await expect.poll(() => frameRect(page)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  test("rings a control where it is on screen, wherever the camera points", async ({ page }) => {
    const director = await open(page);
    await director("camera", TARGET, undefined, 0);
    const target = onScreen(TARGET, await frameRect(page));
    await director("tapApp", TARGET);
    const ring = await page.locator(".tap").evaluate((element) => ({
      x: Number.parseFloat((element as HTMLElement).style.left),
      y: Number.parseFloat((element as HTMLElement).style.top),
    }));
    expect(ring.x).toBeCloseTo(target.x + target.width / 2, 0);
    expect(ring.y).toBeCloseTo(target.y + target.height / 2, 0);
  });

  test("holds still when the app scrolls something out of the picture into view", async ({ page }) => {
    const director = await open(page);
    await director("camera", { x: 0, y: 0, width: 400, height: 300 }, undefined, 0);
    const before = await frameRect(page);
    // Focus scrolls a control into view; under the camera's zoom it is far off the picture.
    await page.frameLocator("#main").locator("#far").focus();
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0]);
    expect(await frameRect(page)).toEqual(before);
  });

  test("a new caption takes the old one off first, unless the picture changes with it", async ({ page }) => {
    const director = await open(page);
    const caption = page.locator("#caption");
    await director("caption", "Kicker", "First");
    await expect(caption).toHaveClass(/\bon\b/);
    const swapping = director("caption", "Kicker", "Second");
    await expect(caption).not.toHaveClass(/\bon\b/);
    await expect(page.locator("#title")).toHaveText("First");
    await swapping;
    await expect(page.locator("#title")).toHaveText("Second");
    await expect(caption).toHaveClass(/\bon\b/);
    // With the picture: at once, the caption never leaves.
    await page.evaluate(() => {
      const box = document.getElementById("caption");
      if (box) {
        new MutationObserver(() => {
          if (!box.classList.contains("on")) box.dataset["dropped"] = "";
        }).observe(box, { attributeFilter: ["class"] });
      }
    });
    await director("caption", "Kicker", "Third", "", "", true);
    await expect(page.locator("#title")).toHaveText("Third");
    await expect(caption).toHaveClass(/\bon\b/);
    await expect(caption).not.toHaveAttribute("data-dropped");
  });

  test("a dip takes the caption off and fades to black together", async ({ page }) => {
    const director = await open(page);
    await director("caption", "Kicker", "Title");
    await director("dip");
    await expect(page.locator("#caption")).not.toHaveClass(/\bon\b/);
    expect(await page.locator("#fade").evaluate((element) => (element as HTMLElement).style.opacity)).toBe("1");
  });

  test("a new page takes the picture whole", async ({ page }) => {
    const director = await open(page);
    await director("camera", TARGET, undefined, 0);
    await director("prepare", "/stage.html");
    await director("swap");
    expect(await frameRect(page)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});
