import { describe, expect, it } from "vitest";
import { type Screen, ScreenSchema } from "../schema/screen.ts";
import { ShowSchema } from "../schema/show.ts";
import { lintScreen } from "./lintScreen.ts";

const screenWith = (root: unknown): Screen => ScreenSchema.parse({ schemaVersion: 1, id: "s", name: "S", root });

const button = (id: string, label: string) => ({ node: { id, type: "widget", kind: "button", props: { label } } });

const rules = (screen: Screen, context = {}) => lintScreen(screen, context).map((issue) => issue.rule);

describe("lintScreen", () => {
  it("is quiet for a reasonable screen", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [{ slot: "nav", ...button("a", "WARP CORE") }, { slot: "main", ...button("b", "ENGAGE") }],
    });
    expect(lintScreen(screen)).toEqual([]);
  });

  it("flags empty containers and frames without main", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [],
    });
    expect(rules(screen)).toEqual(["empty-container", "frame-without-main"]);
  });

  it("flags crowded stacks", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: Array.from({ length: 13 }, (_, index) => button(`b${index}`, `B${index}`)),
    });
    expect(rules(screen)).toContain("crowded-stack");
  });

  it("flags duplicate and long labels, with a tighter limit in nav", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "frame", archetype: "sidebar" },
      children: [
        { slot: "main", ...button("a", "ENGAGE") },
        { slot: "main", ...button("b", "engage") },
        { slot: "nav", ...button("c", "INERTIAL DAMPENERS X") },
      ],
    });
    const issues = lintScreen(screen);
    expect(issues.map((issue) => [issue.rule, issue.nodeId])).toEqual([
      ["duplicate-label", "b"],
      ["label-length", "c"],
    ]);
  });

  it("flags canvas children without a rect", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "canvas" },
      children: [button("a", "A"), { rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, ...button("b", "B") }],
    });
    expect(lintScreen(screen).map((issue) => issue.nodeId)).toEqual(["a"]);
  });

  it("flags overrides for states the show does not have", () => {
    const show = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: { id: "a", type: "widget", kind: "button", props: { label: "A" }, when: [{ state: "red-alert", hidden: true }] } }],
    });
    expect(rules(screen, { show })).toEqual(["unknown-state"]);
  });

  it("notes decor from another theme", () => {
    const screen = screenWith({
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "row" },
      children: [{ node: { id: "d", type: "decor", kind: "lcars.elbow" } }],
    });
    expect(rules(screen, { decor: new Map() })).toEqual(["foreign-decor"]);
  });
});
