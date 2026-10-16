import {
  archetypeSlots,
  catalog,
  type ChildEntry,
  cloneWithFreshIds,
  type ContainerNode,
  type DecorDefinition,
  findNode,
  type Layout,
  type Node,
  type NormRect,
  type Op,
  type Screen,
  type SlotName,
  takenIds,
  uniqueId,
  type When,
} from "@interactive-displays/core";

// Pure editing logic for the screen editor: what the buttons and drags turn into, as ops.
// Everything here works on a screen and returns ops (or data), so it is testable without a browser.

export type Selection = { kind: "node"; id: string } | { kind: "slot"; frameId: string; slot: SlotName } | null;

// Where a new or moved node goes: a container, a position in its children and, for frames, a slot.
export interface Target {
  parentId: string;
  index: number;
  slot?: SlotName;
}

const LABEL_LENGTH = 28;

const shorten = (text: string) => (text.length > LABEL_LENGTH ? `${text.slice(0, LABEL_LENGTH - 1)}…` : text);

const LAYOUT_LABELS: Record<Layout["kind"], string> = {
  frame: "Frame",
  stack: "Stack",
  grid: "Grid",
  canvas: "Canvas",
};

export const nodeLabel = (node: Node): string => {
  if (node.type === "container") {
    const { layout } = node;
    if (layout.kind === "frame") return `Frame · ${layout.archetype}`;
    if (layout.kind === "stack") return `Stack · ${layout.direction}`;
    if (layout.kind === "grid") return `Grid · ${layout.columns.length}×${layout.rows.length}`;
    return LAYOUT_LABELS[layout.kind];
  }
  const text = node.props["text"] ?? node.props["label"] ?? node.props["asset"];
  const kind = node.type === "widget" ? (catalog.get(node.kind)?.label ?? node.kind) : node.kind;
  return typeof text === "string" && text ? `${kind} · ${shorten(text)}` : kind;
};

export const defaultSlot = (archetype: string): SlotName => {
  const slots = archetypeSlots(archetype);
  return slots.includes("main") ? "main" : (slots[0] ?? "main");
};

const containerById = (screen: Screen, id: string): ContainerNode | undefined => {
  const node = findNode(screen.root, id)?.node;
  return node?.type === "container" ? node : undefined;
};

// The index after the last child in a frame slot, or the end when the slot is empty.
export const indexAfterSlot = (frame: ContainerNode, slot: SlotName): number => {
  let last = -1;
  frame.children.forEach((child, index) => {
    if (child.slot === slot) last = index;
  });
  return last === -1 ? frame.children.length : last + 1;
};

const appendInto = (container: ContainerNode, slot?: SlotName): Target => {
  if (container.layout.kind !== "frame") return { parentId: container.id, index: container.children.length };
  const target = slot ?? defaultSlot(container.layout.archetype);
  return { parentId: container.id, index: indexAfterSlot(container, target), slot: target };
};

// Where the editor's Add buttons put a new node: into the selected container or slot, or after the selected node.
export const insertTarget = (screen: Screen, selection: Selection): Target | undefined => {
  if (selection?.kind === "slot") {
    const frame = containerById(screen, selection.frameId);
    return frame ? appendInto(frame, selection.slot) : undefined;
  }
  const location = selection ? findNode(screen.root, selection.id) : undefined;
  if (location?.node.type === "container") return appendInto(location.node);
  if (location?.parent && location.index !== undefined) {
    return {
      parentId: location.parent.id,
      index: location.index + 1,
      ...(location.entry?.slot ? { slot: location.entry.slot } : {}),
    };
  }
  return screen.root.type === "container" ? appendInto(screen.root) : undefined;
};

export const DEFAULT_RECT: NormRect = { x: 0.1, y: 0.1, w: 0.3, h: 0.2 };

const round = (value: number) => Math.round(value * 10000) / 10000;

export const snap = (value: number, step = 0.01): number => round(Math.round(value / step) * step);

const MIN_SIZE = 0.02;

// A rect snapped to the grid, at least MIN_SIZE big and inside its canvas.
export const clampRect = (rect: NormRect, step = 0.01): NormRect => {
  const w = Math.min(1, Math.max(MIN_SIZE, snap(rect.w, step)));
  const h = Math.min(1, Math.max(MIN_SIZE, snap(rect.h, step)));
  const x = Math.min(round(1 - w), Math.max(0, snap(rect.x, step)));
  const y = Math.min(round(1 - h), Math.max(0, snap(rect.y, step)));
  return { x, y, w, h };
};

// New canvas children step down and to the right, so they do not land on top of each other.
const cascadeRect = (count: number): NormRect => {
  const offset = (count % 6) * 0.05;
  return clampRect({ ...DEFAULT_RECT, x: DEFAULT_RECT.x + offset, y: DEFAULT_RECT.y + offset });
};

const placementFor = (parent: ContainerNode, slot: SlotName | undefined): Omit<ChildEntry, "node"> => {
  if (parent.layout.kind === "frame") return { slot: slot ?? defaultSlot(parent.layout.archetype) };
  if (parent.layout.kind === "canvas") return { rect: cascadeRect(parent.children.length) };
  return {};
};

export const insertOps = (screen: Screen, node: Node, target: Target): Op[] => {
  const parent = containerById(screen, target.parentId);
  if (!parent) return [];
  return [
    {
      op: "insert",
      parent: parent.id,
      index: target.index,
      child: { ...placementFor(parent, target.slot), node },
    },
  ];
};

export const newWidget = (kind: string, taken: ReadonlySet<string>, props?: Record<string, unknown>): Node => {
  const definition = catalog.get(kind);
  return {
    id: uniqueId(kind, taken),
    type: "widget",
    kind,
    props: structuredClone(props ?? (definition?.example as Record<string, unknown> | undefined) ?? {}),
  };
};

export const newDecor = (definition: DecorDefinition, taken: ReadonlySet<string>): Node => ({
  id: uniqueId(definition.kind.split(".")[1] ?? "decor", taken),
  type: "decor",
  kind: definition.kind,
  props: structuredClone(definition.example as Record<string, unknown>),
});

export type ContainerPreset = "column" | "row" | "grid" | "canvas";

export const CONTAINER_PRESETS: Record<ContainerPreset, { label: string; layout: Layout }> = {
  column: { label: "Column", layout: { kind: "stack", direction: "column", gap: "medium" } },
  row: { label: "Row", layout: { kind: "stack", direction: "row", gap: "medium" } },
  grid: { label: "Grid 2×2", layout: { kind: "grid", columns: ["1fr", "1fr"], rows: ["1fr", "1fr"], gap: "medium" } },
  canvas: { label: "Canvas", layout: { kind: "canvas" } },
};

export const newContainer = (preset: ContainerPreset, taken: ReadonlySet<string>): Node => ({
  id: uniqueId(preset === "column" || preset === "row" ? "stack" : preset, taken),
  type: "container",
  layout: structuredClone(CONTAINER_PRESETS[preset].layout),
  children: [],
});

// The placement keys a child needs in its new parent, as one place op (or nothing when it already fits).
const fixPlacement = (id: string, entry: ChildEntry, parent: ContainerNode, slot: SlotName | undefined): Op[] => {
  const place: Extract<Op, { op: "place" }> = { op: "place", id };
  const kind = parent.layout.kind;
  if (kind === "frame") {
    const wanted = slot ?? (entry.slot && archetypeSlots(parent.layout.archetype).includes(entry.slot) ? entry.slot : undefined);
    const next = wanted ?? defaultSlot(parent.layout.archetype);
    if (entry.slot !== next) place.slot = next;
  } else if (entry.slot) {
    place.slot = null;
  }
  if (kind === "canvas" && !entry.rect) place.rect = cascadeRect(parent.children.length);
  if (kind !== "canvas" && entry.rect) place.rect = null;
  if (kind !== "grid" && entry.area) place.area = null;
  return Object.keys(place).length > 2 ? [place] : [];
};

// Moves a node to a target, fixing its placement for the new parent. Undefined when the move is impossible
// (the root, or into itself); an empty list when nothing would change.
export const moveOps = (screen: Screen, id: string, target: Target): Op[] | undefined => {
  const location = findNode(screen.root, id);
  const parent = containerById(screen, target.parentId);
  if (!location?.parent || location.index === undefined || !location.entry || !parent) return undefined;
  if (parent.id === id || findNode(screen.root, parent.id)?.ancestors.includes(id)) return undefined;

  const sameParent = location.parent.id === parent.id;
  const index = sameParent && location.index < target.index ? target.index - 1 : target.index;
  const placement = fixPlacement(id, location.entry, parent, target.slot);
  const moved = !sameParent || index !== location.index;
  if (!moved && placement.length === 0) return [];
  return [...(moved ? [{ op: "move" as const, id, parent: parent.id, index }] : []), ...placement];
};

// Up or down among its siblings; in a frame, among the siblings in the same slot.
export const shiftOps = (screen: Screen, id: string, delta: -1 | 1): Op[] => {
  const location = findNode(screen.root, id);
  if (!location?.parent || location.index === undefined) return [];
  const { parent, index, entry } = location;
  const siblings = parent.children
    .map((child, position) => ({ child, position }))
    .filter(({ child }) => parent.layout.kind !== "frame" || child.slot === entry?.slot);
  const at = siblings.findIndex(({ position }) => position === index);
  const neighbour = siblings[at + delta];
  if (!neighbour) return [];
  return [{ op: "move", id, parent: parent.id, index: neighbour.position }];
};

export const removeOps = (screen: Screen, id: string): Op[] => (screen.root.id === id ? [] : [{ op: "remove", id }]);

// A copy with fresh ids, right after the original; on a canvas, nudged so both stay visible.
export const duplicateOps = (screen: Screen, id: string): { ops: Op[]; id: string } | undefined => {
  const location = findNode(screen.root, id);
  if (!location?.parent || location.index === undefined || !location.entry) return undefined;
  const copy = cloneWithFreshIds(location.node, takenIds(screen.root));
  const { node: _original, ...placement } = location.entry;
  if (placement.rect) placement.rect = clampRect({ ...placement.rect, x: placement.rect.x + 0.02, y: placement.rect.y + 0.02 });
  return {
    id: copy.id,
    ops: [{ op: "insert", parent: location.parent.id, index: location.index + 1, child: { ...placement, node: copy } }],
  };
};

// Changing a container's layout also fixes its children's placement, so the result stays valid.
export const layoutOps = (screen: Screen, id: string, layout: Layout): Op[] => {
  const container = containerById(screen, id);
  if (!container) return [];
  const after: ContainerNode = { ...container, layout, children: [] };
  const fixes = container.children.flatMap((child, index) => {
    after.children = container.children.slice(0, index);
    return fixPlacement(child.node.id, child, after, undefined);
  });
  return [{ op: "layout", id, layout }, ...fixes];
};

// A screen with one canvas child moved, for live feedback while dragging; the drop applies a real op.
export const withRect = (screen: Screen, id: string, rect: NormRect): Screen => {
  const copy = structuredClone(screen);
  const entry = findNode(copy.root, id)?.entry;
  if (entry) entry.rect = rect;
  return copy;
};

// Per-state overrides. Each helper returns the new `when` list, or null when nothing is left.
const compact = (when: When): When | null => {
  const kept = when.filter((entry) => entry.hidden !== undefined || (entry.props && Object.keys(entry.props).length > 0));
  return kept.length > 0 ? kept : null;
};

const editEntry = (when: When | undefined, state: string, edit: (entry: When[number]) => When[number]): When | null => {
  const list = when ?? [];
  const existing = list.find((entry) => entry.state === state) ?? { state };
  const next = edit(structuredClone(existing));
  return compact(list.some((entry) => entry.state === state) ? list.map((entry) => (entry.state === state ? next : entry)) : [...list, next]);
};

export const setOverride = (when: When | undefined, state: string, key: string, value: unknown): When | null =>
  editEntry(when, state, (entry) => {
    const props = { ...entry.props };
    if (value === undefined) delete props[key];
    else props[key] = value;
    const { props: _old, ...rest } = entry;
    return Object.keys(props).length > 0 ? { ...rest, props } : rest;
  });

export const setHiddenIn = (when: When | undefined, state: string, hidden: boolean): When | null =>
  editEntry(when, state, (entry) => {
    const { hidden: _old, ...rest } = entry;
    return hidden ? { ...rest, hidden: true } : rest;
  });

export type DragHandle = "move" | "nw" | "ne" | "sw" | "se";

// A canvas child's rect after dragging its box or a corner by (dx, dy), in canvas fractions; snapped and kept inside.
export const dragRect = (from: NormRect, handle: DragHandle, dx: number, dy: number): NormRect => {
  const { x, y, w, h } = from;
  switch (handle) {
    case "move":
      return clampRect({ x: x + dx, y: y + dy, w, h });
    case "se":
      return clampRect({ x, y, w: Math.min(w + dx, 1 - x), h: Math.min(h + dy, 1 - y) });
    case "nw": {
      const left = Math.min(Math.max(0, x + dx), x + w - MIN_SIZE);
      const top = Math.min(Math.max(0, y + dy), y + h - MIN_SIZE);
      return clampRect({ x: left, y: top, w: x + w - left, h: y + h - top });
    }
    case "ne": {
      const top = Math.min(Math.max(0, y + dy), y + h - MIN_SIZE);
      return clampRect({ x, y: top, w: Math.min(w + dx, 1 - x), h: y + h - top });
    }
    case "sw": {
      const left = Math.min(Math.max(0, x + dx), x + w - MIN_SIZE);
      return clampRect({ x: left, y, w: x + w - left, h: Math.min(h + dy, 1 - y) });
    }
  }
};
