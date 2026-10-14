import type { DecorCatalog } from "../catalog/defineDecor.ts";
import type { Catalog } from "../catalog/defineWidget.ts";
import type { ChildEntry, ContainerNode, Node } from "../schema/node.ts";
import type { Screen } from "../schema/screen.ts";
import { findNode } from "../tree/tree.ts";
import { type ValidationIssue, validateScreen } from "../validate/validateScreen.ts";
import type { Op } from "./ops.ts";

export interface ApplyOptions {
  catalog: Catalog;
  decor?: DecorCatalog;
  // Generator and AI must not touch locked nodes (or anything inside them); people may.
  respectLocks?: boolean;
}

export type ApplyResult =
  | { ok: true; screen: Screen; inverse: Op[] }
  | { ok: false; issues: ValidationIssue[] };

class OpError extends Error {}

const fail = (message: string): never => {
  throw new OpError(message);
};

const PLACEMENT_KEYS = ["slot", "weight", "area", "rect"] as const;

const locate = (root: Node, id: string) => findNode(root, id) ?? fail(`Node "${id}" does not exist`);

const containerOf = (root: Node, id: string): ContainerNode => {
  const { node } = locate(root, id);
  return node.type === "container" ? node : fail(`Node "${id}" is not a container`);
};

const assertUnlocked = (root: Node, id: string, options: ApplyOptions) => {
  if (!options.respectLocks) return;
  const location = locate(root, id);
  const chain = [...location.ancestors, id];
  for (const ancestorId of chain) {
    if (locate(root, ancestorId).node.locked) fail(`Node "${id}" is locked`);
  }
};

const clampIndex = (index: number | undefined, length: number) =>
  index === undefined ? length : Math.min(Math.max(index, 0), length);

const removeEntry = (root: Node, id: string): { parent: ContainerNode; index: number; entry: ChildEntry } => {
  const location = locate(root, id);
  if (!location.parent || location.index === undefined || !location.entry) fail("The root cannot be removed");
  const { parent, index, entry } = location as Required<typeof location>;
  parent.children.splice(index, 1);
  return { parent, index, entry };
};

// Applies one op to the (cloned, mutable) screen and returns the op that undoes it.
const applyOne = (screen: Screen, op: Op, options: ApplyOptions): Op => {
  const root = screen.root;

  switch (op.op) {
    case "insert": {
      assertUnlocked(root, op.parent, options);
      const parent = containerOf(root, op.parent);
      const index = clampIndex(op.index, parent.children.length);
      parent.children.splice(index, 0, structuredClone(op.child));
      return { op: "remove", id: op.child.node.id };
    }

    case "remove": {
      assertUnlocked(root, op.id, options);
      const { parent, index, entry } = removeEntry(root, op.id);
      return { op: "insert", parent: parent.id, index, child: entry };
    }

    case "move": {
      assertUnlocked(root, op.id, options);
      assertUnlocked(root, op.parent, options);
      const target = containerOf(root, op.parent);
      if (op.parent === op.id || locate(root, op.parent).ancestors.includes(op.id)) {
        fail(`Node "${op.id}" cannot move into itself`);
      }
      const { parent: from, index: fromIndex, entry } = removeEntry(root, op.id);
      const index = clampIndex(op.index, target.children.length);
      target.children.splice(index, 0, entry);
      return { op: "move", id: op.id, parent: from.id, index: fromIndex };
    }

    case "update": {
      assertUnlocked(root, op.id, options);
      const { node } = locate(root, op.id);
      if (node.type === "container") fail(`Node "${op.id}" has no props`);
      const props = (node as Exclude<Node, ContainerNode>).props;
      const previous: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(op.props)) {
        previous[key] = Object.hasOwn(props, key) ? props[key] : null;
        if (value === null) delete props[key];
        else props[key] = structuredClone(value);
      }
      return { op: "update", id: op.id, props: previous };
    }

    case "set": {
      // Locking and unlocking itself is always allowed for people; the generator never sends it.
      if (options.respectLocks) assertUnlocked(root, op.id, options);
      const { node } = locate(root, op.id);
      const inverse: Extract<Op, { op: "set" }> = { op: "set", id: op.id };
      for (const key of ["locked", "hidden", "when"] as const) {
        if (!(key in op) || op[key] === undefined) continue;
        inverse[key] = (node[key] ?? null) as never;
        const value = op[key];
        if (value === null) delete node[key];
        else (node as Record<string, unknown>)[key] = structuredClone(value);
      }
      return inverse;
    }

    case "place": {
      assertUnlocked(root, op.id, options);
      const location = locate(root, op.id);
      const entry = location.entry ?? fail("The root has no placement");
      const inverse: Extract<Op, { op: "place" }> = { op: "place", id: op.id };
      for (const key of PLACEMENT_KEYS) {
        if (!(key in op) || op[key] === undefined) continue;
        inverse[key] = (entry[key] ?? null) as never;
        const value = op[key];
        if (value === null) delete entry[key];
        else (entry as Record<string, unknown>)[key] = structuredClone(value);
      }
      return inverse;
    }

    case "layout": {
      assertUnlocked(root, op.id, options);
      const container = containerOf(root, op.id);
      const previous = container.layout;
      container.layout = structuredClone(op.layout);
      return { op: "layout", id: op.id, layout: previous };
    }

    case "replace": {
      assertUnlocked(root, op.id, options);
      const location = locate(root, op.id);
      const replacement = structuredClone(op.node);
      if (!location.entry) screen.root = replacement;
      else location.entry.node = replacement;
      return { op: "replace", id: replacement.id, node: location.node };
    }

    case "meta": {
      const inverse: Extract<Op, { op: "meta" }> = { op: "meta" };
      if (op.name !== undefined) {
        inverse.name = screen.name;
        screen.name = op.name;
      }
      if (op.section !== undefined) {
        inverse.section = screen.section ?? null;
        if (op.section === null) delete screen.section;
        else screen.section = op.section;
      }
      if (op.tags !== undefined) {
        inverse.tags = screen.tags;
        screen.tags = [...op.tags];
      }
      if (op.profile !== undefined) {
        inverse.profile = screen.profile;
        screen.profile = { ...op.profile };
      }
      return inverse;
    }
  }
};

// All or nothing: either every op applies and the result validates, or nothing changes.
// The revision goes up by one per successful batch; `inverse` undoes the whole batch.
export const applyOps = (screen: Screen, ops: readonly Op[], options: ApplyOptions): ApplyResult => {
  const draft = structuredClone(screen);
  const inverse: Op[] = [];

  for (const [index, op] of ops.entries()) {
    try {
      inverse.unshift(applyOne(draft, op, options));
    } catch (error) {
      if (error instanceof OpError) return { ok: false, issues: [{ path: `ops.${index}`, message: error.message }] };
      throw error;
    }
  }

  const validated = validateScreen({ ...draft, revision: screen.revision + 1 }, options.catalog, options.decor);
  if (!validated.ok) return validated;
  return { ok: true, screen: validated.value, inverse };
};
