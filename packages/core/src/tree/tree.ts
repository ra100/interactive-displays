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
