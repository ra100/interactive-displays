import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_DIR } from "../paths.ts";
import { ScreenSchema } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import {
  deleteAsset,
  ensureSeeded,
  HISTORY_LIMIT,
  listAssets,
  listRevisions,
  loadActiveShow,
  readRevision,
  saveAsset,
  savePublished,
  saveRuntime,
  saveScreen,
  trashScreen,
} from "./repository.ts";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let dataDir: string;

const readData = async (relative: string) => JSON.parse(await readFile(path.join(dataDir, relative), "utf8"));

const write = async (relative: string, value: unknown) => {
  const file = path.join(dataDir, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
};

const screen = (id: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  id,
  name: id,
  root: { id: "root", type: "container", layout: { kind: "stack", direction: "column" }, children: [] },
  ...extra,
});

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "displays-repo-"));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe("ensureSeeded", () => {
  it("copies the demo show into an empty data directory", async () => {
    expect(await ensureSeeded(dataDir, SEED_DIR, log)).toBe(true);

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.show.id).toBe("demo");
    expect(loaded?.show.theme.id).toBe("lcars");
    expect([...(loaded?.screens.keys() ?? [])]).toEqual([
      "bridge",
      "engineering",
      "operations",
      "schematic",
      "sensors",
      "standby",
      "tactical",
      "viewscreen",
    ]);
    expect([...(loaded?.published.keys() ?? [])]).toEqual([...(loaded?.screens.keys() ?? [])]);
    expect(await listAssets(dataDir, "demo")).toMatchObject([
      { name: "schematic.svg", kind: "image" },
      { name: "viewscreen.webm", kind: "video" },
    ]);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("leaves an existing data directory alone", async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "mine" });

    expect(await ensureSeeded(dataDir, SEED_DIR, log)).toBe(false);
    expect(JSON.parse(await readFile(path.join(dataDir, "settings.json"), "utf8")).activeShow).toBe("mine");
  });
});

describe("loadActiveShow", () => {
  beforeEach(async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "s1" });
    await write("shows/s1/show.json", { schemaVersion: 1, id: "s1", name: "Show", theme: { id: "base" } });
  });

  it("loads the active show and its valid screens", async () => {
    await write("shows/s1/screens/a.json", screen("a"));
    await write("shows/s1/screens/b.json", screen("b"));

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect([...(loaded?.screens.keys() ?? [])]).toEqual(["a", "b"]);
  });

  it("skips broken screens and keeps the rest", async () => {
    await write("shows/s1/screens/good.json", screen("good"));
    await write("shows/s1/screens/bad-json.json", "{ nope");
    await write("shows/s1/screens/invalid.json", { ...screen("invalid"), schemaVersion: 9 });
    await write("shows/s1/screens/renamed.json", screen("other-id"));

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect([...(loaded?.screens.keys() ?? [])]).toEqual(["good"]);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });

  it("returns a show without screens when the screens folder is missing", async () => {
    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.screens.size).toBe(0);
  });

  it("returns null when the active show does not exist", async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "missing" });
    expect(await loadActiveShow(dataDir, decorCatalog, log)).toBeNull();
    expect(log.error).toHaveBeenCalled();
  });

  it("returns null when show.json does not match its folder", async () => {
    await write("shows/s1/show.json", { schemaVersion: 1, id: "s2", name: "Show", theme: { id: "base" } });
    expect(await loadActiveShow(dataDir, decorCatalog, log)).toBeNull();
  });

  it("returns null for invalid settings", async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "../etc" });
    expect(await loadActiveShow(dataDir, decorCatalog, log)).toBeNull();
  });
});

describe("runtime state", () => {
  beforeEach(async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "s1" });
    await write("shows/s1/show.json", { schemaVersion: 1, id: "s1", name: "Show", theme: { id: "base" } });
  });

  it("starts empty when there is no runtime file", async () => {
    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.runtime).toEqual({ schemaVersion: 1, seen: {}, signals: {} });
  });

  it("round-trips the saved state, seen displays and manual signal values", async () => {
    const runtime = {
      schemaVersion: 1 as const,
      state: "red-alert",
      seen: { "bridge-1": "2026-10-14T12:00:00.000Z" },
      signals: { shields: 40 },
    };
    await saveRuntime(dataDir, "s1", runtime);

    expect((await loadActiveShow(dataDir, decorCatalog, log))?.runtime).toEqual(runtime);
  });

  it("reads a runtime file from before signals existed", async () => {
    await write("shows/s1/runtime.json", { schemaVersion: 1, state: "normal", seen: {} });

    expect((await loadActiveShow(dataDir, decorCatalog, log))?.runtime.signals).toEqual({});
  });

  it("ignores an unreadable runtime file instead of failing the show", async () => {
    await write("shows/s1/runtime.json", "{ nope");

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.runtime.seen).toEqual({});
    expect(log.warn).toHaveBeenCalled();
  });
});

describe("saveScreen", () => {
  const revision = (n: number) => ScreenSchema.parse({ ...screen("a"), revision: n });

  it("archives the replaced revision", async () => {
    await saveScreen(dataDir, "s1", revision(0));
    await saveScreen(dataDir, "s1", revision(1), revision(0));

    // Revision 1 was saved when revision 0 was archived; when revision 0 was saved is not known.
    expect(await listRevisions(dataDir, "s1", "a", 1)).toEqual([
      { revision: 1, savedAt: expect.any(String) },
      { revision: 0, savedAt: null },
    ]);
    const current = JSON.parse(await readFile(path.join(dataDir, "shows/s1/screens/a.json"), "utf8"));
    expect(current.revision).toBe(1);
  });

  it(`keeps only the last ${HISTORY_LIMIT} revisions`, async () => {
    for (let n = 1; n <= HISTORY_LIMIT + 3; n += 1) {
      await saveScreen(dataDir, "s1", revision(n), revision(n - 1));
    }

    const revisions = (await listRevisions(dataDir, "s1", "a", HISTORY_LIMIT + 3)).map((entry) => entry.revision);
    expect(revisions).toHaveLength(HISTORY_LIMIT + 1);
    expect(revisions[0]).toBe(HISTORY_LIMIT + 3);
    expect(revisions.at(-1)).toBe(3);
  });

  it("lists only the current revision of a screen that was never edited", async () => {
    expect(await listRevisions(dataDir, "s1", "nothing", 0)).toEqual([{ revision: 0, savedAt: null }]);
  });
});

describe("published screens", () => {
  beforeEach(async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "s1" });
    await write("shows/s1/show.json", { schemaVersion: 1, id: "s1", name: "Show", theme: { id: "base" } });
  });

  it("loads the published copy beside the draft", async () => {
    await write("shows/s1/screens/a.json", screen("a", { name: "Draft", revision: 3, published: 2 }));
    await write("shows/s1/published/a.json", screen("a", { name: "On air", revision: 2, published: 2 }));

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.screens.get("a")?.name).toBe("Draft");
    expect(loaded?.published.get("a")?.name).toBe("On air");
  });

  it("does not put a screen that was never published on air", async () => {
    await write("shows/s1/screens/a.json", screen("a"));

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.published.size).toBe(0);
  });

  it("keeps v1 screens on air: they are upgraded and published as they were", async () => {
    await write("shows/s1/screens/a.json", { ...screen("a", { revision: 4 }), schemaVersion: 1 });

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.screens.get("a")).toMatchObject({ schemaVersion: 2, revision: 4, published: 4 });
    expect(loaded?.published.get("a")?.revision).toBe(4);
    expect((await readData("shows/s1/published/a.json")).revision).toBe(4);
  });

  it("rebuilds a missing published copy from the history", async () => {
    await write("shows/s1/screens/a.json", screen("a", { name: "Draft", revision: 3, published: 1 }));
    await write("shows/s1/screens/.history/a/1.json", screen("a", { name: "Revision 1", revision: 1 }));

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.published.get("a")).toMatchObject({ name: "Revision 1", revision: 1, published: 1 });
  });

  it("takes a screen off air when its published revision is gone", async () => {
    await write("shows/s1/screens/a.json", screen("a", { revision: 3, published: 1 }));

    const loaded = await loadActiveShow(dataDir, decorCatalog, log);
    expect(loaded?.published.has("a")).toBe(false);
    expect(loaded?.screens.get("a")?.published).toBeUndefined();
    expect(log.warn).toHaveBeenCalled();
  });

  it("saves published copies", async () => {
    await savePublished(dataDir, "s1", ScreenSchema.parse(screen("a", { revision: 2, published: 2 })));
    expect((await readData("shows/s1/published/a.json")).published).toBe(2);
  });
});

describe("history and trash", () => {
  it("reads an archived revision", async () => {
    await saveScreen(dataDir, "s1", ScreenSchema.parse(screen("a", { revision: 1 })), ScreenSchema.parse(screen("a")));

    expect((await readRevision(dataDir, "s1", "a", 0, decorCatalog, log))?.revision).toBe(0);
    expect(await readRevision(dataDir, "s1", "a", 9, decorCatalog, log)).toBeUndefined();
  });

  it("moves a deleted screen to the trash and takes it off air", async () => {
    await write("shows/s1/screens/a.json", screen("a"));
    await write("shows/s1/published/a.json", screen("a"));

    await trashScreen(dataDir, "s1", "a");

    expect(await readdir(path.join(dataDir, "shows/s1/screens"))).toEqual([".trash"]);
    expect(await readdir(path.join(dataDir, "shows/s1/screens/.trash"))).toEqual([expect.stringMatching(/^a-.*\.json$/)]);
    expect(await readdir(path.join(dataDir, "shows/s1/published"))).toEqual([]);
  });
});

describe("assets", () => {
  it("saves, lists and deletes assets", async () => {
    await saveAsset(dataDir, "s1", "warp.png", Buffer.from([1, 2, 3]));
    await saveAsset(dataDir, "s1", "intro.mp4", Buffer.from([4]));

    expect(await listAssets(dataDir, "s1")).toEqual([
      { name: "intro.mp4", kind: "video", type: "video/mp4", size: 1, modified: expect.any(String) },
      { name: "warp.png", kind: "image", type: "image/png", size: 3, modified: expect.any(String) },
    ]);
    expect(await deleteAsset(dataDir, "s1", "warp.png")).toBe(true);
    expect(await deleteAsset(dataDir, "s1", "warp.png")).toBe(false);
    expect((await listAssets(dataDir, "s1")).map((asset) => asset.name)).toEqual(["intro.mp4"]);
  });

  it("ignores files the server would not accept as assets", async () => {
    await write("shows/s1/assets/notes.txt", "hello");
    await write("shows/s1/assets/Upper.PNG", "x");
    expect(await listAssets(dataDir, "s1")).toEqual([]);
  });

  it("lists nothing when the show has no assets folder", async () => {
    expect(await listAssets(dataDir, "nothing")).toEqual([]);
  });
});
