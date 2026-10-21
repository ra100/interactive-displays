import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, type FrameLocator, type Locator, test } from "@playwright/test";
import { type Box, directorOf, directorPage, union } from "./support/director.ts";
import { encode, slowMotion } from "./support/recorder.ts";
import { createManagedServer } from "./support/server.ts";
import { warpTime } from "./support/slowmo.ts";

// The showcase video: a five-minute tour of the consoles, show states, the ship schematic, the looks, the operator
// console, scripted interactions between displays and the editor, recorded from the real app. A director page
// (support/director.html) holds the app in a frame with a live display picture-in-picture or three displays side by
// side, captions, fades and a camera that frames what each beat is about; every press is ringed where it lands.
//   pnpm build && SHOWCASE=video pnpm test:e2e video
// Needs ffmpeg 5 or later with libx264 on the PATH. Writes docs/showcase/video/showcase.mp4.
//
// It records in slow motion (SLOWMO=5: the server and every page run at a fifth of real time, see
// support/slowmo.ts and support/recorder.ts) and plays the frames back at full speed, so a machine that draws a busy
// screen at 12 frames a second still gives a steady 30. SLOWMO=1 records in real time, for a quick look.

const OUT = path.join("docs", "showcase", "video", "showcase.mp4");
const PORT = 3016;
const FPS = 30;
const SLOWMO = Number(process.env["SLOWMO"] ?? 5);
const RATE = 1 / SLOWMO;
// The moment the server's clock and the pages' agree on.
const EPOCH = Date.now();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Waits `ms` of the video's time.
const wait = (ms: number) => sleep(ms * SLOWMO);

// Long enough to read a caption: a second and a half, and a quarter of a second a word.
const reading = (...texts: string[]) => 1500 + 250 * texts.join(" ").split(/\s+/).filter(Boolean).length;

// Where the camera frames things while the caption sits top right and the display plays in the corner.
const LEFT_OF_CAPTION: Box = { x: 0, y: 0, width: 1060, height: 1080 };
// Above a caption in the bottom left.
const ABOVE_CAPTION: Box = { x: 0, y: 0, width: 1920, height: 860 };
// The whole app above the caption, for screens whose every corner matters.
const BAND: Box = { x: 0, y: 0, width: 1920, height: 835 };

test.describe("showcase video", () => {
  test.skip(process.env["SHOWCASE"] !== "video", "set SHOWCASE=video to record the showcase video");

  const server = createManagedServer(PORT, { SLOWMO_RATE: String(RATE), SLOWMO_EPOCH: String(EPOCH) }, [
    "--import",
    "./tests/e2e/support/slowServer.ts",
  ]);

  test.beforeAll(async () => {
    await server.start();
  });

  test.afterAll(async () => {
    await server.stop();
  });

  test("records the tour", async ({ page }) => {
    test.setTimeout((8 + 6 * SLOWMO) * 60_000);
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
    const assignPip = (screen: string) => api("PUT", "/api/displays/pip", { screen, name: "Tactical 2" });
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
    await assign("bridge");

    // Slow motion: the pages' clocks and timers through an init script, their CSS animations and transitions
    // through the DevTools protocol.
    await page.context().addInitScript(warpTime, { rate: RATE, epoch: EPOCH });
    const slow = await slowMotion(page, RATE);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.route(`${server.url}/director.html`, (route) => route.fulfill({ contentType: "text/html", body: directorPage() }));
    await page.goto(`${server.url}/director.html`);
    await page.evaluate(() => document.fonts.ready);
    const director = directorOf(page);
    const app: FrameLocator = page.frameLocator("#main");
    // Long waits on the app run in slow motion too.
    const soon = { timeout: 10_000 * SLOWMO };

    let place = "";
    let readBy = 0;
    // A caption replacing one on screen takes it off first, unless the picture changes with it (`instant`).
    const caption = async (kicker: string, title: string, subtitle = "", instant = false) => {
      await director("caption", kicker, title, subtitle, place, instant);
      readBy = Date.now() + reading(title, subtitle) * SLOWMO;
    };
    // Holds for `ms`, and at least until the caption has been read.
    const hold = (ms = 0) => sleep(Math.max(ms * SLOWMO, readBy - Date.now()));
    // Dip to black, change what is behind, wait until it is ready and come back.
    const cut = async (change: () => Promise<unknown>, ready: () => Promise<unknown> = async () => undefined) => {
      await hold();
      await director("dip");
      await wait(400);
      await director("camera", null, null, 0);
      await change();
      await ready();
      expect(await slow.playbackRate(), "animations still run in slow motion").toBeCloseTo(RATE);
      await wait(450);
      await director("fade", false);
      await wait(350);
    };
    // The display in the main frame shows this screen (in this theme).
    const showing = (screen: string, look?: string) =>
      expect(app.locator(`[data-screen-id="${screen}"]${look ? `[data-theme="${look}"]` : ""}`)).toBeVisible(soon);

    // Where things are in the app, in its own pixels (the camera's moves do not change them).
    const boxOf = async (...targets: Locator[]): Promise<Box> =>
      union(
        await Promise.all(
          targets.map((target) =>
            target.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }),
          ),
        ),
      );
    // Frames the targets in an area of the picture and waits for the move to end.
    const focus = async (targets: Locator[], area?: Box, seconds = 1.6) => director("camera", await boxOf(...targets), area ?? null, seconds);
    const wide = (seconds = 1.4) => director("camera", null, null, seconds);
    // The whole app above the caption.
    const band = (seconds = 0) => director("camera", null, BAND, seconds);
    // A press: a ring where the control is on screen, then the click as it lands.
    const press = async (control: Locator) => {
      await director("tapApp", await boxOf(control));
      await wait(200);
      await control.click();
    };
    const choose = async (field: Locator, value: string | { label: string }) => {
      await director("tapApp", await boxOf(field));
      await wait(200);
      await field.selectOption(value);
    };
    // Scrolls the panel around a target so it sits near the top (or as far as the panel goes), gently, over `ms` of
    // the video's time.
    const glide = (target: Locator, ms = 900) =>
      target.evaluate(
        (element, duration) =>
          new Promise<void>((resolve) => {
            let panel = element.parentElement;
            while (panel && !(panel.scrollHeight > panel.clientHeight && /auto|scroll/.test(getComputedStyle(panel).overflowY))) {
              panel = panel.parentElement;
            }
            if (!panel) return resolve();
            const scroller = panel;
            const from = scroller.scrollTop;
            const wanted = from + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24;
            const to = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, wanted));
            const start = performance.now();
            const step = () => {
              const done = Math.min((performance.now() - start) / duration, 1);
              const eased = done < 0.5 ? 4 * done ** 3 : 1 - (-2 * done + 2) ** 3 / 2;
              scroller.scrollTop = from + (to - from) * eased;
              if (done < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          }),
        ms,
      );

    // Title, over the first console, loaded and raised under the black before the recording starts.
    await director("go", "/d/video");
    await showing("bridge");
    // The other looks' fonts, so the first frame of a re-skin is not drawn in a stand-in.
    await app
      .locator("body")
      .evaluate(() => Promise.all(["400 1em Rajdhani", "600 1em Rajdhani", "1em 'Share Tech Mono'", "1em VT323"].map((font) => document.fonts.load(font))));
    await director("card", "Interactive Displays", "Live sci-fi interfaces for a film set. One server drives every screen, in sync.");
    await wait(2500);
    const frames = await slow.record(mkdtempSync(path.join(tmpdir(), "showcase-frames-")), FPS);
    await director("fade", false);
    await wait(5500);
    await director("card", "");
    await wait(900);

    // Consoles: the title dissolves into the first one.
    await director("accent", "#ff9c00");
    for (const [index, [screen, title, subtitle]] of (
      [
        ["bridge", "Bridge operations", "Sidebar layout, readings bound to the show's live signals"],
        ["engineering", "Main engineering", "Warp core output follows a live show signal"],
        ["tactical", "Tactical", "Weapons, contacts and the ship's tactical plot"],
        ["weapons-control", "Weapons control", "Shields by facing, phaser banks and the targeting scanner"],
        ["conn", "Helm control", "Heading, warp ladder and the plotted course"],
        ["astrometrics", "Astrometrics", "Planetary survey, subspace carrier and spectral analysis"],
        ["sensors", "Long range sensors", "Sweep, contacts and subspace noise"],
        ["operations", "Operations", "Power, transporter buffer, deck relays and the sensor net"],
      ] as const
    ).entries()) {
      if (index > 0) {
        await cut(
          () => assign(screen),
          () => showing(screen),
        );
      }
      await caption("Consoles · LCARS", title, subtitle);
      await hold(4000);
    }

    // Show states, on Main engineering, whole above the caption: its banner, warp core and relays follow the state.
    await cut(
      async () => {
        await assign("engineering");
        await band();
      },
      () => showing("engineering"),
    );
    await caption("Show states", "Normal", "The operator sets the state; every display follows within 100 ms");
    await hold(3500);
    for (const [id, title, subtitle, ms] of [
      ["yellow-alert", "Yellow alert", "A banner and the alert colours on every display", 3500],
      ["red-alert", "Red alert", "The warp core runs hot: readings swing to their alert ranges", 4500],
      ["damaged", "Hull breach", "Flicker, damage control and alarms", 4500],
      ["normal", "All clear", "", 3000],
    ] as const) {
      // The old caption goes, the state changes, the new one comes.
      await director("hide");
      await wait(400);
      await state(id);
      await caption("Show states", title, subtitle);
      await hold(ms);
    }

    // The ship schematic, whole above the caption. Its colour changes under the black, not on the caption leaving.
    await cut(
      async () => {
        await director("accent", "#9999ff");
        await assign("schematic");
        await band();
      },
      () => showing("schematic"),
    );
    await caption("Ship schematic", "Master systems display", "Line art traced from the Norway class Blender model");
    await hold(6500);
    await cut(
      async () => {
        await assign("ship-views");
        await band();
      },
      () => showing("ship-views"),
    );
    await caption("Ship schematic", "Every view and mode", "Tactical, engineering, damage control and the turning lines plan");
    await hold(7000);
    await cut(
      async () => {
        await assign("ship-bow");
        await band();
      },
      () => showing("ship-bow"),
    );
    await caption("Ship schematic", "Bow up in tall boxes", "Labels sized to the text around them, never overlapping");
    await hold(5000);
    // Red alert, close on the tactical panel where the weapons are; then the whole display for the hull breach.
    await cut(
      async () => {
        await assign("schematic");
        await band();
      },
      () => showing("schematic"),
    );
    place = "right";
    await focus([app.locator('[data-node-id="msd-dorsal"]')], LEFT_OF_CAPTION);
    await state("red-alert");
    await caption("Ship schematic", "Red alert", "Phasers and the torpedo launcher arm");
    await hold(4000);
    await director("hide");
    place = "";
    await band(1.4);
    await state("damaged");
    await caption("Ship schematic", "Hull breach", "Every view turns to damage control");
    await hold(4000);

    // Looks: LCARS eras, then the other themes. A re-skin and its caption change together.
    await cut(
      async () => {
        await state("normal");
        await assign("weapons-control");
      },
      () => showing("weapons-control"),
    );
    await director("accent", "#ff9c00");
    for (const [variant, title, subtitle] of [
      [undefined, "LCARS · The Next Generation", "The same screen, re-skinned live"],
      ["ds9", "LCARS · Deep Space Nine", ""],
      ["voyager", "LCARS · Voyager", ""],
      ["nemesis", "LCARS · Nemesis", ""],
      ["lower-decks", "LCARS · Lower Decks", ""],
      ["picard", "LCARS · Picard", ""],
    ] as const) {
      await theme("lcars", variant);
      await caption("Looks", title, subtitle, true);
      await hold(3000);
    }
    await director("accent", "#3fd8ff");
    await theme("hud");
    await caption("Looks", "Holo HUD", "Glass panels, hairlines and glow", true);
    await hold(4000);
    await theme("hud", "amber");
    await caption("Looks", "Holo HUD · Amber visor", "", true);
    await hold(3000);
    await cut(
      async () => {
        await assign("schematic");
        await theme("hud");
        await band();
      },
      () => showing("schematic", "hud"),
    );
    await caption("Looks", "Holo HUD", "The master systems display");
    await hold(4000);
    await director("accent", "#33ff66");
    await theme("crt");
    await caption("Looks", "Terminal", "Green phosphor and vector strokes", true);
    await hold(4000);
    await cut(
      async () => {
        await assign("conn");
        await theme("crt", "amber");
      },
      () => showing("conn", "crt"),
    );
    await caption("Looks", "Terminal · Amber phosphor");
    await assignPip("tactical");
    await director("prepare", "/operator");
    await director("preloadPip", "/d/pip");
    await hold(3000);

    // The operator console, with the display it drives in the corner.
    place = "right";
    const cues = app.locator("section[aria-labelledby=cues-title]");
    await cut(
      async () => {
        await theme("lcars");
        // The first GO runs Contact: the top of the scene has run before the take.
        await api("POST", "/api/cues/top/run");
        // The displays of the next beat are smaller panels than the 90" default, so their buttons show at the
        // size of the three frames side by side.
        await api("PUT", "/api/displays/tactical-1", { inches: 30 });
        await api("PUT", "/api/displays/viewscreen-1", { inches: 20 });
        await api("PUT", "/api/displays/engineering-1", { inches: 20 });
        await director("accent", "#ff9c00");
        await director("swap");
        await director("pip", "/d/pip");
      },
      () => expect(app.getByRole("button", { name: "GO", exact: true })).toBeEnabled(soon),
    );
    await caption("Operator console", "Run the scene", "Cues set the state, live values and screens on every display at once");
    await hold(2500);
    await focus([cues], LEFT_OF_CAPTION);
    await hold();
    for (const [title, ms] of [
      ["GO · Contact", 3800],
      ["GO · First hit", 4200],
      ["GO · Hull breach", 4200],
      ["GO · All clear", 3500],
    ] as const) {
      // The cue list scrolls: bring the last cue in before it is next, so the viewer sees it marked and then run.
      if (title === "GO · Hull breach") await glide(cues.getByRole("listitem", { name: "All clear" }), 700);
      await press(app.getByRole("button", { name: "GO", exact: true }));
      await caption("Operator console", title);
      await hold(ms);
    }
    // A little less close than the cue list: the state buttons and what is around them.
    await director("hide");
    await focus([app.locator("section[aria-labelledby=states-title]")], { x: 0, y: 0, width: 800, height: 1080 });
    await caption("Operator console", "One tap: red alert", "Or a state, a blackout, a value, a screen per display");
    await wait(1200);
    await press(app.getByRole("button", { name: /Red alert/ }));
    await director("preloadSplit", [
      ["/d/tactical-1", "Tactical 1 · pressed here"],
      ["/d/viewscreen-1", "Viewscreen"],
      ["/d/engineering-1", "Engineering 1"],
    ]);
    await hold(3000);
    await director("hide");
    await press(app.getByRole("button", { name: /^Normal$/i }));
    await hold(1500);

    // Scripted interactions: one button on Tactical plays out on the viewscreen and, a beat later, on engineering.
    // The caption says what to watch before the press.
    place = "split";
    await cut(async () => {
      await director("pip", "");
      await director("stopwatch", "T + 0.0 s");
      await director("split", true);
    });
    await caption(
      "Scripted interactions",
      "One button, three displays",
      "Photon torpedoes on Tactical replays the viewscreen; 1.5 s later engineering sounds the alert and changes screen",
    );
    await hold();
    const torpedoes = page.frameLocator("#s1").getByRole("button", { name: /photon torpedoes/i });
    const box = await torpedoes.boundingBox();
    if (box) await director("tap", box.x + box.width / 2, box.y + box.height / 2);
    await director("watchBeat");
    await torpedoes.click();
    await expect(page.frameLocator("#s3").getByRole("button", { name: /back/i })).toBeVisible({ timeout: 4000 * SLOWMO });
    await director("prepare", "/builder/tactical");
    await hold(2000);

    // How it is set up: the button's actions in the editor.
    place = "";
    const outline = app.getByRole("tree", { name: "Outline" });
    await cut(
      async () => {
        await director("split", false);
        await director("swap");
        await api("PUT", "/api/displays/engineering-1", { screen: "engineering" });
      },
      () => expect(outline).toBeVisible(soon),
    );
    await press(outline.getByRole("treeitem", { name: /Button · Photon torpedoes/ }));
    await caption("Scripted interactions", "Set up in the editor", "The button's actions, in the inspector");
    const actions = app.getByRole("region", { name: "When used" }).locator("li.action-item");
    const trigger = actions.nth(1);
    await expect(trigger.getByRole("combobox", { name: "Control" })).toBeVisible(soon);
    await hold(1500);
    await glide(trigger);
    const triggerParts = [trigger.locator(".action-item__head"), trigger.getByRole("combobox", { name: "Runs on" }), trigger.locator(".tool-field__hint").first()];
    await director("hide");
    await focus(triggerParts, ABOVE_CAPTION);
    await caption("Scripted interactions", "Runs on", "This display, every other one, all of them, or the displays and screens you choose");
    await hold();
    // Back out to scroll on: a long scroll in close-up is a blur.
    const alarm = actions.nth(2);
    const navigate = actions.nth(3);
    await director("hide");
    await wide(1.2);
    await glide(alarm.locator(".action-item__head"), 1400);
    // Close on the alert's wait and the screen change under it, near enough to read.
    await focus([alarm.locator(".action-wait"), navigate.locator(".action-item__head"), navigate.getByRole("combobox", { name: "Screen", exact: true })], ABOVE_CAPTION, 1.4);
    await caption("Scripted interactions", "Wait (seconds)", "The alert on engineering waits 1.5 s, and so does the screen change after it");
    await director("prepare", "/builder");
    await hold();

    // The editor: change a widget, publish, generate.
    place = "corner";
    await cut(
      async () => {
        await director("accent", "#9999ff");
        await director("swap");
      },
      () => expect(app.getByRole("button", { name: "Generate", exact: true })).toBeVisible(soon),
    );
    await caption("Editor", "Screen library", "Every screen with a live thumbnail");
    await director("prepare", "/builder/tactical");
    await hold(3000);
    await cut(
      async () => {
        place = "";
        await director("swap");
      },
      () => expect(outline).toBeVisible(soon),
    );
    await caption("Editor", "Edit any screen", "Pick a widget in the outline or straight in the preview");
    await hold();
    // The outline sits under the caption: it goes before the press.
    await director("hide");
    await wait(450);
    await press(outline.getByRole("treeitem", { name: /Ship schematic/ }));
    const selection = app.getByRole("tabpanel", { name: "Selection" });
    const schematic = app.getByRole("region", { name: "Preview" }).locator('[data-node-id="tac-ship"]').first();
    await wait(800);
    await director("preloadPip", "/d/pip");
    await focus([schematic, selection.getByLabel("View", { exact: true }), selection.getByLabel("Mode", { exact: true })], ABOVE_CAPTION);
    await caption("Editor", "Change it in the inspector", "Every prop of every widget, from its schema");
    await wait(1800);
    for (const [field, value] of [
      ["View", "side"],
      ["Mode", "engineering"],
      ["View", "turn"],
    ] as const) {
      await choose(selection.getByLabel(field, { exact: true }), value);
      await hold(2600);
    }
    // Publish, with the display on set in the corner before the press, so the change is seen to reach it.
    await director("hide");
    await wide();
    await press(app.getByRole("button", { name: "Publish", exact: true }));
    const publish = app.getByRole("dialog", { name: /Publish/ });
    await expect(publish).toBeVisible(soon);
    await director("pip", "/d/pip");
    await focus([publish, schematic], { x: 0, y: 0, width: 1100, height: 600 }, 1.2);
    await caption("Editor", "Publish", "The display on set picks it up at once");
    await wait(1500);
    await press(publish.getByRole("button", { name: "Publish", exact: true }));
    await director("prepare", "/builder");
    await hold(4000);
    await cut(
      async () => {
        await director("pip", "");
        await director("swap");
      },
      () => expect(app.getByRole("button", { name: "Generate", exact: true })).toBeVisible(soon),
    );
    await caption("Editor", "One-click generation", "A content pack recipe, a seed and the display's shape give a finished screen");
    await wait(1000);
    await press(app.getByRole("button", { name: "Generate", exact: true }));
    const dialog = app.getByRole("dialog", { name: "Generate a screen" });
    await expect(dialog).toBeVisible(soon);
    await focus([dialog], ABOVE_CAPTION, 1.2);
    await hold(600);
    await choose(dialog.getByLabel("Section"), { label: "Tactical" });
    await wait(900);
    await director("tapApp", await boxOf(dialog.getByRole("textbox", { name: "Seed" })));
    await dialog.getByRole("textbox", { name: "Seed" }).fill("4");
    await hold(1200);
    // Creating opens the new screen in the editor, which loads first: the press, then the click under black.
    const create = dialog.getByRole("button", { name: "Create and edit" });
    await director("tapApp", await boxOf(create));
    await wait(300);
    await director("fade", true);
    await wait(400);
    await director("camera", null, null, 0);
    await create.click();
    const regenerate = app.getByRole("button", { name: "Regenerate", exact: true });
    await expect(regenerate).toBeVisible(soon);
    await wait(450);
    await director("fade", false);
    await wait(350);
    await hold(3000);
    await assign("schematic");
    await director("hide");
    await wait(450);
    await press(regenerate);
    await caption("Editor", "Regenerate", "A fresh layout from the same recipe, one Undo away");
    await hold(3000);
    await press(regenerate);
    await director("prepare", "/d/video");
    await hold(3000);

    // Close: the card comes up under the black.
    await cut(
      async () => {
        await director("swap");
        await director("card", "Interactive Displays", "LCARS · Holo HUD · Terminal · operator console · editor · one-click generation");
      },
      () => wait(400),
    );
    await wait(5600);
    await director("fade", true);
    await wait(1200);

    const list = await frames.stop();
    mkdirSync(path.dirname(OUT), { recursive: true });
    const encoded = encode(list, OUT, FPS);
    rmSync(path.dirname(list), { recursive: true, force: true });
    expect(encoded.status).toBe(0);
  });
});
