import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_DIR } from "../paths.ts";
import { ensureSeeded, loadActiveShow } from "./repository.ts";

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

    const loaded = await loadActiveShow(dataDir, log);
    expect(loaded?.show.id).toBe("demo");
    expect([...(loaded?.screens.keys() ?? [])]).toEqual(["welcome"]);
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

    const loaded = await loadActiveShow(dataDir, log);
    expect([...(loaded?.screens.keys() ?? [])]).toEqual(["a", "b"]);
  });

  it("skips broken screens and keeps the rest", async () => {
    await write("shows/s1/screens/good.json", screen("good"));
    await write("shows/s1/screens/bad-json.json", "{ nope");
    await write("shows/s1/screens/invalid.json", { ...screen("invalid"), schemaVersion: 9 });
    await write("shows/s1/screens/renamed.json", screen("other-id"));

    const loaded = await loadActiveShow(dataDir, log);
    expect([...(loaded?.screens.keys() ?? [])]).toEqual(["good"]);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });

  it("returns a show without screens when the screens folder is missing", async () => {
    const loaded = await loadActiveShow(dataDir, log);
    expect(loaded?.screens.size).toBe(0);
  });

  it("returns null when the active show does not exist", async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "missing" });
    expect(await loadActiveShow(dataDir, log)).toBeNull();
    expect(log.error).toHaveBeenCalled();
  });

  it("returns null when show.json does not match its folder", async () => {
    await write("shows/s1/show.json", { schemaVersion: 1, id: "s2", name: "Show", theme: { id: "base" } });
    expect(await loadActiveShow(dataDir, log)).toBeNull();
  });

  it("returns null for invalid settings", async () => {
    await write("settings.json", { schemaVersion: 1, activeShow: "../etc" });
    expect(await loadActiveShow(dataDir, log)).toBeNull();
  });
});
