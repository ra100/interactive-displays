import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type FrameLocator, type Page, test } from "@playwright/test";
import { createManagedServer } from "./support/server.ts";

// The showcase video: a four-minute tour of the consoles, show states, the ship schematic, the looks, the operator
// console, scripted interactions between displays and the editor, recorded from the real app. A director page
// (support/director.html) holds the app in a frame with a live display picture-in-picture or three displays side by
// side, captions and fades; Chrome's screencast frames keep their real times and ffmpeg turns them into a 30 fps
// H.264 video.
//   pnpm build && SHOWCASE=video pnpm test:e2e video
// Needs ffmpeg with libx264 on the PATH. Writes docs/showcase/video/showcase.mp4.

const OUT = path.join("docs", "showcase", "video", "showcase.mp4");
const PORT = 3016;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The director page with the app's own fonts, whose built file names carry a hash.
const directorPage = (): string => {
  const assets = readdirSync(path.join("packages", "app", "dist", "assets"));
  const font = (prefix: string) => assets.find((name) => name.startsWith(prefix) && name.endsWith(".woff2")) ?? "";
  return readFileSync(path.join("tests", "e2e", "support", "director.html"), "utf8")
    .replace("__ANTONIO700__", font("antonio-latin-700-normal"))
    .replace("__ANTONIO400__", font("antonio-latin-400-normal"))
    .replace("__RAJDHANI600__", font("rajdhani-latin-600-normal"))
    .replace("__RAJDHANI400__", font("rajdhani-latin-400-normal"));
};

// Chrome's screencast frames, written as they come with their times; stop() writes an ffmpeg concat list that
// gives each frame its real duration and returns its path.
const screencast = async (page: Page, dir: string) => {
  const cdp = await page.context().newCDPSession(page);
  const frames: { name: string; time: number }[] = [];
  let stopped = false;
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    // Frames still in flight after stop() are dropped: their folder may already be gone.
    if (stopped) return;
    const name = `frame-${String(frames.length).padStart(6, "0")}.jpg`;
    writeFileSync(path.join(dir, name), Buffer.from(data, "base64"));
    frames.push({ name, time: metadata.timestamp ?? 0 });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  return {
    stop: async () => {
      stopped = true;
      await cdp.send("Page.stopScreencast");
      await cdp.detach();
      const lines = ["ffconcat version 1.0"];
      frames.forEach((frame, index) => {
        const next = frames[index + 1];
        lines.push(`file ${frame.name}`, `duration ${(next ? next.time - frame.time : 0.5).toFixed(4)}`);
      });
      const last = frames.at(-1);
      if (last) lines.push(`file ${last.name}`);
      const list = path.join(dir, "frames.txt");
      writeFileSync(list, `${lines.join("\n")}\n`);
      return list;
    },
  };
};

test.describe("showcase video", () => {
  test.skip(process.env["SHOWCASE"] !== "video", "set SHOWCASE=video to record the showcase video");

  const server = createManagedServer(PORT);

  test.beforeAll(async () => {
    await server.start();
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("records the tour", async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const api = async (method: string, route: string, body?: unknown) => {
      const response = await fetch(server.url + route, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect(response.ok, `${method} ${route}`).toBe(true);
    };
    const state = (id: string) => api("POST", "/api/state", { state: id });
    const theme = (id: string, variant?: string) => api("PUT", "/api/show/theme", variant ? { id, variant } : { id });
    const assign = (screen: string) => api("PUT", "/api/displays/video", { screen });
    // The display in the corner is a display of its own, so it can load before it shows.
    const assignPip = (screen: string) => api("PUT", "/api/displays/pip", { screen });
    const shipScreen = async (id: string, name: string, columns: number, cells: Record<string, unknown>[]) => {
      await api("POST", "/api/screens", {
        schemaVersion: 2,
        id,
        name,
        root: {
          id: "root",
          type: "container",
          layout: {
            kind: "grid",
            columns: Array.from({ length: columns }, () => "1fr"),
            rows: Array.from({ length: Math.ceil(cells.length / columns) }, () => "1fr"),
            gap: "medium",
          },
          children: cells.map((props, index) => ({ node: { id: `ship-${index}`, type: "widget", kind: "ship-schematic", props } })),
        },
      });
      await api("POST", `/api/screens/${id}/publish`, {});
    };

    await api("PUT", "/api/signals/shields/value", { value: 85 });
    await shipScreen("ship-views", "Ship views", 2, [
      { view: "top", mode: "tactical", shields: 62, armed: true, label: "Tactical" },
      { view: "side", mode: "engineering", power: 90, label: "Engineering" },
      { view: "front", mode: "damage", damaged: ["nacelles", "torpedoes"], offline: ["deflector"], label: "Damage control" },
      { view: "turn", mode: "schematic", highlight: ["bridge"], label: "Norway class" },
    ]);
    await shipScreen("ship-bow", "Bow up", 3, [
      { view: "top", mode: "tactical", shields: 40, armed: true, label: "Tactical" },
      { view: "top", mode: "engineering", label: "Engineering" },
      { view: "top", mode: "damage", damaged: ["phasers"], offline: ["impulse"], label: "Damage control" },
    ]);
    await assign("schematic");

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.route(`${server.url}/director.html`, (route) => route.fulfill({ contentType: "text/html", body: directorPage() }));
    await page.goto(`${server.url}/director.html`);
    await page.evaluate(() => document.fonts.ready);
    const director = (name: string, ...args: unknown[]) =>
      page.evaluate(
        ([fn, values]) => (window as unknown as { director: Record<string, (...rest: unknown[]) => unknown> }).director[fn]?.(...values),
        [name, args] as const,
      );
    const app: FrameLocator = page.frameLocator("#main");
    let place = "";
    const caption = (kicker: string, title: string, subtitle = "") => director("caption", kicker, title, subtitle, place);
    // Dip to black, change what is behind, come back.
    const cut = async (change: () => Promise<unknown>) => {
      await director("hide");
      await director("fade", true);
      await sleep(400);
      await change();
      await sleep(450);
      await director("fade", false);
      await sleep(350);
    };

    // Title, over the first screen, loaded before the recording starts.
    await director("go", "/d/video");
    await sleep(2500);
    const frames = await screencast(page, mkdtempSync(path.join(tmpdir(), "showcase-frames-")));
    await director("card", "Interactive Displays", "Live sci-fi interfaces for a film set. One server drives every screen, in sync.");
    await director("fade", false);
    await sleep(5500);
    await director("card", "");
    await sleep(900);

    // Consoles.
    await director("accent", "#ff9c00");
    for (const [screen, title, subtitle] of [
      ["bridge", "Bridge operations", "Sidebar layout, readings that walk on their own"],
      ["engineering", "Main engineering", "Warp core output follows a live show signal"],
      ["tactical", "Tactical", "Weapons, contacts and the ship's tactical plot"],
      ["weapons-control", "Weapons control", "Shields by facing, phaser banks and the targeting scanner"],
      ["conn", "Helm control", "Heading, warp ladder and the plotted course"],
      ["astrometrics", "Astrometrics", "Star chart, subspace spectrum and survey scans"],
      ["sensors", "Long range sensors", "Waveforms, scans and contacts"],
      ["operations", "Operations", "Transporters, computer core and shuttlebay"],
    ] as const) {
      await cut(() => assign(screen));
      await caption("Consoles · LCARS", title, subtitle);
      await sleep(3800);
    }

    // Show states.
    await cut(() => assign("tactical"));
    await caption("Show states", "Normal", "The operator sets the state; every display follows within 100 ms");
    await sleep(3000);
    for (const [id, title, subtitle, hold] of [
      ["yellow-alert", "Yellow alert", "Shields up, banners on every display", 3500],
      ["red-alert", "Red alert", "Weapons arm, readings swing to their alert ranges", 4500],
      ["damaged", "Hull breach", "Flicker, damage control and alarms", 4500],
      ["normal", "All clear", "", 2500],
    ] as const) {
      await state(id);
      await caption("Show states", title, subtitle);
      await sleep(hold);
    }

    // The ship schematic.
    await director("accent", "#9999ff");
    await cut(() => assign("schematic"));
    await caption("Ship schematic", "Master systems display", "Line art traced from the Norway class Blender model");
    await sleep(6500);
    await cut(() => assign("ship-views"));
    await caption("Ship schematic", "Every view and mode", "Tactical, engineering, damage control and the turning lines plan");
    await sleep(7000);
    await cut(() => assign("ship-bow"));
    await caption("Ship schematic", "Bow up in tall boxes", "Labels sized to the text around them, never overlapping");
    await sleep(4500);
    await cut(() => assign("schematic"));
    await state("red-alert");
    await caption("Ship schematic", "Red alert", "Phasers and the torpedo launcher arm");
    await sleep(4000);
    await state("damaged");
    await caption("Ship schematic", "Hull breach", "Every view turns to damage control");
    await sleep(4000);
    await state("normal");

    // Looks: LCARS eras, then the other themes.
    await cut(() => assign("weapons-control"));
    await director("accent", "#ff9c00");
    for (const [variant, title] of [
      [undefined, "LCARS · The Next Generation"],
      ["ds9", "LCARS · Deep Space Nine"],
      ["voyager", "LCARS · Voyager"],
      ["nemesis", "LCARS · Nemesis"],
      ["lower-decks", "LCARS · Lower Decks"],
      ["picard", "LCARS · Picard"],
    ] as const) {
      await theme("lcars", variant);
      await caption("Looks", title, "The same screen, re-skinned live");
      await sleep(2400);
    }
    await director("accent", "#3fd8ff");
    await theme("hud");
    await caption("Looks", "Holo HUD", "Glass panels, hairlines and glow");
    await sleep(3800);
    await theme("hud", "amber");
    await caption("Looks", "Holo HUD · Amber visor");
    await sleep(2800);
    await cut(async () => {
      await assign("schematic");
      await theme("hud");
    });
    await caption("Looks", "Holo HUD", "The master systems display");
    await sleep(3500);
    await director("accent", "#33ff66");
    await theme("crt");
    await caption("Looks", "Terminal", "Green phosphor and vector strokes");
    await sleep(3800);
    await cut(async () => {
      await assign("conn");
      await theme("crt", "amber");
    });
    await caption("Looks", "Terminal · Amber phosphor");
    await assignPip("tactical");
    await director("prepare", "/operator");
    await director("preloadPip", "/d/pip");
    await sleep(2400);

    // The operator console, with the display it drives in the corner.
    place = "right";
    await cut(async () => {
      await theme("lcars");
      await director("accent", "#ff9c00");
      await director("swap");
      await director("pip", "/d/pip");
    });
    await caption("Operator console", "Run the scene", "Cues set the state, live values and screens on every display at once");
    await sleep(4000);
    for (const [title, hold] of [
      ["GO · Contact", 3800],
      ["GO · First hit", 4200],
      ["GO · Hull breach", 4200],
      ["GO · All clear", 3500],
    ] as const) {
      await app.getByRole("button", { name: "GO", exact: true }).click();
      await caption("Operator console", title);
      await sleep(hold);
    }
    await app.getByRole("button", { name: /Red alert/ }).click();
    await caption("Operator console", "One tap: red alert", "Or a state, a blackout, a value, a screen per display");
    await director("preloadSplit", [
      ["/d/tactical-1", "Tactical 1 · pressed here"],
      ["/d/viewscreen-1", "Viewscreen"],
      ["/d/engineering-1", "Engineering 1"],
    ]);
    await sleep(2500);
    await app.getByRole("button", { name: /^Normal$/i }).click();
    await sleep(1500);

    // Scripted interactions: one button on Tactical plays out on the viewscreen and, a beat later, on engineering.
    place = "split";
    await cut(async () => {
      await director("pip", "");
      await director("stopwatch", "T + 0.0 s");
      await director("split", true);
    });
    await caption("Scripted interactions", "One button, three displays", "Photon torpedoes on Tactical sets off a beat across the set");
    await sleep(4000);
    const torpedoes = page.frameLocator("#s1").getByRole("button", { name: /photon torpedoes/i });
    const box = await torpedoes.boundingBox();
    if (box) await director("tap", box.x + box.width / 2, box.y + box.height / 2);
    await director("watchBeat");
    await torpedoes.click();
    await caption("Scripted interactions", "Replay on the viewscreen", "It uses the viewscreen's own Replay button: it flashes there, the feed starts again");
    await expect(page.frameLocator("#s3").getByRole("button", { name: /back/i })).toBeVisible({ timeout: 4000 });
    await caption("Scripted interactions", "1.5 s later: engineering", "Every display showing Main engineering sounds the alert and goes to the master systems display");
    await director("prepare", "/builder/tactical");
    await sleep(5000);
    place = "";
    await cut(async () => {
      await director("split", false);
      await director("swap");
    });
    await api("PUT", "/api/displays/engineering-1", { screen: "engineering" });
    await caption("Scripted interactions", "Set up in the editor", "The button's actions, in the inspector");
    await app.getByRole("tree", { name: "Outline" }).getByRole("treeitem", { name: /Button · Photon torpedoes/ }).click();
    const actions = app.getByRole("region", { name: "When used" });
    await actions.getByRole("combobox", { name: "Control" }).scrollIntoViewIfNeeded();
    await sleep(2000);
    await director("hide");
    await director("zoom", 1.55, 1920, 540);
    await sleep(1000);
    await caption("Scripted interactions", "Runs on", "This display, every other one, all of them, or the displays and screens you choose");
    await sleep(4000);
    await director("hide");
    await actions.getByRole("combobox", { name: "Screen" }).scrollIntoViewIfNeeded();
    await sleep(800);
    await caption("Scripted interactions", "Wait (seconds)", "The alert and the screen change wait 1.5 s, so the beat plays out");
    await director("prepare", "/builder");
    await sleep(4000);
    await director("hide");
    await director("zoom", 1);
    await sleep(1300);

    // The editor: change a widget, publish, generate.
    await cut(async () => {
      await director("accent", "#9999ff");
      await director("pip", "");
      await director("swap");
    });
    await caption("Editor", "Screen library", "Every screen with a live thumbnail");
    await director("prepare", "/builder/tactical");
    await sleep(2500);
    await cut(() => director("swap"));
    await caption("Editor", "Edit any screen", "Pick a widget in the outline or straight in the preview");
    await sleep(2500);
    const selection = app.getByRole("tabpanel", { name: "Selection" });
    await app.getByRole("tree", { name: "Outline" }).getByRole("treeitem", { name: /Ship schematic/ }).click();
    await sleep(1500);
    await director("hide");
    await director("zoom", 1.55, 1920, 330);
    await director("preloadPip", "/d/pip");
    await sleep(1000);
    await caption("Editor", "Change it in the inspector", "Every prop of every widget, from its schema");
    for (const [field, value] of [
      ["View", "side"],
      ["Mode", "engineering"],
      ["View", "turn"],
    ] as const) {
      await selection.getByLabel(field, { exact: true }).selectOption(value);
      await sleep(2600);
    }
    await director("hide");
    await director("zoom", 1);
    await sleep(1300);
    await app.getByRole("button", { name: "Publish", exact: true }).click();
    await sleep(900);
    await app.getByRole("dialog", { name: /Publish/ }).getByRole("button", { name: "Publish", exact: true }).click();
    await director("pip", "/d/pip");
    await caption("Editor", "Publish", "The display on set picks it up at once");
    await director("prepare", "/builder");
    await sleep(4000);
    await cut(async () => {
      await director("pip", "");
      await director("swap");
    });
    await caption("Editor", "One-click generation", "A content pack recipe, a seed and the display's shape give a finished screen");
    await app.getByRole("button", { name: "Generate", exact: true }).click();
    const dialog = app.getByRole("dialog", { name: "Generate a screen" });
    await sleep(1500);
    await dialog.getByLabel("Section").selectOption({ label: "Tactical" });
    await dialog.getByRole("textbox", { name: "Seed" }).fill("4");
    await sleep(1200);
    await dialog.getByRole("button", { name: "Create and edit" }).click();
    await sleep(4000);
    await assign("schematic");
    for (const round of [1, 2]) {
      await app.getByRole("button", { name: "Regenerate", exact: true }).click();
      await caption("Editor", "Regenerate", "A new layout around anything locked, one Undo away");
      if (round === 2) await director("prepare", "/d/video");
      await sleep(3000);
    }

    // Close.
    await cut(() => director("swap"));
    await director("card", "Interactive Displays", "LCARS · Holo HUD · Terminal · operator console · editor · one-click generation");
    await sleep(6000);
    await director("fade", true);
    await sleep(1200);

    const list = await frames.stop();
    mkdirSync(path.dirname(OUT), { recursive: true });
    const encoded = spawnSync(
      "ffmpeg",
      ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-tune", "animation", "-movflags", "+faststart", OUT],
      { stdio: "inherit" },
    );
    rmSync(path.dirname(list), { recursive: true, force: true });
    expect(encoded.status).toBe(0);
  });
});
