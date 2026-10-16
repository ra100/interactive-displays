import { archetypeSlots, type ContainerNode, type Node, type Screen, type SlotName } from "@interactive-displays/core";
import { indexAfterSlot, type Target } from "./editing.ts";

// The outline is the screen tree flattened into rows: nodes, the slots of each frame, and the gaps between
// them where a dragged node can land. Gaps record which containers they sit in, so a container cannot be
// dropped into itself.
export type OutlineRow =
  | { kind: "node"; key: string; depth: number; node: Node; parentId: string | undefined; collapsed: boolean }
  | { kind: "slot"; key: string; depth: number; frameId: string; slot: SlotName; count: number }
  | { kind: "gap"; key: string; depth: number; target: Target; inside: string[]; end: boolean };

const gap = (target: Target, depth: number, inside: string[], end: boolean): OutlineRow => ({
  kind: "gap",
  key: `gap:${target.parentId}:${target.slot ?? ""}:${target.index}`,
  depth,
  target,
  inside,
  end,
});

export const outlineRows = (screen: Screen, collapsed: ReadonlySet<string>): OutlineRow[] => {
  const rows: OutlineRow[] = [];

  const children = (container: ContainerNode, depth: number, inside: string[]) => {
    const chain = [...inside, container.id];
    if (container.layout.kind === "frame") {
      for (const slot of archetypeSlots(container.layout.archetype)) {
        const entries = container.children.flatMap((entry, index) => (entry.slot === slot ? [{ entry, index }] : []));
        rows.push({ kind: "slot", key: `slot:${container.id}:${slot}`, depth, frameId: container.id, slot, count: entries.length });
        for (const { entry, index } of entries) {
          rows.push(gap({ parentId: container.id, index, slot }, depth + 1, chain, false));
          node(entry.node, depth + 1, container.id, chain);
        }
        rows.push(gap({ parentId: container.id, index: indexAfterSlot(container, slot), slot }, depth + 1, chain, true));
      }
      return;
    }
    container.children.forEach((entry, index) => {
      rows.push(gap({ parentId: container.id, index }, depth, chain, false));
      node(entry.node, depth, container.id, chain);
    });
    rows.push(gap({ parentId: container.id, index: container.children.length }, depth, chain, true));
  };

  const node = (current: Node, depth: number, parentId: string | undefined, inside: string[]) => {
    const isCollapsed = current.type === "container" && collapsed.has(current.id);
    rows.push({ kind: "node", key: `node:${current.id}`, depth, node: current, parentId, collapsed: isCollapsed });
    if (current.type === "container" && !isCollapsed) children(current, depth + 1, inside);
  };

  node(screen.root, 0, undefined, []);
  return rows;
};
