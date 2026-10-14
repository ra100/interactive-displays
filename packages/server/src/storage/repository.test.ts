import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_DIR } from "../paths.ts";
import { ScreenSchema } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { ensureSeeded, HISTORY_LIMIT, listRevisions, loadActiveShow, saveRuntime, saveScreen } from "./repository.ts";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let dataDir: string;

const write = async (relative: string, value: unknown) => {
  const file = path.join(dataDir, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof value === "string" ? value : JSON.stringify(value));
};

const screen = (id: string) => ({
  schemaVersion: 1,
  id,
  name: id,
  root: { id: "root", type: "container", layout: { kind: "stack", direction: "column" }, children: [] },
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
    expect([...(loaded?.screens.keys() ?? [])]).toEqual(["bridge", "engineering", "standby", "tactical"]);
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
    expect(loaded?.runtime).toEqual({ schemaVersion: 1, seen: {} });
  });

  it("round-trips the saved state and seen displays", async () => {
    const runtime = { schemaVersion: 1 as const, state: "red-alert", seen: { "bridge-1": "2026-10-14T12:00:00.000Z" } };
    await saveRuntime(dataDir, "s1", runtime);

    expect((await loadActiveShow(dataDir, decorCatalog, log))?.runtime).toEqual(runtime);
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

    expect(await listRevisions(dataDir, "s1", "a")).toEqual([0]);
    const current = JSON.parse(await readFile(path.join(dataDir, "shows/s1/screens/a.json"), "utf8"));
    expect(current.revision).toBe(1);
  });

  it(`keeps only the last ${HISTORY_LIMIT} revisions`, async () => {
    for (let n = 1; n <= HISTORY_LIMIT + 3; n += 1) {
      await saveScreen(dataDir, "s1", revision(n), revision(n - 1));
    }

    const revisions = await listRevisions(dataDir, "s1", "a");
    expect(revisions).toHaveLength(HISTORY_LIMIT);
    expect(revisions[0]).toBe(HISTORY_LIMIT + 2);
    expect(revisions.at(-1)).toBe(3);
  });

  it("lists no revisions for a screen that was never edited", async () => {
    expect(await listRevisions(dataDir, "s1", "nothing")).toEqual([]);
  });
});
