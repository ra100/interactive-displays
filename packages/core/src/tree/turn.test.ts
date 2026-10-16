import { describe, expect, it } from "vitest";
import { type ContainerNode, type Node, NodeSchema, type NodeInput } from "../schema/node.ts";
import { frameOrientation, orientationOf, orientationOfBox, slotDirection, turnTree } from "./turn.ts";

const node = (input: NodeInput): Node => NodeSchema.parse(input);

const gauge = (id: string): NodeInput => ({ id, type: "widget", kind: "gauge", props: {} });
const button = (id: string): NodeInput => ({ id, type: "widget", kind: "button", props: { label: id } });

const container = (tree: Node, id: string): ContainerNode => {
  const found = (current: Node): ContainerNode | undefined => {
    if (current.type !== "container") return undefined;
    if (current.id === id) return current;
    for (const child of current.children) {
      const inner = found(child.node);
      if (inner) return inner;
    }
    return undefined;
  };
  const result = found(tree);
  if (!result) throw new Error(`No container ${id}`);
  return result;
};

const direction = (tree: Node, id: string) => {
  const { layout } = container(tree, id);
  return layout.kind === "stack" ? layout.direction : layout.kind;
};

describe("orientation", () => {
  it("is portrait only for tall screens and boxes", () => {
    expect(orientationOf("9:16")).toBe("portrait");
    expect(orientationOf("16:9")).toBe("landscape");
    expect(orientationOf("4:3")).toBe("landscape");
    expect(orientationOfBox(2160, 3840)).toBe("portrait");
    expect(orientationOfBox(3840, 2160)).toBe("landscape");
  });

  it("turns the nav column and the side panel into bands in portrait", () => {
    expect(slotDirection("nav", "landscape")).toBe("column");
    expect(slotDirection("nav", "portrait")).toBe("row");
    expect(slotDirection("aside", "portrait")).toBe("row");
    expect(slotDirection("main", "portrait")).toBe("column");
    expect(slotDirection("toolbar", "portrait")).toBe("row");
  });
});

describe("turnTree", () => {
  const rowOfPanels = node({
    id: "root",
    type: "container",
    layout: { kind: "stack", direction: "row", gap: "medium" },
    children: [
      { weight: 2, node: { id: "left", type: "container", layout: { kind: "stack", direction: "column" }, children: [{ node: gauge("a") }] } },
      {
        node: {
          id: "right",
          type: "container",
          layout: { kind: "stack", direction: "column" },
          children: [
            { node: { id: "readings", type: "container", layout: { kind: "stack", direction: "row" }, children: [{ node: gauge("b") }, { node: gauge("c") }] } },
          ],
        },
      },
    ],
  });

  it("gives back the same tree when the display has the screen's shape", () => {
    expect(turnTree(rowOfPanels, "landscape", "landscape")).toBe(rowOfPanels);
    expect(turnTree(rowOfPanels, "portrait", "portrait")).toBe(rowOfPanels);
  });

  it("stacks a row of panels into a column on a portrait display, keeping their shares", () => {
    const turned = turnTree(rowOfPanels, "landscape", "portrait");
    expect(direction(turned, "root")).toBe("column");
    expect(turned.type === "container" && turned.children[0]?.weight).toBe(2);
  });

  it("leaves rows below a rearranged part alone: they got their width back", () => {
    expect(direction(turnTree(rowOfPanels, "landscape", "portrait"), "readings")).toBe("row");
  });

  it("rearranges the outermost row it meets, however deep", () => {
    const wrapped = node({
      id: "outer",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: [{ node: { id: "title", type: "widget", kind: "title", props: { text: "Helm" } } }, { node: rowOfPanels }],
    });
    const turned = turnTree(wrapped, "landscape", "portrait");
    expect(direction(turned, "outer")).toBe("column");
    expect(direction(turned, "root")).toBe("column");
    expect(direction(turned, "readings")).toBe("row");
  });

  it("keeps a row of buttons a row", () => {
    const toolbar = node({
      id: "tools",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: button("one") }, { node: button("two") }],
    });
    expect(direction(turnTree(toolbar, "landscape", "portrait"), "tools")).toBe("row");
  });

  it("does not count hidden parts and decor as panels", () => {
    const lonely = node({
      id: "pair",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: gauge("shown") }, { node: { ...gauge("gone"), hidden: true } }, { node: { id: "bar", type: "decor", kind: "lcars.bar", props: {} } }],
    });
    expect(direction(turnTree(lonely, "landscape", "portrait"), "pair")).toBe("row");
  });

  it("turns a column of panels into a row on a landscape display for a portrait screen", () => {
    const column = node({
      id: "col",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: [{ node: gauge("a") }, { node: gauge("b") }],
    });
    expect(direction(turnTree(column, "portrait", "landscape"), "col")).toBe("row");
  });

  it("turns a grid on its side, cells and spans with it", () => {
    const grid = node({
      id: "grid",
      type: "container",
      layout: { kind: "grid", columns: ["2fr", "1fr"], rows: ["1fr", "1fr"] },
      children: [
        { area: { col: 1, row: 1, rowSpan: 2 }, node: gauge("big") },
        { area: { col: 2, row: 1 }, node: gauge("top") },
        { area: { col: 2, row: 2 }, node: gauge("bottom") },
      ],
    });
    const turned = container(turnTree(grid, "landscape", "portrait"), "grid");
    expect(turned.layout).toMatchObject({ kind: "grid", columns: ["1fr", "1fr"], rows: ["2fr", "1fr"] });
    expect(turned.children.map((child) => child.area)).toEqual([
      { col: 1, row: 1, colSpan: 2 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ]);
  });

  it("leaves a single-column grid standing on a portrait display", () => {
    const tall = node({
      id: "tall",
      type: "container",
      layout: { kind: "grid", columns: ["1fr"], rows: ["1fr", "1fr", "1fr"] },
      children: [{ node: gauge("a") }, { node: gauge("b") }, { node: gauge("c") }],
    });
    expect(container(turnTree(tall, "landscape", "portrait"), "tall").layout).toEqual(container(tall, "tall").layout);
  });

  describe("frames", () => {
    const frame = node({
      id: "frame",
      type: "container",
      layout: { kind: "frame", archetype: "dashboard" },
      children: [
        { slot: "title", node: { id: "title", type: "widget", kind: "title", props: { text: "Engineering" } } },
        {
          slot: "main",
          node: {
            id: "main-grid",
            type: "container",
            layout: { kind: "grid", columns: ["1fr", "1fr", "1fr"], rows: ["1fr"] },
            children: [{ node: gauge("a") }, { node: gauge("b") }, { node: gauge("c") }],
          },
        },
        { slot: "aside", node: { id: "side", type: "container", layout: { kind: "stack", direction: "column" }, children: [{ node: gauge("d") }, { node: gauge("e") }] } },
        { slot: "nav", node: button("n1") },
        { slot: "nav", node: button("n2") },
      ],
    });
    const turned = turnTree(frame, "landscape", "portrait");

    it("rearranges what is in the main area as if it were the screen", () => {
      expect(container(turned, "main-grid").layout).toMatchObject({ columns: ["1fr"], rows: ["1fr", "1fr", "1fr"] });
    });

    it("lays a lone panel in a side band out along the band", () => {
      expect(direction(turned, "side")).toBe("row");
    });

    it("keeps a panel's heading on top when it lays the panel along a band", () => {
      const panel = node({
        id: "frame",
        type: "container",
        layout: { kind: "frame", archetype: "dashboard" },
        children: [
          {
            slot: "aside",
            node: {
              id: "shields",
              type: "container",
              layout: { kind: "stack", direction: "column" },
              children: [{ node: { id: "heading", type: "widget", kind: "title", props: { text: "Shields" } } }, { node: gauge("d") }, { weight: 2, node: gauge("e") }],
            },
          },
        ],
      });
      const shields = container(turnTree(panel, "landscape", "portrait"), "shields");
      expect(shields.layout).toMatchObject({ direction: "column" });
      expect(shields.children.map((child) => child.node.id)).toEqual(["heading", "shields"]);
      const row = shields.children[1];
      expect(row?.weight).toBe(3);
      expect(row?.node.type === "container" && row.node.layout).toMatchObject({ kind: "stack", direction: "row" });
      expect(row?.node.type === "container" && row.node.children.map((child) => child.node.id)).toEqual(["d", "e"]);
    });

    it("leaves parts in a band that already lines them up", () => {
      const two = node({
        id: "frame",
        type: "container",
        layout: { kind: "frame", archetype: "dashboard" },
        children: [
          { slot: "aside", node: { id: "one", type: "container", layout: { kind: "stack", direction: "column" }, children: [{ node: gauge("d") }, { node: gauge("e") }] } },
          { slot: "aside", node: gauge("f") },
        ],
      });
      expect(direction(turnTree(two, "landscape", "portrait"), "one")).toBe("column");
    });

    it("can be kept as designed, chrome and all", () => {
      const kept = node({ ...frame, turned: { arrange: "keep" } });
      expect(frameOrientation(kept, "landscape", "portrait")).toBe("landscape");
      expect(frameOrientation(frame, "landscape", "portrait")).toBe("portrait");
      expect(frameOrientation(kept, "portrait", "portrait")).toBe("portrait");
      // The main area still lost width, so its grid still turns.
      expect(container(turnTree(kept, "landscape", "portrait"), "main-grid").layout).toMatchObject({ columns: ["1fr"] });
    });
  });

  describe("per part", () => {
    it("keeps a part as designed", () => {
      const kept = node({ ...rowOfPanels, turned: { arrange: "keep" } });
      const turned = turnTree(kept, "landscape", "portrait");
      expect(direction(turned, "root")).toBe("row");
      // Its parts are still narrower, so they are still rearranged.
      expect(direction(turned, "readings")).toBe("column");
    });

    it("sets a direction outright", () => {
      const toolbar = node({
        id: "tools",
        type: "container",
        turned: { arrange: "column" },
        layout: { kind: "stack", direction: "row" },
        children: [{ node: button("one") }, { node: button("two") }],
      });
      expect(direction(turnTree(toolbar, "landscape", "portrait"), "tools")).toBe("column");
    });

    it("lines a grid up in reading order", () => {
      const grid = node({
        id: "grid",
        type: "container",
        turned: { arrange: "column" },
        layout: { kind: "grid", columns: ["1fr", "1fr"], rows: ["1fr", "1fr"], gap: "small" },
        children: [
          { area: { col: 2, row: 2 }, node: gauge("d") },
          { area: { col: 1, row: 1 }, node: gauge("a") },
          { node: gauge("flow") },
          { area: { col: 2, row: 1 }, node: gauge("b") },
        ],
      });
      const turned = container(turnTree(grid, "landscape", "portrait"), "grid");
      expect(turned.layout).toEqual({ kind: "stack", direction: "column", gap: "small" });
      expect(turned.children.map((child) => child.node.id)).toEqual(["a", "b", "d", "flow"]);
      expect(turned.children.every((child) => child.area === undefined)).toBe(true);
    });

    it("hides a part only when the display is turned", () => {
      const ornament = node({ ...gauge("dial"), turned: { hidden: true } });
      expect(turnTree(ornament, "landscape", "portrait").hidden).toBe(true);
      expect(turnTree(ornament, "landscape", "landscape").hidden).toBeUndefined();
    });
  });

  it("does not change the tree it is given", () => {
    const before = structuredClone(rowOfPanels);
    turnTree(rowOfPanels, "landscape", "portrait");
    expect(rowOfPanels).toEqual(before);
  });
});
