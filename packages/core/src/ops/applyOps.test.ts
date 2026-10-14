import { describe, expect, it } from "vitest";
import { catalog } from "../catalog/index.ts";
import { type Screen, ScreenSchema } from "../schema/screen.ts";
import { findNode } from "../tree/tree.ts";
import { validateScreen } from "../validate/validateScreen.ts";
import { applyOps } from "./applyOps.ts";
import { type Op, OpSchema } from "./ops.ts";

const base = (): Screen => {
  const result = validateScreen(
    ScreenSchema.parse({
      schemaVersion: 1,
      id: "s",
      name: "Screen",
      revision: 3,
      root: {
        id: "root",
        type: "container",
        layout: { kind: "stack", direction: "column" },
        children: [
          { node: { id: "title", type: "widget", kind: "title", props: { text: "BRIDGE" } } },
          {
            weight: 2,
            node: {
              id: "row",
              type: "container",
              layout: { kind: "stack", direction: "row" },
              children: [
                { node: { id: "a", type: "widget", kind: "button", props: { label: "A" } } },
                { node: { id: "b", type: "widget", kind: "button", props: { label: "B" } } },
              ],
            },
          },
        ],
      },
    }),
    catalog,
  );
  if (!result.ok) throw new Error("fixture invalid");
  return result.value;
};

const ops = (...input: unknown[]): Op[] => input.map((op) => OpSchema.parse(op));

const apply = (screen: Screen, list: Op[], respectLocks = false) => {
  const result = applyOps(screen, list, { catalog, respectLocks });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
};

const childIds = (screen: Screen, id: string) => {
  const node = findNode(screen.root, id)?.node;
  return node?.type === "container" ? node.children.map((child) => child.node.id) : [];
};

// Applying ops and then their inverse must give back the original document (apart from the revision).
const expectRoundTrip = (list: Op[]) => {
  const original = base();
  const forward = apply(original, list);
  const back = apply(forward.screen, forward.inverse);
  expect({ ...back.screen, revision: original.revision }).toEqual(original);
};

describe("applyOps", () => {
  it("inserts a widget with prop defaults and bumps the revision", () => {
    const { screen } = apply(
      base(),
      ops({ op: "insert", parent: "row", index: 1, child: { node: { id: "c", type: "widget", kind: "button", props: { label: "C" } } } }),
    );

    expect(screen.revision).toBe(4);
    expect(childIds(screen, "row")).toEqual(["a", "c", "b"]);
    expect(findNode(screen.root, "c")?.node).toMatchObject({ props: { label: "C", tone: "accent" } });
  });

  it("does not change the input screen", () => {
    const original = base();
    apply(original, ops({ op: "remove", id: "a" }));
    expect(childIds(original, "row")).toEqual(["a", "b"]);
  });

  it("removes, moves, updates, places and re-lays out nodes", () => {
    const { screen } = apply(
      base(),
      ops(
        { op: "move", id: "b", parent: "root", index: 0 },
        { op: "update", id: "a", props: { label: "ALPHA", tone: "danger" } },
        { op: "place", id: "row", weight: 5 },
        { op: "layout", id: "row", layout: { kind: "stack", direction: "column", gap: "large" } },
        { op: "remove", id: "title" },
      ),
    );

    expect(childIds(screen, "root")).toEqual(["b", "row"]);
    expect(findNode(screen.root, "a")?.node).toMatchObject({ props: { label: "ALPHA", tone: "danger" } });
    expect(findNode(screen.root, "row")?.entry?.weight).toBe(5);
  });

  it("updates screen metadata", () => {
    const { screen } = apply(base(), ops({ op: "meta", name: "Helm", section: "helm", tags: ["nav"] }));
    expect(screen).toMatchObject({ name: "Helm", section: "helm", tags: ["nav"] });
  });

  it.each<[string, unknown[]]>([
    ["insert", [{ op: "insert", parent: "row", child: { node: { id: "c", type: "widget", kind: "text", props: { text: "x" } } } }]],
    ["remove", [{ op: "remove", id: "row" }]],
    ["move", [{ op: "move", id: "a", parent: "root" }]],
    ["update", [{ op: "update", id: "title", props: { code: "01-01", tone: "info" } }]],
    ["set", [{ op: "set", id: "a", hidden: true, locked: true, when: [{ state: "red-alert", props: { tone: "danger" } }] }]],
    ["place", [{ op: "place", id: "row", weight: null, slot: "main" }, { op: "place", id: "row", slot: null }]],
    ["layout", [{ op: "layout", id: "root", layout: { kind: "grid", columns: ["1fr"], rows: ["1fr", "1fr"] } }]],
    ["replace", [{ op: "replace", id: "row", node: { id: "z", type: "widget", kind: "text", props: { text: "z" } } }]],
    ["meta", [{ op: "meta", name: "Other", section: "ops", profile: { aspect: "4:3", fit: "contain" } }]],
    ["a mixed batch", [
      { op: "move", id: "a", parent: "root", index: 0 },
      { op: "update", id: "a", props: { label: "MOVED" } },
      { op: "remove", id: "b" },
    ]],
  ])("undoes %s with its inverse", (_name, list) => {
    expectRoundTrip(ops(...list));
  });

  it("rejects the whole batch when one op fails", () => {
    const result = applyOps(
      base(),
      ops({ op: "remove", id: "a" }, { op: "remove", id: "missing" }),
      { catalog },
    );

    expect(result).toEqual({ ok: false, issues: [{ path: "ops.1", message: 'Node "missing" does not exist' }] });
  });

  it("rejects a result that does not validate", () => {
    const result = applyOps(base(), ops({ op: "update", id: "a", props: { label: "" } }), { catalog });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe("root.children.1.node.children.0.node.props.label");
  });

  it("rejects duplicate ids from an insert", () => {
    const result = applyOps(
      base(),
      ops({ op: "insert", parent: "row", child: { node: { id: "a", type: "widget", kind: "text", props: { text: "dup" } } } }),
      { catalog },
    );
    expect(result.ok).toBe(false);
  });

  it("refuses to move a container into itself", () => {
    const result = applyOps(base(), ops({ op: "move", id: "row", parent: "row" }), { catalog });
    expect(result.ok).toBe(false);
  });

  it("refuses to remove the root", () => {
    const result = applyOps(base(), ops({ op: "remove", id: "root" }), { catalog });
    expect(result.ok).toBe(false);
  });

  describe("locks", () => {
    const locked = () => apply(base(), ops({ op: "set", id: "row", locked: true })).screen;

    it("protect a node and its children when locks are respected", () => {
      for (const op of [
        { op: "update", id: "a", props: { label: "X" } },
        { op: "remove", id: "row" },
        { op: "insert", parent: "row", child: { node: { id: "c", type: "widget", kind: "text", props: { text: "c" } } } },
      ]) {
        const result = applyOps(locked(), ops(op), { catalog, respectLocks: true });
        expect(result.ok).toBe(false);
      }
    });

    it("still let people edit locked nodes", () => {
      expect(applyOps(locked(), ops({ op: "update", id: "a", props: { label: "X" } }), { catalog }).ok).toBe(true);
    });

    it("leave unlocked siblings editable", () => {
      const result = applyOps(locked(), ops({ op: "update", id: "title", props: { text: "NEW" } }), {
        catalog,
        respectLocks: true,
      });
      expect(result.ok).toBe(true);
    });
  });
});
