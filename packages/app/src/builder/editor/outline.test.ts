import { ScreenSchema } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { outlineRows } from "./outline.ts";

const screen = ScreenSchema.parse({
  schemaVersion: 2,
  id: "s",
  name: "S",
  root: {
    id: "root",
    type: "container",
    layout: { kind: "frame", archetype: "dashboard" },
    children: [
      { slot: "title", node: { id: "title", type: "widget", kind: "title", props: { text: "X" } } },
      {
        slot: "main",
        node: {
          id: "body",
          type: "container",
          layout: { kind: "stack", direction: "column" },
          children: [{ node: { id: "a", type: "widget", kind: "text", props: { text: "a" } } }],
        },
      },
    ],
  },
});

const describeRow = (row: ReturnType<typeof outlineRows>[number]) => {
  if (row.kind === "node") return `${"  ".repeat(row.depth)}${row.node.id}`;
  if (row.kind === "slot") return `${"  ".repeat(row.depth)}[${row.slot} ${row.count}]`;
  return `${"  ".repeat(row.depth)}· ${row.target.parentId}/${row.target.slot ?? "-"}@${row.target.index}`;
};

describe("outlineRows", () => {
  it("lists every slot of a frame, with gaps before each child and at the end of each group", () => {
    expect(outlineRows(screen, new Set()).map(describeRow)).toEqual([
      "root",
      "  [title 1]",
      "    · root/title@0",
      "    title",
      "    · root/title@1",
      "  [main 1]",
      "    · root/main@1",
      "    body",
      "      · body/-@0",
      "      a",
      "      · body/-@1",
      "    · root/main@2",
      "  [aside 0]",
      "    · root/aside@2",
      "  [status 0]",
      "    · root/status@2",
    ]);
  });

  it("records the containers a gap is inside, so a node cannot drop into itself", () => {
    const gap = outlineRows(screen, new Set()).find((row) => row.kind === "gap" && row.target.parentId === "body");
    expect(gap).toMatchObject({ inside: ["root", "body"] });
  });

  it("hides the children of collapsed containers", () => {
    const ids = outlineRows(screen, new Set(["body"])).flatMap((row) => (row.kind === "node" ? [row.node.id] : []));
    expect(ids).toEqual(["root", "title", "body"]);
  });
});
