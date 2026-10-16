import { describe, expect, it } from "vitest";
import { type Node, NodeSchema } from "../schema/node.ts";
import { collectIds, findNode, walkNodes, widgetIds } from "./tree.ts";

const root: Node = NodeSchema.parse({
  id: "root",
  type: "container",
  layout: { kind: "stack", direction: "column" },
  children: [
    { node: { id: "a", type: "widget", kind: "text" } },
    {
      node: {
        id: "row",
        type: "container",
        layout: { kind: "stack", direction: "row" },
        children: [{ node: { id: "b", type: "widget", kind: "button" } }],
      },
    },
  ],
});

describe("tree helpers", () => {
  it("finds the root", () => {
    expect(findNode(root, "root")).toEqual({ node: root, ancestors: [] });
  });

  it("finds a nested node with its parent, index and ancestors", () => {
    const found = findNode(root, "b");
    expect(found?.parent?.id).toBe("row");
    expect(found?.index).toBe(0);
    expect(found?.ancestors).toEqual(["root", "row"]);
  });

  it("returns undefined for an unknown id", () => {
    expect(findNode(root, "nope")).toBeUndefined();
  });

  it("walks depth first", () => {
    const order: string[] = [];
    walkNodes(root, (node) => order.push(node.id));
    expect(order).toEqual(["root", "a", "row", "b"]);
  });

  it("collects all ids", () => {
    expect([...collectIds(root)]).toEqual(["root", "a", "row", "b"]);
  });

  it("lists the widgets of one kind", () => {
    expect(widgetIds(root, "button")).toEqual(["b"]);
    expect(widgetIds(root, "video")).toEqual([]);
  });
});
