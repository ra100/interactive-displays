import { describe, expect, it } from "vitest";
import { resolveScreenId, ShowSchema } from "./show.ts";

const show = ShowSchema.parse({
  schemaVersion: 1,
  id: "demo",
  name: "Demo",
  theme: { id: "base" },
  defaultScreen: "welcome",
  displays: [
    { id: "bridge-1", screen: "helm" },
    { id: "bridge-2", name: "Bridge 2" },
  ],
});

describe("ShowSchema", () => {
  it("defaults displays to an empty list", () => {
    const parsed = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
    expect(parsed.displays).toEqual([]);
  });

  it("rejects an unsupported schema version", () => {
    const result = ShowSchema.safeParse({ schemaVersion: 2, id: "s", name: "S", theme: { id: "base" } });
    expect(result.success).toBe(false);
  });
});

describe("resolveScreenId", () => {
  it("uses the display's own screen", () => {
    expect(resolveScreenId(show, "bridge-1")).toBe("helm");
  });

  it("falls back to the default screen for a known display without a screen", () => {
    expect(resolveScreenId(show, "bridge-2")).toBe("welcome");
  });

  it("falls back to the default screen for an unknown display", () => {
    expect(resolveScreenId(show, "d-new")).toBe("welcome");
  });

  it("returns undefined when nothing is assigned", () => {
    const bare = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
    expect(resolveScreenId(bare, "d-new")).toBeUndefined();
  });
});
