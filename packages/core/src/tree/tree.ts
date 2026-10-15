import type { ChildEntry, ContainerNode, Node } from "../schema/node.ts";

export interface NodeLocation {
  node: Node;
  // Undefined for the root.
  parent?: ContainerNode;
  index?: number;
  entry?: ChildEntry;
  // Ids from the root down to the node's parent.
  ancestors: string[];
}

export const walkNodes = (root: Node, visit: (node: Node, ancestors: readonly string[]) => void): void => {
  const step = (node: Node, ancestors: string[]) => {
    visit(node, ancestors);
    if (node.type !== "container") return;
    const next = [...ancestors, node.id];
    for (const child of node.children) step(child.node, next);
  };
  step(root, []);
};

export const findNode = (root: Node, id: string): NodeLocation | undefined => {
  if (root.id === id) return { node: root, ancestors: [] };

  const search = (container: ContainerNode, ancestors: string[]): NodeLocation | undefined => {
    for (const [index, entry] of container.children.entries()) {
      if (entry.node.id === id) {
        return { node: entry.node, parent: container, index, entry, ancestors: [...ancestors, container.id] };
      }
      if (entry.node.type === "container") {
        const found = search(entry.node, [...ancestors, container.id]);
        if (found) return found;
      }
    }
    return undefined;
  };

  return root.type === "container" ? search(root, []) : undefined;
};

export const collectIds = (root: Node): Set<string> => {
  const ids = new Set<string>();
  walkNodes(root, (node) => ids.add(node.id));
  return ids;
};

export const countNodes = (root: Node): number => collectIds(root).size;

// Ids of the widgets of one kind, in tree order: the video widgets a control or the operator can play.
export const widgetIds = (root: Node, kind: string): string[] => {
  const ids: string[] = [];
  walkNodes(root, (node) => {
    if (node.type === "widget" && node.kind === kind) ids.push(node.id);
  });
  return ids;
};

// The locked parts of a tree, outermost first; whatever sits inside a locked node comes along with it.
export const lockedParts = (root: Node): Node[] => {
  const parts: Node[] = [];
  const visit = (node: Node) => {
    if (node.locked) {
      parts.push(node);
      return;
    }
    if (node.type === "container") for (const child of node.children) visit(child.node);
  };
  visit(root);
  return parts;
};

// Deep equality for JSON-like documents, ignoring key order and keys whose value is undefined.
export const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => sameValue(item, b[index]));
  const left = Object.entries(a).filter(([, value]) => value !== undefined);
  const right = new Map(Object.entries(b).filter(([, value]) => value !== undefined));
  return left.length === right.size && left.every(([key, value]) => right.has(key) && sameValue(value, right.get(key)));
};
