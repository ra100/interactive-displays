import { SLOT_DIRECTION, type SlotName } from "../schema/archetypes.ts";
import type { ChildEntry, ContainerNode, Node } from "../schema/node.ts";
import type { Profile } from "../schema/screen.ts";

/*
 * Turning a screen: a layout designed for a landscape display shown on a portrait one (or the reverse) is
 * rearranged rather than stretched. Frames draw their portrait chrome (the nav column becomes a band under the
 * title, the side panel moves below the main area), rows of panels become columns and grids turn on their side.
 * The rules are pure and deterministic, so a display, the editor's preview and a test all get the same result.
 */

export type Orientation = "landscape" | "portrait";

export type Direction = "row" | "column";

// The shape a screen was designed for.
export const orientationOf = (aspect: Profile["aspect"]): Orientation => (aspect === "9:16" ? "portrait" : "landscape");

// The shape of a box: portrait when it is taller than it is wide.
export const orientationOfBox = (width: number, height: number): Orientation => (height > width ? "portrait" : "landscape");

// On a portrait display the nav column and the side panel become bands across the screen.
export const PORTRAIT_SLOT_DIRECTION: Record<SlotName, Direction> = {
  ...SLOT_DIRECTION,
  nav: "row",
  aside: "row",
};

// The direction a frame slot lays out its children in, for the orientation the frame is drawn in.
export const slotDirection = (slot: SlotName, orientation: Orientation): Direction =>
  orientation === "portrait" ? PORTRAIT_SLOT_DIRECTION[slot] : SLOT_DIRECTION[slot];

// The orientation a frame draws its chrome in: the display's, unless it is kept as designed.
export const frameOrientation = (node: Node, from: Orientation, to: Orientation): Orientation =>
  from !== to && node.turned?.arrange === "keep" ? from : to;

// Parts that sit in a line of their own, such as a row of buttons; a run of only these is left as it is.
const INLINE_KINDS = new Set(["button", "toggle", "button-group", "status-light"]);

/*
 * What a part needs after the turn. `narrow`: it lost width (landscape to portrait), so its rows should become
 * columns. `wide`: it lost height or gained a band's width, so its columns should become rows. `settled`: a part
 * above it was already rearranged, which gave it back its room, so it stays as designed.
 */
type Need = "narrow" | "wide" | "settled";

const visible = (children: readonly ChildEntry[]): ChildEntry[] => children.filter((child) => !child.node.hidden && child.node.type !== "decor");

// How many children at the start of a stack are its heading (a title or a line of text).
const leadingHeadings = (children: readonly ChildEntry[]): number => {
  const index = children.findIndex((child) => !(child.node.type === "widget" && (child.node.kind === "title" || child.node.kind === "text")));
  return index === -1 ? children.length : index;
};

const isInline = (node: Node): boolean => node.type === "widget" && INLINE_KINDS.has(node.kind);

const flipsTo = (node: ContainerNode, need: Need): Direction | undefined => {
  if (need === "settled" || node.layout.kind !== "stack") return undefined;
  const shown = visible(node.children);
  if (shown.length < 2) return undefined;
  if (need === "narrow" && node.layout.direction === "row" && !shown.every((child) => isInline(child.node))) return "column";
  if (need === "wide" && node.layout.direction === "column") return "row";
  return undefined;
};

const turnsGrid = (node: ContainerNode, need: Need): boolean => {
  if (node.layout.kind !== "grid") return false;
  const { columns, rows } = node.layout;
  if (need === "narrow") return columns.length > 1 && columns.length >= rows.length;
  if (need === "wide") return rows.length > 1 && rows.length >= columns.length;
  return false;
};

// A grid on its side: columns become rows and every cell moves with them.
const transposed = (node: ContainerNode & { layout: { kind: "grid" } }, children: ChildEntry[]): ContainerNode => ({
  ...node,
  layout: { ...node.layout, columns: node.layout.rows, rows: node.layout.columns },
  children: children.map(({ area, ...child }) => {
    if (!area) return child;
    return {
      ...child,
      area: {
        col: area.row,
        row: area.col,
        ...(area.rowSpan ? { colSpan: area.rowSpan } : {}),
        ...(area.colSpan ? { rowSpan: area.colSpan } : {}),
      },
    };
  }),
});

// A grid as a single line, cells in reading order (placed cells first, then the ones that flow).
const asStack = (node: ContainerNode & { layout: { kind: "grid" } }, direction: Direction, children: ChildEntry[]): ContainerNode => {
  const order = (child: ChildEntry) => (child.area ? child.area.row * 100 + child.area.col : 10_000);
  const sorted = children.map((child, index) => ({ child, index })).sort((a, b) => order(a.child) - order(b.child) || a.index - b.index);
  return {
    ...node,
    layout: { kind: "stack", direction, gap: node.layout.gap },
    children: sorted.map(({ child: { area: _area, ...rest } }) => rest),
  };
};

// What a frame slot's children need: a slot that changed direction rearranged them itself if it holds several.
const slotNeed = (slot: SlotName, count: number, need: Need, from: Orientation, to: Orientation): Need => {
  const before = slotDirection(slot, from);
  const after = slotDirection(slot, to);
  if (before === after) return slot === "main" ? need : "settled";
  if (count > 1) return "settled";
  return after === "row" ? "wide" : "narrow";
};

const turnNode = (node: Node, need: Need, from: Orientation, to: Orientation): Node => {
  const hidden = node.turned?.hidden ? { hidden: true } : {};
  if (node.type !== "container") return { ...node, ...hidden };
  const arrange = node.turned?.arrange ?? "auto";
  const { layout } = node;
  const recurse = (children: readonly ChildEntry[], next: Need) =>
    children.map((child) => ({ ...child, node: turnNode(child.node, next, from, to) }));

  if (layout.kind === "frame") {
    const drawn = frameOrientation(node, from, to);
    if (drawn === from) return { ...node, ...hidden, children: recurse(node.children, need) };
    const counts = new Map<SlotName, number>();
    for (const child of visible(node.children)) counts.set(child.slot ?? "main", (counts.get(child.slot ?? "main") ?? 0) + 1);
    return {
      ...node,
      ...hidden,
      children: node.children.map((child) => {
        const slot = child.slot ?? "main";
        return { ...child, node: turnNode(child.node, slotNeed(slot, counts.get(slot) ?? 0, need, from, to), from, to) };
      }),
    };
  }

  if (layout.kind === "stack") {
    if (arrange === "row" || arrange === "column") {
      return { ...node, ...hidden, layout: { ...layout, direction: arrange }, children: recurse(node.children, "settled") };
    }
    const flip = arrange === "auto" ? flipsTo(node, need) : undefined;
    if (flip === "row") {
      // A panel laid out along a band keeps its heading on top, with the rest side by side beneath it.
      const lead = leadingHeadings(node.children);
      const rest = node.children.slice(lead);
      if (lead > 0 && visible(rest).length >= 2) {
        const row: ContainerNode = { ...node, layout: { ...layout, direction: "row" }, children: recurse(rest, "settled") };
        delete row.turned;
        const weight = rest.reduce((sum, child) => sum + (child.node.hidden ? 0 : (child.weight ?? 1)), 0);
        return { ...node, ...hidden, children: [...recurse(node.children.slice(0, lead), "settled"), { weight, node: row }] };
      }
      if (lead > 0) return { ...node, ...hidden, children: recurse(node.children, "settled") };
    }
    if (flip) return { ...node, ...hidden, layout: { ...layout, direction: flip }, children: recurse(node.children, "settled") };
    return { ...node, ...hidden, children: recurse(node.children, need) };
  }

  if (layout.kind === "grid") {
    const grid = { ...node, layout };
    if (arrange === "row" || arrange === "column") return { ...asStack(grid, arrange, recurse(node.children, "settled")), ...hidden };
    if (arrange === "auto" && turnsGrid(node, need)) return { ...transposed(grid, recurse(node.children, "settled")), ...hidden };
    return { ...node, ...hidden, children: recurse(node.children, need) };
  }

  // A canvas is hand-placed art: it keeps its picture, and its parts are turned inside their own boxes.
  return { ...node, ...hidden, children: recurse(node.children, need) };
};

// The screen's tree as a display of orientation `to` draws it, for a screen designed for `from`. The same
// orientation gives back the very same tree. The only part it adds is the row under a panel's heading when the
// panel is laid along a band; that row carries the panel's own id, so picking it in the editor picks the panel.
export const turnTree = (root: Node, from: Orientation, to: Orientation): Node =>
  from === to ? root : turnNode(root, from === "landscape" ? "narrow" : "wide", from, to);
