import { applyOps, catalog, findNode, type Op, type Screen, ScreenSchema } from "@interactive-displays/core";
import { decorCatalog, getThemeManifest } from "@interactive-displays/themes/manifest";
import { describe, expect, it } from "vitest";
import {
  clampRect,
  dragRect,
  duplicateOps,
  insertOps,
  insertTarget,
  layoutOps,
  moveOps,
  newContainer,
  newDecor,
  newWidget,
  nodeLabel,
  removeOps,
  setHiddenIn,
  setOverride,
  shiftOps,
  snap,
  withRect,
} from "./editing.ts";

const text = (id: string, value = id) => ({ node: { id, type: "widget", kind: "text", props: { text: value } } });

const screen: Screen = ScreenSchema.parse({
  schemaVersion: 2,
  id: "s",
  name: "S",
  root: {
    id: "root",
    type: "container",
    layout: { kind: "frame", archetype: "sidebar" },
    children: [
      { slot: "title", node: { id: "title", type: "widget", kind: "title", props: { text: "BRIDGE" } } },
      { slot: "nav", node: { id: "helm", type: "widget", kind: "button", props: { label: "HELM" } } },
      { slot: "nav", node: { id: "ops", type: "widget", kind: "button", props: { label: "OPS" } } },
      {
        slot: "main",
        node: {
          id: "body",
          type: "container",
          layout: { kind: "stack", direction: "column" },
          children: [text("a"), text("b"), text("c")],
        },
      },
      {
        slot: "main",
        node: {
          id: "art",
          type: "container",
          layout: { kind: "canvas" },
          children: [{ rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, ...text("free") }],
        },
      },
    ],
  },
});

// Applies ops the way the server would; the result must validate.
const run = (ops: Op[] | undefined, on: Screen = screen): Screen => {
  if (!ops) throw new Error("no ops");
  const result = applyOps(on, ops, { catalog, decor: decorCatalog });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.screen;
};

const childIds = (on: Screen, id: string) => {
  const node = findNode(on.root, id)?.node;
  return node?.type === "container" ? node.children.map((child) => child.node.id) : [];
};

const entryOf = (on: Screen, id: string) => findNode(on.root, id)?.entry;

describe("nodeLabel", () => {
  it("describes widgets by their text, containers by their layout", () => {
    expect(nodeLabel(findNode(screen.root, "helm")?.node ?? screen.root)).toBe("Button · HELM");
    expect(nodeLabel(screen.root)).toBe("Frame · sidebar");
    expect(nodeLabel(findNode(screen.root, "body")?.node ?? screen.root)).toBe("Stack · column");
    expect(nodeLabel({ id: "x", type: "widget", kind: "text", props: { text: "x".repeat(40) } })).toMatch(/…$/);
  });
});

describe("insertTarget", () => {
  it("appends to the main slot of a selected frame, or of the root when nothing is selected", () => {
    expect(insertTarget(screen, null)).toEqual({ parentId: "root", index: 5, slot: "main" });
    expect(insertTarget(screen, { kind: "node", id: "root" })).toEqual({ parentId: "root", index: 5, slot: "main" });
  });

  it("appends into a selected slot, after its last child", () => {
    expect(insertTarget(screen, { kind: "slot", frameId: "root", slot: "nav" })).toEqual({ parentId: "root", index: 3, slot: "nav" });
    expect(insertTarget(screen, { kind: "slot", frameId: "root", slot: "status" })).toEqual({ parentId: "root", index: 5, slot: "status" });
  });

  it("appends into a selected container, and goes after a selected widget", () => {
    expect(insertTarget(screen, { kind: "node", id: "body" })).toEqual({ parentId: "body", index: 3 });
    expect(insertTarget(screen, { kind: "node", id: "a" })).toEqual({ parentId: "body", index: 1 });
    expect(insertTarget(screen, { kind: "node", id: "helm" })).toEqual({ parentId: "root", index: 2, slot: "nav" });
  });
});

describe("insertOps", () => {
  it("inserts a widget with its example props and a fresh id", () => {
    const button = newWidget("button", new Set(["button"]));
    expect(button).toMatchObject({ id: "button-2", props: { label: "ENGAGE" } });

    const after = run(insertOps(screen, button, { parentId: "body", index: 1 }));
    expect(childIds(after, "body")).toEqual(["a", "button-2", "b", "c"]);
  });

  it("gives frame children a slot and canvas children a rect", () => {
    const inFrame = run(insertOps(screen, newWidget("text", new Set()), { parentId: "root", index: 5, slot: "status" }));
    expect(entryOf(inFrame, "text")?.slot).toBe("status");

    const onCanvas = run(insertOps(screen, newWidget("text", new Set()), { parentId: "art", index: 1 }));
    expect(entryOf(onCanvas, "text")?.rect).toEqual({ x: 0.15, y: 0.15, w: 0.3, h: 0.2 });
  });

  it("creates containers and theme decor", () => {
    const grid = newContainer("grid", new Set());
    expect(grid).toMatchObject({ id: "grid", layout: { kind: "grid", columns: ["1fr", "1fr"] }, children: [] });
    const elbow = getThemeManifest("lcars").decor.find((definition) => definition.kind === "lcars.elbow");
    expect(elbow && newDecor(elbow, new Set())).toMatchObject({ id: "elbow", type: "decor", kind: "lcars.elbow" });
    expect(() => run(insertOps(screen, grid, { parentId: "body", index: 0 }))).not.toThrow();
  });
});

describe("moveOps", () => {
  it("reorders within a parent, counting the gap the node leaves", () => {
    expect(childIds(run(moveOps(screen, "a", { parentId: "body", index: 3 })), "body")).toEqual(["b", "c", "a"]);
    expect(childIds(run(moveOps(screen, "c", { parentId: "body", index: 0 })), "body")).toEqual(["c", "a", "b"]);
    expect(moveOps(screen, "a", { parentId: "body", index: 1 })).toEqual([]);
  });

  it("moves between slots of a frame", () => {
    const after = run(moveOps(screen, "ops", { parentId: "root", index: 5, slot: "status" }));
    expect(entryOf(after, "ops")?.slot).toBe("status");
  });

  it("takes a slot when moving into a frame and drops it when leaving", () => {
    const out = run(moveOps(screen, "helm", { parentId: "body", index: 0 }));
    expect(entryOf(out, "helm")?.slot).toBeUndefined();

    const back = run(moveOps(out, "a", { parentId: "root", index: 0 }));
    expect(entryOf(back, "a")?.slot).toBe("main");
  });

  it("gives a rect on a canvas and removes it elsewhere", () => {
    const onto = run(moveOps(screen, "a", { parentId: "art", index: 1 }));
    expect(entryOf(onto, "a")?.rect).toBeDefined();
    const off = run(moveOps(screen, "free", { parentId: "body", index: 0 }));
    expect(entryOf(off, "free")?.rect).toBeUndefined();
  });

  it("refuses to move the root or a container into itself", () => {
    expect(moveOps(screen, "root", { parentId: "body", index: 0 })).toBeUndefined();
    expect(moveOps(screen, "body", { parentId: "body", index: 0 })).toBeUndefined();
  });
});

describe("shiftOps", () => {
  it("moves up and down among siblings, within the slot in a frame", () => {
    expect(childIds(run(shiftOps(screen, "b", -1)), "body")).toEqual(["b", "a", "c"]);
    expect(childIds(run(shiftOps(screen, "b", 1)), "body")).toEqual(["a", "c", "b"]);
    expect(shiftOps(screen, "a", -1)).toEqual([]);
    expect(childIds(run(shiftOps(screen, "ops", -1)), "root").slice(1, 3)).toEqual(["ops", "helm"]);
    expect(shiftOps(screen, "ops", 1)).toEqual([]);
  });
});

describe("removeOps and duplicateOps", () => {
  it("removes anything but the root", () => {
    expect(childIds(run(removeOps(screen, "b")), "body")).toEqual(["a", "c"]);
    expect(removeOps(screen, "root")).toEqual([]);
  });

  it("duplicates a subtree with fresh ids right after the original", () => {
    const copy = duplicateOps(screen, "body");
    const after = run(copy?.ops);
    expect(copy?.id).toBe("body-2");
    expect(childIds(after, "body-2")).toEqual(["a-2", "b-2", "c-2"]);
    expect(entryOf(after, "body-2")?.slot).toBe("main");
  });

  it("nudges a duplicate on a canvas", () => {
    const after = run(duplicateOps(screen, "free")?.ops);
    expect(entryOf(after, "free-2")?.rect).toEqual({ x: 0.12, y: 0.12, w: 0.2, h: 0.2 });
  });
});

describe("layoutOps", () => {
  it("turns a stack into a frame and puts the children in main", () => {
    const after = run(layoutOps(screen, "body", { kind: "frame", archetype: "dashboard" }));
    expect(childIds(after, "body").map((id) => entryOf(after, id)?.slot)).toEqual(["main", "main", "main"]);
  });

  it("turns a canvas into a stack and drops the rects", () => {
    const after = run(layoutOps(screen, "art", { kind: "stack", direction: "row", gap: "small" }));
    expect(entryOf(after, "free")?.rect).toBeUndefined();
  });

  it("gives every child a rect when becoming a canvas", () => {
    const after = run(layoutOps(screen, "body", { kind: "canvas" }));
    expect(childIds(after, "body").every((id) => entryOf(after, id)?.rect)).toBe(true);
  });
});

describe("canvas geometry", () => {
  it("snaps to a 1% grid", () => {
    expect(snap(0.123)).toBe(0.12);
    expect(snap(0.126)).toBe(0.13);
  });

  it("keeps rects inside the canvas and at least 2% big", () => {
    expect(clampRect({ x: -0.1, y: 0.95, w: 0.004, h: 0.3 })).toEqual({ x: 0, y: 0.7, w: 0.02, h: 0.3 });
    expect(clampRect({ x: 0.9, y: 0, w: 0.5, h: 2 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 1 });
  });

  it("moves a box and resizes it from any corner, keeping the opposite corner still", () => {
    const from = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 };
    expect(dragRect(from, "move", 0.1, -0.05)).toEqual({ x: 0.3, y: 0.15, w: 0.4, h: 0.4 });
    expect(dragRect(from, "move", 0.9, 0)).toEqual({ x: 0.6, y: 0.2, w: 0.4, h: 0.4 });
    expect(dragRect(from, "se", 0.1, 0.1)).toEqual({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 });
    expect(dragRect(from, "nw", 0.1, 0.1)).toEqual({ x: 0.3, y: 0.3, w: 0.3, h: 0.3 });
    expect(dragRect(from, "ne", 0.1, -0.1)).toEqual({ x: 0.2, y: 0.1, w: 0.5, h: 0.5 });
    expect(dragRect(from, "sw", -0.1, 0.1)).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 });
    expect(dragRect(from, "nw", 0.9, 0.9)).toEqual({ x: 0.58, y: 0.58, w: 0.02, h: 0.02 });
    expect(dragRect(from, "se", 2, 2)).toEqual({ x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
  });

  it("previews a moved rect without changing the screen", () => {
    const moved = withRect(screen, "free", { x: 0.5, y: 0.5, w: 0.2, h: 0.2 });
    expect(entryOf(moved, "free")?.rect?.x).toBe(0.5);
    expect(entryOf(screen, "free")?.rect?.x).toBe(0.1);
  });
});

describe("per-state overrides", () => {
  it("adds, changes and removes a prop override", () => {
    const one = setOverride(undefined, "red-alert", "tone", "danger");
    expect(one).toEqual([{ state: "red-alert", props: { tone: "danger" } }]);
    const two = setOverride(one ?? undefined, "red-alert", "text", "ALERT");
    expect(two).toEqual([{ state: "red-alert", props: { tone: "danger", text: "ALERT" } }]);
    expect(setOverride(setOverride(two ?? undefined, "red-alert", "tone", undefined) ?? undefined, "red-alert", "text", undefined)).toBeNull();
  });

  it("hides and shows a node per state, keeping other states", () => {
    const hidden = setHiddenIn([{ state: "damaged", props: { text: "X" } }], "blackout", true);
    expect(hidden).toEqual([
      { state: "damaged", props: { text: "X" } },
      { state: "blackout", hidden: true },
    ]);
    expect(setHiddenIn(hidden ?? undefined, "blackout", false)).toEqual([{ state: "damaged", props: { text: "X" } }]);
  });
});
