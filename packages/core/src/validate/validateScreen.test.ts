import { describe, expect, it } from "vitest";
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
});
