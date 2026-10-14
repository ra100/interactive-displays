import { describe, expect, it } from "vitest";
import { NodeSchema } from "./node.ts";

describe("NodeSchema", () => {
  it("parses a nested container tree and applies layout defaults", () => {
    const node = NodeSchema.parse({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: [
        { node: { id: "title", type: "widget", kind: "title", props: { text: "HELLO" } } },
        {
          weight: 2,
          node: {
            id: "row",
            type: "container",
            layout: { kind: "stack", direction: "row", gap: "small" },
            children: [{ node: { id: "go", type: "widget", kind: "button" } }],
          },
        },
      ],
    });

    expect(node.type).toBe("container");
    if (node.type !== "container") return;
    expect(node.layout).toEqual({ kind: "stack", direction: "column", gap: "medium" });

    const row = node.children[1]?.node;
    expect(row?.type).toBe("container");
    if (row?.type !== "container") return;
    expect(row.children[0]?.node).toEqual({ id: "go", type: "widget", kind: "button", props: {} });
  });

  it("rejects an unknown node type", () => {
    expect(NodeSchema.safeParse({ id: "x", type: "sprite" }).success).toBe(false);
  });

  it("rejects an invalid id deep in the tree", () => {
    const result = NodeSchema.safeParse({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: { id: "Bad Id", type: "widget", kind: "text" } }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["children", 0, "node", "id"]);
  });

  it("rejects a non-positive child weight", () => {
    const result = NodeSchema.safeParse({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ weight: 0, node: { id: "a", type: "widget", kind: "text" } }],
    });

    expect(result.success).toBe(false);
  });
});
