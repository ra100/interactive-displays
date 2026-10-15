import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    expect((await listRevisions(dataDir, "demo", "bridge")).map((entry) => entry.revision)).toEqual([0]);
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
    expect(await service.updateSettings({ liveEdit: true })).toEqual({ ok: true, value: { liveEdit: true } });
    const events = record(service);

    await service.applyOps("bridge", 0, rename("LIVE"));

    expect(events).toEqual([
      { type: "published", screenId: "bridge" },
      { type: "screen", screenId: "bridge" },
    ]);
    expect(titleOf(service.screenForDisplay("test").screen)).toBe("LIVE");
    expect((await readShowFile("show.json")).settings).toEqual({ liveEdit: true });
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

    expect(await service.revisions("bridge")).toMatchObject({ ok: true, value: [{ revision: 1 }, { revision: 0 }] });
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
