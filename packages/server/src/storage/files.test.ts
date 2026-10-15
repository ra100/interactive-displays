import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exists, readJson, writeJsonAtomic } from "./files.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "displays-files-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeJsonAtomic", () => {
  it("creates folders and writes readable JSON", async () => {
    const file = path.join(dir, "a/b/c.json");
    await writeJsonAtomic(file, { hello: "world" });

    expect(await readJson(file)).toEqual({ hello: "world" });
    expect(await readFile(file, "utf8")).toContain('\n  "hello"');
  });

  it("keeps the last of several quick writes and leaves no temp files", async () => {
    const file = path.join(dir, "x.json");
    await Promise.all(Array.from({ length: 20 }, (_, index) => writeJsonAtomic(file, { index })));

    expect(await readJson(file)).toEqual({ index: 19 });
    expect(await readdir(dir)).toEqual(["x.json"]);
  });

  it("rejects only to its caller when a write fails, and the next write still runs", async () => {
    const unhandled: unknown[] = [];
    const track = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", track);
    try {
      const file = path.join(dir, "blocked.json");
      await mkdir(path.join(file, "inside"), { recursive: true });
      await expect(writeJsonAtomic(file, { a: 1 })).rejects.toThrow();
      await rm(file, { recursive: true });
      await writeJsonAtomic(file, { a: 2 });
      expect(await readJson(file)).toEqual({ a: 2 });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", track);
    }
  });
});

describe("exists", () => {
  it("tells whether a path exists", async () => {
    expect(await exists(dir)).toBe(true);
    expect(await exists(path.join(dir, "missing"))).toBe(false);
  });
});
