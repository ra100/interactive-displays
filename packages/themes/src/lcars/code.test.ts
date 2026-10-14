import { describe, expect, it } from "vitest";
import { lcarsCode } from "./code.ts";

describe("lcarsCode", () => {
  it("is stable for the same id and shaped like 00-0000", () => {
    expect(lcarsCode("warp-core")).toBe(lcarsCode("warp-core"));
    expect(lcarsCode("warp-core")).toMatch(/^\d{2}-\d{4}$/);
  });

  it("differs between ids", () => {
    expect(new Set(["a", "b", "c", "nav-1", "nav-2"].map(lcarsCode)).size).toBe(5);
  });
});
