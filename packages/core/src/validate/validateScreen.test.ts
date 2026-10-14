import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineDecor } from "../catalog/defineDecor.ts";
import { catalog } from "../catalog/index.ts";
import type { ScreenInput } from "../schema/screen.ts";
import { validateScreen } from "./validateScreen.ts";

const screen = (children: unknown[]): ScreenInput =>
  ({
    schemaVersion: 1,
    id: "welcome",
    name: "Welcome",
    root: {
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children,
    },
  }) as ScreenInput;

const widget = (id: string, kind: string, props: Record<string, unknown> = {}) => ({
  node: { id, type: "widget", kind, props },
});

describe("validateScreen", () => {
  it("accepts a valid screen and fills screen and prop defaults", () => {
    const result = validateScreen(
      screen([widget("title", "title", { text: "HELLO" }), widget("go", "button", { label: "GO" })]),
      catalog,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tags).toEqual([]);
    expect(result.value.profile).toEqual({ aspect: "16:9", fit: "fluid" });
    expect(result.value.revision).toBe(0);

    const root = result.value.root;
    if (root.type !== "container") throw new Error("expected container");
    expect(root.children[0]?.node).toMatchObject({ props: { text: "HELLO", tone: "primary" } });
    expect(root.children[1]?.node).toMatchObject({ props: { label: "GO", tone: "accent" } });
  });

  it("reports schema errors with a dotted path", () => {
    const result = validateScreen({ ...screen([]), id: "Not Valid" }, catalog);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe("id");
  });

  it("reports duplicate node ids", () => {
    const result = validateScreen(
      screen([widget("a", "text", { text: "1" }), widget("a", "text", { text: "2" })]),
      catalog,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([{ path: "root.children.1.node.id", message: 'Duplicate node id "a"' }]);
  });

  it("reports unknown widget kinds", () => {
    const result = validateScreen(screen([widget("x", "warp-core")]), catalog);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      { path: "root.children.0.node.kind", message: 'Unknown widget kind "warp-core"' },
    ]);
  });

  it("reports invalid widget props under the node's props path", () => {
    const result = validateScreen(screen([widget("go", "button", { label: "" })]), catalog);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe("root.children.0.node.props.label");
  });

  it("collects every issue instead of stopping at the first", () => {
    const result = validateScreen(
      screen([widget("a", "nope"), widget("a", "button", {})]),
      catalog,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(3);
  });

  describe("layouts", () => {
    const withRoot = (root: unknown) => ({ schemaVersion: 1, id: "s", name: "S", root });

    it("accepts frame children in the archetype's slots", () => {
      const result = validateScreen(
        withRoot({
          id: "root",
          type: "container",
          layout: { kind: "frame", archetype: "sidebar" },
          children: [{ slot: "nav", ...widget("a", "button", { label: "A" }) }],
        }),
        catalog,
      );
      expect(result.ok).toBe(true);
    });

    it("rejects unknown archetypes, missing slots and slots the archetype lacks", () => {
      const result = validateScreen(
        withRoot({
          id: "root",
          type: "container",
          layout: { kind: "frame", archetype: "starburst" },
          children: [],
        }),
        catalog,
      );
      expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual(["root.layout.archetype"]);

      const slots = validateScreen(
        withRoot({
          id: "root",
          type: "container",
          layout: { kind: "frame", archetype: "sidebar" },
          children: [widget("a", "text", { text: "x" }), { slot: "toolbar", ...widget("b", "text", { text: "y" }) }],
        }),
        catalog,
      );
      expect(slots.ok ? [] : slots.issues.map((issue) => issue.path)).toEqual([
        "root.children.0.slot",
        "root.children.1.slot",
      ]);
    });

    it("rejects grid areas outside the grid", () => {
      const result = validateScreen(
        withRoot({
          id: "root",
          type: "container",
          layout: { kind: "grid", columns: ["1fr", "2fr"], rows: ["1fr"] },
          children: [
            { area: { col: 2, row: 1 }, ...widget("a", "text", { text: "ok" }) },
            { area: { col: 2, row: 1, colSpan: 2 }, ...widget("b", "text", { text: "too wide" }) },
          ],
        }),
        catalog,
      );
      expect(result.ok ? [] : result.issues.map((issue) => issue.path)).toEqual(["root.children.1.area"]);
    });

    it("rejects canvas rects that leave the canvas", () => {
      const result = validateScreen(
        withRoot({
          id: "root",
          type: "container",
          layout: { kind: "canvas" },
          children: [{ rect: { x: 0.8, y: 0, w: 0.5, h: 0.5 }, ...widget("a", "text", { text: "x" }) }],
        }),
        catalog,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("decor", () => {
    const bar = defineDecor({
      kind: "test.bar",
      label: "Bar",
      description: "A bar",
      props: z.strictObject({ length: z.number().default(1) }),
      example: {},
    });
    const decor = new Map([[bar.kind, bar]]);
    const decorNode = (kind: string, props: Record<string, unknown> = {}) => ({ node: { id: "d", type: "decor", kind, props } });

    it("fills defaults for known decor", () => {
      const result = validateScreen(screen([decorNode("test.bar")]), catalog, decor);
      expect(result.ok && result.value.root.type === "container" && result.value.root.children[0]?.node).toMatchObject({
        props: { length: 1 },
      });
    });

    it("rejects invalid props for known decor", () => {
      expect(validateScreen(screen([decorNode("test.bar", { length: "long" })]), catalog, decor).ok).toBe(false);
    });

    it("keeps decor of themes that are not installed", () => {
      expect(validateScreen(screen([decorNode("other.elbow", { anything: true })]), catalog, decor).ok).toBe(true);
    });
  });

  describe("per-state overrides", () => {
    it("validates override props merged with the node's props", () => {
      const ok = validateScreen(
        screen([{ node: { id: "a", type: "widget", kind: "button", props: { label: "A" }, when: [{ state: "red-alert", props: { tone: "danger" } }] } }]),
        catalog,
      );
      expect(ok.ok).toBe(true);

      const bad = validateScreen(
        screen([{ node: { id: "a", type: "widget", kind: "button", props: { label: "A" }, when: [{ state: "red-alert", props: { tone: "red" } }] } }]),
        catalog,
      );
      expect(bad.ok ? [] : bad.issues.map((issue) => issue.path)).toEqual(["root.children.0.node.when.0.props.tone"]);
    });
  });
});
