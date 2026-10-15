import { describe, expect, it } from "vitest";
import { findState, resolveScreenId, ShowSchema } from "./show.ts";

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

  it("defaults to drafts that wait for Publish, display controls on, sounds off and AI kept off the air", () => {
    const parsed = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
    expect(parsed.settings).toEqual({ liveEdit: false, displayGlobalActions: true, sounds: false, aiPublish: false, aiLiveControl: false });
    expect(parsed.signals).toEqual([]);
  });

  it("fills in new settings for a show saved before they existed", () => {
    const parsed = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" }, settings: { liveEdit: true } });
    expect(parsed.settings).toEqual({ liveEdit: true, displayGlobalActions: true, sounds: false, aiPublish: false, aiLiveControl: false });
  });

  it("takes signals and rejects duplicate signal ids", () => {
    const signal = { id: "warp.output", label: "Warp output", source: { kind: "walk", min: 90, max: 99 } };
    const parsed = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" }, signals: [signal] });
    expect(parsed.signals[0]).toEqual({ ...signal, scope: "ambient", source: { kind: "walk", min: 90, max: 99, volatility: 0.3 } });
    const twice = ShowSchema.safeParse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" }, signals: [signal, signal] });
    expect(twice.success).toBe(false);
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

describe("show states", () => {
  const minimal = { schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } };

  it("defaults to a single normal state", () => {
    expect(ShowSchema.parse(minimal).states).toEqual([{ id: "normal", label: "Normal", effect: "none" }]);
  });

  it("parses states with effects and banners", () => {
    const show = ShowSchema.parse({
      ...minimal,
      states: [
        { id: "normal", label: "Normal" },
        { id: "red-alert", label: "Red alert", effect: "alert", banner: "RED ALERT" },
      ],
    });
    expect(findState(show, "red-alert")).toEqual({ id: "red-alert", label: "Red alert", effect: "alert", banner: "RED ALERT" });
    expect(findState(show, "nope")).toBeUndefined();
  });

  it("rejects duplicate state and display ids", () => {
    expect(ShowSchema.safeParse({ ...minimal, states: [{ id: "a", label: "A" }, { id: "a", label: "B" }] }).success).toBe(false);
    expect(ShowSchema.safeParse({ ...minimal, displays: [{ id: "x" }, { id: "x" }] }).success).toBe(false);
  });

  it("rejects an unknown effect", () => {
    expect(ShowSchema.safeParse({ ...minimal, states: [{ id: "a", label: "A", effect: "sparkles" }] }).success).toBe(false);
  });
});
