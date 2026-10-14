import { IdSchema } from "@interactive-displays/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDisplayId, getOrCreateDisplayId, rememberDisplayId } from "./displayId.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDisplayId", () => {
  it("creates a valid, short id", () => {
    const id = createDisplayId();
    expect(id).toMatch(/^d-[0-9a-f]{6}$/);
    expect(IdSchema.safeParse(id).success).toBe(true);
  });
});

describe("getOrCreateDisplayId", () => {
  it("creates an id once and then reuses it", () => {
    const first = getOrCreateDisplayId();
    expect(getOrCreateDisplayId()).toBe(first);
  });

  it("returns a remembered id", () => {
    rememberDisplayId("bridge-1");
    expect(getOrCreateDisplayId()).toBe("bridge-1");
  });

  it("replaces a stored id that is not valid", () => {
    localStorage.setItem("interactive-displays.displayId", "Not Valid");
    expect(getOrCreateDisplayId()).toMatch(/^d-[0-9a-f]{6}$/);
  });

  it("still returns an id when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(getOrCreateDisplayId()).toMatch(/^d-[0-9a-f]{6}$/);
  });
});
