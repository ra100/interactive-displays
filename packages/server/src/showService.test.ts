import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_DIR } from "./paths.ts";
import type { Screen } from "@interactive-displays/core";
import { createShowService, type ShowEvent, type ShowService } from "./showService.ts";
import { ensureSeeded, listRevisions, loadActiveShow } from "./storage/repository.ts";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let dataDir: string;

const open = async (): Promise<ShowService> => {
  const loaded = await loadActiveShow(dataDir, decorCatalog, log);
  return createShowService({ dataDir, decor: decorCatalog, log, loaded });
};

const record = (service: ShowService): ShowEvent[] => {
  const events: ShowEvent[] = [];
  service.subscribe((event) => events.push(event));
  return events;
};

const readShowFile = async (file: string) => JSON.parse(await readFile(path.join(dataDir, "shows/demo", file), "utf8"));

const newScreen = (id: string) => ({
  schemaVersion: 2,
  id,
  name: id,
  root: { id: "root", type: "container", layout: { kind: "stack", direction: "column" }, children: [] },
});

const addText = (id: string) => [
  { op: "insert", parent: "main-body", child: { node: { id, type: "widget", kind: "text", props: { text: id } } } },
];

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "displays-service-"));
  await ensureSeeded(dataDir, SEED_DIR, log);
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("show state", () => {
  it("starts in the show's first state", async () => {
    expect((await open()).state()).toBe("normal");
  });

  it("broadcasts and persists a state change, and restores it after a restart", async () => {
    const service = await open();
    const events = record(service);

    expect(await service.setState("red-alert")).toEqual({ ok: true, value: "red-alert" });
    expect(events).toEqual([{ type: "state", state: "red-alert" }]);
    expect((await readShowFile("runtime.json")).state).toBe("red-alert");

    expect((await open()).state()).toBe("red-alert");
  });

  it("rejects a state the show does not define", async () => {
    const service = await open();
    expect(await service.setState("plaid-alert")).toMatchObject({ ok: false, status: 404 });
    expect(service.state()).toBe("normal");
  });
});

describe("screens", () => {
  it("applies ops, bumps the revision, archives the old one and broadcasts", async () => {
    const service = await open();
    const events = record(service);

    const result = await service.applyOps("bridge", 0, addText("note"));
    expect(result).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(events).toEqual([{ type: "screen", screenId: "bridge" }]);
    expect((await listRevisions(dataDir, "demo", "bridge", 1)).map((entry) => entry.revision)).toEqual([1, 0]);
    expect((await readShowFile("screens/bridge.json")).revision).toBe(1);
  });

  it("rejects an edit based on a stale revision", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, addText("first"));

    expect(await service.applyOps("bridge", 0, addText("second"))).toMatchObject({ ok: false, status: 409, revision: 1 });
  });

  it("lets only one of two concurrent edits on the same revision through", async () => {
    const service = await open();
    const results = await Promise.all([
      service.applyOps("bridge", 0, addText("one")),
      service.applyOps("bridge", 0, addText("two")),
    ]);

    expect(results.map((result) => result.ok)).toEqual([true, false]);
    expect(service.loaded()?.screens.get("bridge")?.revision).toBe(1);
  });

  it("explains malformed and rejected ops", async () => {
    const service = await open();

    expect(await service.applyOps("bridge", 0, [{ op: "teleport" }])).toMatchObject({ ok: false, status: 400 });
    expect(await service.applyOps("bridge", 0, [{ op: "remove", id: "ghost" }])).toMatchObject({
      ok: false,
      status: 422,
    });
    expect(await service.applyOps("nope", 0, addText("x"))).toMatchObject({ ok: false, status: 404 });
  });

  it("refuses to edit locked nodes when asked to respect locks", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, [{ op: "set", id: "title", locked: true }]);

    const result = await service.applyOps("bridge", 1, [{ op: "update", id: "title", props: { text: "HELM" } }], {
      respectLocks: true,
    });
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("creates a screen once", async () => {
    const service = await open();

    expect(await service.createScreen(newScreen("helm"))).toMatchObject({ ok: true, value: { id: "helm", revision: 0 } });
    expect(await service.createScreen(newScreen("helm"))).toMatchObject({ ok: false, status: 409 });
    expect(await service.createScreen({ ...newScreen("bad"), schemaVersion: 7 })).toMatchObject({
      ok: false,
      status: 422,
    });
  });

  it("lints with the show's states", async () => {
    const service = await open();
    const bridge = service.loaded()?.screens.get("bridge");
    if (!bridge) throw new Error("missing bridge");

    expect(service.lint(bridge)).toEqual([]);
  });
});

describe("drafts and publishing", () => {
  const titleOf = (screen: Screen | null | undefined) => {
    const title = screen?.root.type === "container" ? screen.root.children.find((child) => child.node.id === "title") : undefined;
    return title?.node.type === "widget" ? title.node.props["text"] : undefined;
  };
  const rename = (text: string) => [{ op: "update", id: "title", props: { text } }];

  it("keeps edits in the draft until they are published", async () => {
    const service = await open();
    const events = record(service);

    await service.applyOps("bridge", 0, rename("HELM"));

    expect(events).toEqual([{ type: "screen", screenId: "bridge" }]);
    expect(titleOf(service.loaded()?.screens.get("bridge"))).toBe("HELM");
    expect(titleOf(service.screenForDisplay("test").screen)).toBe("Bridge operations");
    expect(service.loaded()?.screens.get("bridge")).toMatchObject({ revision: 1, published: 0 });
  });

  it("publishes the draft to the displays showing it", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, rename("HELM"));
    const events = record(service);

    expect(await service.publish("bridge", 1)).toMatchObject({ ok: true, value: { revision: 1, published: 1 } });

    expect(events).toEqual([
      { type: "published", screenId: "bridge" },
      { type: "screen", screenId: "bridge" },
    ]);
    expect(titleOf(service.screenForDisplay("test").screen)).toBe("HELM");
    expect((await readShowFile("published/bridge.json")).published).toBe(1);
    expect((await readShowFile("screens/bridge.json")).published).toBe(1);
    expect((await open()).screenForDisplay("test").screen?.revision).toBe(1);
  });

  it("refuses to publish a revision nobody has seen", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, rename("HELM"));

    expect(await service.publish("bridge", 0)).toMatchObject({ ok: false, status: 409, revision: 1 });
    expect(await service.publish("nope")).toMatchObject({ ok: false, status: 404 });
  });

  it("publishes every edit straight away in live edit", async () => {
    const service = await open();
    expect(await service.updateSettings({ liveEdit: true })).toEqual({
      ok: true,
      value: { liveEdit: true, displayGlobalActions: true, sounds: false, aiPublish: false, aiLiveControl: false },
    });
    const events = record(service);

    await service.applyOps("bridge", 0, rename("LIVE"));

    expect(events).toEqual([
      { type: "published", screenId: "bridge" },
      { type: "screen", screenId: "bridge" },
    ]);
    expect(titleOf(service.screenForDisplay("test").screen)).toBe("LIVE");
    expect((await readShowFile("show.json")).settings).toMatchObject({ liveEdit: true });
  });

  it("re-skins the show in another theme and variant", async () => {
    const service = await open();
    const events = record(service);

    expect(await service.setTheme({ id: "crt", variant: "amber" })).toEqual({ ok: true, value: { id: "crt", variant: "amber" } });
    expect(events).toEqual([{ type: "show" }]);
    expect((await readShowFile("show.json")).theme).toEqual({ id: "crt", variant: "amber" });
    expect(await service.setTheme({ id: "lcars" })).toEqual({ ok: true, value: { id: "lcars" } });
  });

  it("refuses an unknown theme or variant", async () => {
    const service = await open();
    expect(await service.setTheme({ id: "holodeck" })).toMatchObject({ ok: false, status: 422, message: expect.stringContaining("try base, lcars, hud, crt") });
    expect(await service.setTheme({ id: "crt", variant: "nemesis" })).toMatchObject({ ok: false, status: 422, message: expect.stringContaining("try amber, ice") });
  });

  it("creates screens as unpublished drafts", async () => {
    const service = await open();
    await service.createScreen({ ...newScreen("helm"), published: 0 });
    await service.updateDisplay("test", { screen: "helm" });

    expect(service.loaded()?.screens.get("helm")?.published).toBeUndefined();
    expect(service.screenForDisplay("test").screen).toBeNull();
    // Publishing it would put it on that display.
    expect(service.displaysShowing("helm")).toEqual(["test"]);
  });

  it("lists the displays a published screen is on", async () => {
    const service = await open();
    expect(service.displaysShowing("bridge")).toEqual(["test"]);
    expect(service.displaysShowing("engineering")).toEqual(["engineering-1"]);
  });
});

describe("revisions", () => {
  const rename = (text: string) => [{ op: "update", id: "title", props: { text } }];

  it("reads earlier revisions", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, rename("ONE"));
    await service.applyOps("bridge", 1, rename("TWO"));

    expect(await service.revisions("bridge")).toMatchObject({
      ok: true,
      value: [{ revision: 2 }, { revision: 1 }, { revision: 0 }],
    });
    expect(await service.revision("bridge", 1)).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(await service.revision("bridge", 2)).toMatchObject({ ok: true, value: { revision: 2 } });
    expect(await service.revision("bridge", 9)).toMatchObject({ ok: false, status: 404 });
    expect(await service.revisions("nope")).toMatchObject({ ok: false, status: 404 });
  });

  it("reverts by making the old content a new revision", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, [...rename("ONE"), { op: "meta", name: "Renamed" }]);
    await service.applyOps("bridge", 1, rename("TWO"));

    const result = await service.revert("bridge", 2, 0);

    expect(result).toMatchObject({ ok: true, value: { revision: 3, name: "Bridge operations" } });
    const original = await service.revision("bridge", 0);
    expect(result.ok && original.ok && result.value.root).toEqual(original.ok && original.value.root);
  });

  it("refuses a revert from a stale revision or to a missing one", async () => {
    const service = await open();
    await service.applyOps("bridge", 0, rename("ONE"));

    expect(await service.revert("bridge", 0, 0)).toMatchObject({ ok: false, status: 409 });
    expect(await service.revert("bridge", 1, 7)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("screen library", () => {
  it("duplicates a screen as a new unpublished draft", async () => {
    const service = await open();
    const events = record(service);

    const result = await service.duplicateScreen("bridge");

    expect(result).toMatchObject({ ok: true, value: { id: "bridge-operations-copy", name: "Bridge operations copy", revision: 0 } });
    expect(result.ok && result.value.published).toBeUndefined();
    expect(events).toEqual([{ type: "screen", screenId: "bridge-operations-copy" }]);
    expect(await service.duplicateScreen("bridge", { id: "helm", name: "Helm" })).toMatchObject({ ok: true, value: { id: "helm" } });
    expect(await service.duplicateScreen("bridge", { id: "helm" })).toMatchObject({ ok: false, status: 409 });
  });

  it("deletes a screen that is not on air", async () => {
    const service = await open();
    service.setPreview("test", "schematic");
    const events = record(service);

    expect(await service.deleteScreen("schematic")).toEqual({ ok: true, value: "schematic" });

    expect(service.loaded()?.screens.has("schematic")).toBe(false);
    expect(service.previews().size).toBe(0);
    expect(events).toEqual([
      { type: "preview", displayId: "test" },
      { type: "deleted", screenId: "schematic" },
    ]);
    expect(await open().then((reopened) => reopened.loaded()?.screens.has("schematic"))).toBe(false);
  });

  it("refuses to delete the default screen or an assigned one", async () => {
    const service = await open();
    expect(await service.deleteScreen("bridge")).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/default/) });
    expect(await service.deleteScreen("engineering")).toMatchObject({ ok: false, status: 409, message: expect.stringMatching(/engineering-1/) });
    expect(await service.deleteScreen("nope")).toMatchObject({ ok: false, status: 404 });
  });
});

describe("displays", () => {
  it("assigns and clears a screen, persisting it in show.json", async () => {
    const service = await open();
    const events = record(service);

    expect(await service.updateDisplay("bridge-2", { name: "Bridge 2", screen: "tactical" })).toEqual({
      ok: true,
      value: { id: "bridge-2", name: "Bridge 2", screen: "tactical" },
    });
    expect(events).toEqual([{ type: "display", displayId: "bridge-2" }]);

    expect(await service.updateDisplay("bridge-2", { screen: null })).toEqual({
      ok: true,
      value: { id: "bridge-2", name: "Bridge 2" },
    });
    const show = await readShowFile("show.json");
    expect(show.displays).toContainEqual({ id: "bridge-2", name: "Bridge 2" });
  });

  it("refuses to assign a screen that does not exist", async () => {
    const service = await open();
    expect(await service.updateDisplay("bridge-2", { screen: "nope" })).toMatchObject({ ok: false, status: 404 });
  });

  it("identifies a display by its name, or its id when it has none", async () => {
    const service = await open();
    const events = record(service);

    expect(service.identify("test")).toEqual({ ok: true, value: "Test display" });
    expect(service.identify("d-abc123")).toEqual({ ok: true, value: "d-abc123" });
    expect(events).toEqual([
      { type: "identify", displayId: "test", label: "Test display" },
      { type: "identify", displayId: "d-abc123", label: "d-abc123" },
    ]);
  });

  it("previews a draft on one display without publishing it", async () => {
    const service = await open();
    await service.applyOps("tactical", 0, [{ op: "update", id: "title", props: { text: "DRAFT" } }]);
    const events = record(service);

    expect(service.setPreview("test", "tactical")).toEqual({ ok: true, value: "tactical" });
    expect(service.screenForDisplay("test")).toMatchObject({ preview: true, screen: { id: "tactical", revision: 1 } });
    expect(service.screenForDisplay("tactical-1")).toMatchObject({ preview: false, screen: { revision: 0 } });

    expect(service.setPreview("test", null)).toEqual({ ok: true, value: null });
    expect(service.screenForDisplay("test")).toMatchObject({ preview: false, screen: { id: "bridge" } });
    expect(events).toEqual([
      { type: "preview", displayId: "test" },
      { type: "preview", displayId: "test" },
    ]);
    expect(service.setPreview("test", "nope")).toMatchObject({ ok: false, status: 404 });
  });

  it("asks a display to reload", async () => {
    const service = await open();
    const events = record(service);
    expect(service.reload("test")).toEqual({ ok: true, value: "test" });
    expect(events).toEqual([{ type: "reload", displayId: "test" }]);
  });

  it("forgets a display", async () => {
    const service = await open();
    service.markSeen("tactical-1");

    expect(await service.forgetDisplay("tactical-1")).toEqual({ ok: true, value: "tactical-1" });

    expect(service.loaded()?.show.displays.map((display) => display.id)).not.toContain("tactical-1");
    expect((await readShowFile("runtime.json")).seen).toEqual({});
  });

  it("remembers when displays were seen once flushed", async () => {
    const service = await open();
    service.markSeen("bridge-9");
    await service.flush();

    expect(Object.keys((await readShowFile("runtime.json")).seen)).toEqual(["bridge-9"]);
  });
});

describe("without an active show", () => {
  it("fails every command with 503", async () => {
    const service = createShowService({ dataDir, decor: decorCatalog, log, loaded: null });

    expect(await service.setState("normal")).toMatchObject({ ok: false, status: 503 });
    expect(await service.applyOps("bridge", 0, [])).toMatchObject({ ok: false, status: 503 });
    expect(await service.createScreen(newScreen("x"))).toMatchObject({ ok: false, status: 503 });
    expect(await service.updateDisplay("a", {})).toMatchObject({ ok: false, status: 503 });
    expect(service.identify("a")).toMatchObject({ ok: false, status: 503 });
    expect(await service.publish("a")).toMatchObject({ ok: false, status: 503 });
    expect(await service.revert("a", 0, 0)).toMatchObject({ ok: false, status: 503 });
    expect(await service.deleteScreen("a")).toMatchObject({ ok: false, status: 503 });
    expect(await service.duplicateScreen("a")).toMatchObject({ ok: false, status: 503 });
    expect(await service.assets()).toMatchObject({ ok: false, status: 503 });
    expect(service.setPreview("a", null)).toMatchObject({ ok: false, status: 503 });
    expect(service.screenForDisplay("a")).toEqual({ screen: null, preview: false });
  });
});

describe("signals", () => {
  it("reports the demo's shared values", async () => {
    const values = (await open()).signalValues(0);
    expect(values).toMatchObject({ shields: 0, hull: 100, "warp.factor": 6.2 });
    expect(values["warp.output"]).toEqual(expect.any(Number));
    expect(values).not.toHaveProperty("eps.load");
  });

  it("sets a manual signal within its range, broadcasts it and keeps it across a restart", async () => {
    const service = await open();
    const events = record(service);

    expect(service.setSignal("shields", { value: 130 })).toEqual({ ok: true, value: 100 });
    expect(service.setSignal("shields", { delta: -12 })).toEqual({ ok: true, value: 90 });
    expect(events).toEqual([
      { type: "signals", values: { shields: 100 } },
      { type: "signals", values: { shields: 90 } },
    ]);

    await service.flush();
    expect((await readShowFile("runtime.json")).signals).toEqual({ shields: 90 });
    expect((await open()).signalValues(0)["shields"]).toBe(90);
  });

  it("refuses to set unknown signals and signals that are not shared manual ones", async () => {
    const service = await open();
    expect(service.setSignal("nope", { value: 1 })).toMatchObject({ ok: false, status: 404 });
    expect(service.setSignal("eps.load", { value: 1 })).toMatchObject({ ok: false, status: 409 });
    expect(service.setSignal("warp.output", { value: 1 })).toMatchObject({ ok: false, status: 409 });
  });

  it("ticks shared walk signals and broadcasts only changes", async () => {
    const service = await open();
    const events = record(service);

    service.tickSignals(5000);
    service.tickSignals(5000);

    expect(events).toEqual([{ type: "signals", values: { "warp.output": expect.any(Number) } }]);
  });

  it("redefines the show's signals and drops values that no longer apply", async () => {
    const service = await open();
    service.setSignal("shields", { value: 50 });
    const events = record(service);

    const result = await service.defineSignals([
      { id: "shields", label: "Shields", scope: "ambient", source: { kind: "wave", min: 0, max: 100 } },
    ]);

    expect(result).toMatchObject({ ok: true, value: [{ id: "shields", scope: "ambient" }] });
    expect(events).toEqual([{ type: "show" }]);
    expect(service.signalValues(0)).toEqual({});
    expect((await readShowFile("show.json")).signals).toHaveLength(1);
    expect((await readShowFile("runtime.json")).signals).toEqual({});
  });

  it("rejects invalid signal definitions", async () => {
    const service = await open();
    const duplicate = { id: "a", label: "A", source: { kind: "static", value: 1 } };
    expect(await service.defineSignals([duplicate, duplicate])).toMatchObject({ ok: false, status: 422 });
    expect(await service.defineSignals([{ id: "Bad Id", label: "x", source: { kind: "static", value: 1 } }])).toMatchObject({
      ok: false,
      status: 422,
    });
  });
});

describe("controls on displays", () => {
  it("navigates a display to another screen and back", async () => {
    const service = await open();
    const events = record(service);

    expect(await service.press("test", { nodeId: "nav-engineering" })).toEqual(["navigate"]);
    expect(service.screenForDisplay("test").screen?.id).toBe("engineering");
    expect(service.navigated("test")).toBe("engineering");
    expect(service.displaysShowing("engineering").sort()).toEqual(["engineering-1", "test"]);

    expect(await service.press("test", { nodeId: "tool-damage" })).toEqual(["navigate"]);
    expect(service.screenForDisplay("test").screen?.id).toBe("schematic");

    expect(await service.press("test", { nodeId: "sections" })).toEqual(["back"]);
    expect(service.screenForDisplay("test").screen?.id).toBe("engineering");
    expect(events.filter((event) => event.type === "display")).toHaveLength(3);
  });

  it("does nothing for a back with nowhere to go, or a press on another screen's control", async () => {
    const service = await open();
    expect(await service.press("engineering-1", { nodeId: "nav-engineering" })).toEqual([]);
    expect(await service.press("engineering-1", { nodeId: "tool-damage" })).toEqual(["navigate"]);
    expect(await service.press("engineering-1", { nodeId: "sections" })).toEqual(["back"]);
    expect(await service.press("engineering-1", { nodeId: "sections" })).toEqual([]);
  });

  it("sends a display home when it is reassigned or its navigated screen is deleted", async () => {
    const service = await open();
    await service.press("test", { nodeId: "nav-engineering" });
    await service.press("test", { nodeId: "tool-damage" });

    expect(await service.deleteScreen("schematic")).toMatchObject({ ok: true });
    expect(service.navigated("test")).toBe("engineering");

    await service.updateDisplay("test", { screen: "tactical" });
    expect(service.navigated("test")).toBeNull();
    expect(service.screenForDisplay("test").screen?.id).toBe("tactical");
  });

  it("changes the show state and shared signals from a display", async () => {
    const service = await open();

    expect(await service.press("test", { nodeId: "act-alert" })).toEqual(["setState", "setSignal"]);
    expect(service.state()).toBe("yellow-alert");
    expect(service.signalValues(0)["shields"]).toBe(100);

    // Hidden in yellow alert, so a stale press does nothing; stand down is shown instead.
    expect(await service.press("test", { nodeId: "act-alert" })).toEqual([]);
    expect(await service.press("test", { nodeId: "act-stand-down" })).toEqual(["setState", "setSignal"]);
    expect(service.state()).toBe("normal");
  });

  it("runs the rest of a press when the runtime file cannot be saved", async () => {
    const service = await open();
    // A directory where runtime.json should be makes every save fail, even for root.
    const runtime = path.join(dataDir, "shows/demo/runtime.json");
    await rm(runtime, { force: true });
    await mkdir(path.join(runtime, "blocked"), { recursive: true });
    log.warn.mockClear();

    expect(await service.press("test", { nodeId: "act-alert" })).toEqual(["setState", "setSignal"]);
    expect(service.state()).toBe("yellow-alert");
    expect(service.signalValues(0)["shields"]).toBe(100);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.anything() }), "Could not save runtime state");
  });

  it("moves only shared values while a control is still being used", async () => {
    const service = await open();
    expect(await service.press("test", { nodeId: "act-alert", moving: true })).toEqual(["setSignal"]);
    expect(service.state()).toBe("normal");
    expect(await service.press("test", { nodeId: "nav-engineering", moving: true })).toEqual([]);
    expect(service.navigated("test")).toBeNull();
  });

  it("applies relative signal changes from actions", async () => {
    const service = await open();
    expect(await service.press("engineering-1", { nodeId: "sys-eject" })).toEqual(["setState", "setSignal"]);
    expect(service.state()).toBe("damaged");
    expect(service.signalValues(0)["hull"]).toBe(61);
  });

  it("uses the control's own value when the action names none", async () => {
    const service = await open();
    await service.createScreen({
      ...newScreen("helm"),
      root: {
        id: "root",
        type: "container",
        layout: { kind: "stack", direction: "column" },
        children: [
          {
            node: {
              id: "throttle",
              type: "widget",
              kind: "slider",
              props: { label: "Warp", min: 0, max: 9.9, step: 0.1 },
              bind: { value: { signal: "warp.factor" } },
              actions: [{ do: "setSignal", signal: "warp.factor" }],
            },
          },
        ],
      },
    });
    await service.publish("helm");
    await service.updateDisplay("test", { screen: "helm" });

    expect(await service.press("test", { nodeId: "throttle", value: 8.47 })).toEqual(["setSignal"]);
    expect(service.signalValues(0)["warp.factor"]).toBe(8.5);
    expect(await service.press("test", { nodeId: "throttle" })).toEqual([]);
  });

  it("keeps show-wide changes away from displays when the show locks them", async () => {
    const service = await open();
    await service.updateSettings({ displayGlobalActions: false });

    expect(await service.press("test", { nodeId: "act-alert" })).toEqual([]);
    expect(service.state()).toBe("normal");
    expect(await service.press("test", { nodeId: "nav-engineering" })).toEqual(["navigate"]);
  });

  it("does not navigate a display that previews a draft", async () => {
    const service = await open();
    service.setPreview("test", "bridge");

    expect(await service.press("test", { nodeId: "nav-engineering" })).toEqual([]);
    expect(service.screenForDisplay("test")).toMatchObject({ preview: true, screen: { id: "bridge" } });
  });

  it("plays and pauses a video on the screen a display shows", async () => {
    const service = await open();
    const events = record(service);

    expect(service.video("viewscreen-1", "feed", "pause")).toEqual({ ok: true, value: "feed" });
    expect(events).toEqual([{ type: "video", displayId: "viewscreen-1", target: "feed", command: "pause" }]);
    expect(service.video("test", "feed", "play")).toMatchObject({ ok: false, status: 404 });
  });
});
