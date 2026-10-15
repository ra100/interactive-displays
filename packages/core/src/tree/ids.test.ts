import { describe, expect, it } from "vitest";
import type { Node } from "../schema/node.ts";
import { cloneWithFreshIds, slugify, takenIds, uniqueId } from "./ids.ts";

const panel: Node = {
  id: "panel",
  type: "container",
  layout: { kind: "stack", direction: "column", gap: "medium" },
  children: [
    { node: { id: "label", type: "widget", kind: "text", props: { text: "A" } } },
    { node: { id: "go", type: "widget", kind: "button", props: { label: "GO" } } },
  ],
};

describe("slugify", () => {
  it.each([
    ["Warp Core!", "warp-core"],
    ["  ÉPS  tap 2 ", "eps-tap-2"],
    ["---", ""],
  ])("%s → %s", (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });

  it("keeps ids short", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(48);
  });
});

describe("uniqueId", () => {
  it("returns the stem when it is free", () => {
    expect(uniqueId("Helm", new Set(["nav"]))).toBe("helm");
  });

  it("numbers the stem when it is taken", () => {
    expect(uniqueId("helm", new Set(["helm", "helm-2"]))).toBe("helm-3");
  });

  it("falls back to a generic stem", () => {
    expect(uniqueId("!!!", new Set())).toBe("node");
  });
});

describe("cloneWithFreshIds", () => {
  it("renames every node so the copy can sit next to the original", () => {
    const taken = takenIds(panel);
    const copy = cloneWithFreshIds(panel, taken);
    expect(copy.id).toBe("panel-2");
    expect(copy.type === "container" && copy.children.map((child) => child.node.id)).toEqual(["label-2", "go-2"]);
    expect(taken.has("go-2")).toBe(true);
  });

  it("numbers copies of copies from the original stem", () => {
    const taken = new Set(["go", "go-2"]);
    const copy = cloneWithFreshIds({ id: "go-2", type: "widget", kind: "button", props: {} }, taken);
    expect(copy.id).toBe("go-3");
  });

  it("does not change the original", () => {
    const before = structuredClone(panel);
    cloneWithFreshIds(panel, takenIds(panel));
    expect(panel).toEqual(before);
  });
});
