import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { concatList, encode, frameTicker, slowMotion } from "./support/recorder.ts";

// The showcase video's recorder: which screencast frames make the video, how long each is held, and slow motion
// that lasts the whole recording.

const kept = (fps: number, rate: number, frames: [string, number][]) => {
  const out: [string, number][] = [];
  const ticker = frameTicker<string>(fps, rate, (name, tick) => out.push([name, tick]));
  frames.forEach(([name, time]) => ticker.add(name, time));
  ticker.flush();
  return out;
};

test.describe("showcase recorder", () => {
  test("keeps the frame on screen at each tick of the video", () => {
    // At 30 fps the ticks are 33 ms apart: b replaces a before the first tick, c holds from tick 2 to tick 4.
    expect(
      kept(30, 1, [
        ["start", 1],
        ["a", 1.01],
        ["b", 1.02],
        ["c", 1.05],
        ["d", 1.13],
      ]),
    ).toEqual([
      ["start", 0],
      ["b", 1],
      ["c", 2],
      ["d", 4],
    ]);
  });

  test("drops a frame that arrives after a newer one, so the picture never steps back", () => {
    // Slow motion at a third: a second of the page is a third of a second of video.
    expect(
      kept(30, 1 / 3, [
        ["p", 0.97],
        ["b", 1.03],
        ["c", 1.08],
        ["late", 1.0],
        ["d", 1.2],
      ]),
    ).toEqual([
      ["p", 0],
      ["b", 1],
      ["c", 2],
      ["d", 3],
    ]);
  });

  test("holds each frame until the next one's tick, at the video's frame rate", () => {
    expect(
      concatList(
        [
          { name: "a.jpg", tick: 0 },
          { name: "b.jpg", tick: 1 },
          { name: "c.jpg", tick: 4 },
        ],
        30,
      ),
    ).toBe(
      [
        "ffconcat version 1.0",
        "file a.jpg",
        "option framerate 30",
        "duration 0.033333",
        "file b.jpg",
        "option framerate 30",
        "duration 0.100000",
        "file c.jpg",
        "option framerate 30",
        "duration 0.033333",
        "file c.jpg",
        "option framerate 30",
        "",
      ].join("\n"),
    );
  });

  test("ffmpeg plays every frame for its ticks, none dropped or doubled", () => {
    // The concat list's `option` lines need ffmpeg 5 or later.
    const version = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
    test.skip(version.status !== 0 || Number(/^ffmpeg version n?(\d+)\./.exec(version.stdout)?.[1] ?? 5) < 5, "needs ffmpeg 5 or later");
    const dir = mkdtempSync(path.join(tmpdir(), "recorder-"));
    try {
      // Ten greys, one a tick, then one held for three.
      const greys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      greys.forEach((grey) => {
        const level = (grey * 20).toString(16).padStart(2, "0");
        spawnSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", `color=c=0x${level.repeat(3)}:s=16x16`, "-frames:v", "1", path.join(dir, `${grey}.jpg`)]);
      });
      const ticks = [...greys.slice(0, 10).map((grey) => ({ name: `${grey}.jpg`, tick: grey })), { name: "10.jpg", tick: 13 }];
      const list = path.join(dir, "frames.txt");
      writeFileSync(list, concatList(ticks, 30));
      const raw = path.join(dir, "out.gray");
      expect(encode(list, raw, 30, ["-f", "rawvideo", "-pix_fmt", "gray"]).status).toBe(0);
      const bytes = readFileSync(raw);
      const shown = Array.from({ length: bytes.length / 256 }, (_, index) => Math.round((bytes[index * 256 + 136] ?? 0) / 20));
      // The last frame is listed twice, so ffmpeg keeps its duration: it ends the video one tick longer.
      expect(shown).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 9, 10, 10]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("animations stay slow for the whole recording, also when a frame loads a page", async ({ page }) => {
    await page.route("**/recorded.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><body><div id="box" style="width:20px;height:20px;background:#fff;opacity:0;transition:opacity 1s linear"></div><iframe id="frame"></iframe></body>`,
      }),
    );
    const slow = await slowMotion(page, 0.5);
    await page.goto("/recorded.html");
    const dir = mkdtempSync(path.join(tmpdir(), "recorder-"));
    try {
      const recording = await slow.record(dir, 30);
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const frame = document.getElementById("frame") as HTMLIFrameElement;
            frame.addEventListener("load", resolve, { once: true });
            frame.src = "/d/test";
          }),
      );
      expect(await slow.playbackRate()).toBe(0.5);
      // Half a second into a one-second fade at half speed: a quarter of the way.
      const opacity = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const box = document.getElementById("box") as HTMLElement;
            box.getBoundingClientRect();
            box.style.opacity = "1";
            setTimeout(() => resolve(Number(getComputedStyle(box).opacity)), 500);
          }),
      );
      expect(opacity).toBeGreaterThan(0.15);
      expect(opacity).toBeLessThan(0.4);
      const list = await recording.stop();
      expect(readFileSync(list, "utf8")).toContain("file frame-000000.jpg");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
