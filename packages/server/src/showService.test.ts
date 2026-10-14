import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_DIR } from "./paths.ts";
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
  schemaVersion: 1,
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
    expect(await listRevisions(dataDir, "demo", "bridge")).toEqual([0]);
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
  });
});
