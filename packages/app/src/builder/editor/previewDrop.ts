import { type ContainerNode, findNode, type NormRect, type Screen, SLOT_DIRECTION, type SlotName } from "@interactive-displays/core";
import {
  type Box,
  inEdgeBand,
  insertionIndex,
  insertionLine,
  nearestBox,
  parseTrackSizes,
  type Point,
  relativeTo,
  trackAt,
  trackSpans,
} from "./dropGeometry.ts";
import { DEFAULT_RECT, indexAfterSlot, nodeLabel, rectAt, type Target } from "./editing.ts";

// Reads the rendered preview to find where a dragged part would land: the container under the pointer, the
// position among its children, the grid cell or the point on a canvas. Boxes come back relative to the stage.

export interface Drop {
  target: Target;
  // The insertion line, the grid cell or the spot on the canvas.
  mark: Box;
  // The container (or frame slot) it goes into.
  into: Box;
  label: string;
}

type Place =
  | { kind: "node"; id: string; element: HTMLElement }
  | { kind: "slot"; frameId: string; slot: SlotName; element: HTMLElement };

const box = (element: Element): Box => {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
};

// An empty slot can have no size at all; it still gets a mark you can see.
const visible = (each: Box, least = 24): Box => ({
  left: each.left - Math.max(0, least - each.width) / 2,
  top: each.top - Math.max(0, least - each.height) / 2,
  width: Math.max(least, each.width),
  height: Math.max(least, each.height),
});

// The nodes and slots under a point, innermost first; the editor's own marks are skipped.
const placesAt = (stage: HTMLElement, pointer: Point): Place[] => {
  const hit = document
    .elementsFromPoint(pointer.x, pointer.y)
    .find((element) => stage.contains(element) && !element.closest(".preview-overlay"));
  const places: Place[] = [];
  let element = hit?.closest<HTMLElement>("[data-node-id], [data-slot]") ?? null;
  while (element && stage.contains(element)) {
    if (element.dataset["slot"]) {
      const frameId = element.parentElement?.closest<HTMLElement>("[data-node-id]")?.dataset["nodeId"];
      if (frameId) places.push({ kind: "slot", frameId, slot: element.dataset["slot"] as SlotName, element });
    } else if (element.dataset["nodeId"]) {
      places.push({ kind: "node", id: element.dataset["nodeId"], element });
    }
    element = element.parentElement?.closest<HTMLElement>("[data-node-id], [data-slot]") ?? null;
  }
  return places;
};

const childElement = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);

// A drop among children laid out along one axis: a stack, or the children of one frame slot.
const alongAxis = (
  element: HTMLElement,
  entries: Array<{ id: string; index: number }>,
  direction: "row" | "column",
  pointer: Point,
  end: number,
): { index: number; mark: Box; into: Box } => {
  const axis = direction === "row" ? "x" : "y";
  const shown = entries.flatMap((entry) => {
    const child = childElement(element, entry.id);
    return child ? [{ index: entry.index, box: box(child) }] : [];
  });
  const boxes = shown.map((each) => each.box);
  const position = insertionIndex(axis, boxes, pointer);
  const into = visible(box(element));
  return {
    index: shown[position]?.index ?? end,
    mark: insertionLine(axis, into, boxes[position - 1], boxes[position]),
    into,
  };
};

const intoSlot = (frame: ContainerNode, slot: SlotName, element: HTMLElement, pointer: Point): Omit<Drop, "label"> => {
  const entries = frame.children.flatMap((child, index) => (child.slot === slot ? [{ id: child.node.id, index }] : []));
  const { index, mark, into } = alongAxis(element, entries, SLOT_DIRECTION[slot], pointer, indexAfterSlot(frame, slot));
  return { target: { parentId: frame.id, index, slot }, mark, into };
};

const px = (value: string) => Number.parseFloat(value) || 0;

// A free cell takes the part as its own; on a taken cell it goes in before the part there and flows, so
// nothing ends up on top of anything else.
const intoGrid = (grid: ContainerNode, element: HTMLElement, pointer: Point): Omit<Drop, "label"> & { before?: string } => {
  const style = getComputedStyle(element);
  const outer = box(element);
  const columns = trackSpans(outer.left + px(style.paddingLeft), parseTrackSizes(style.gridTemplateColumns), px(style.columnGap));
  const rows = trackSpans(outer.top + px(style.paddingTop), parseTrackSizes(style.gridTemplateRows), px(style.rowGap));
  if (columns.length === 0 || rows.length === 0) {
    return { target: { parentId: grid.id, index: grid.children.length }, mark: outer, into: outer };
  }
  const col = trackAt(columns, pointer.x);
  const row = trackAt(rows, pointer.y);
  const [left, right] = columns[col - 1] ?? [outer.left, outer.left + outer.width];
  const [top, bottom] = rows[row - 1] ?? [outer.top, outer.top + outer.height];
  const cell = { left, top, width: right - left, height: bottom - top };
  const centre = { x: left + cell.width / 2, y: top + cell.height / 2 };
  const index = grid.children.findIndex((child) => {
    const shown = childElement(element, child.node.id);
    if (!shown) return false;
    const each = box(shown);
    return centre.x >= each.left && centre.x <= each.left + each.width && centre.y >= each.top && centre.y <= each.top + each.height;
  });
  const taken = grid.children[index];
  if (taken) {
    const shown = childElement(element, taken.node.id);
    const each = shown ? box(shown) : cell;
    return {
      target: { parentId: grid.id, index, flow: true },
      mark: { left: each.left, top: each.top, width: 4, height: each.height },
      into: outer,
      before: nodeLabel(taken.node),
    };
  }
  return { target: { parentId: grid.id, index: grid.children.length, area: { col, row } }, mark: cell, into: outer };
};

const intoCanvas = (canvas: ContainerNode, element: HTMLElement, pointer: Point, size: NormRect | undefined): Omit<Drop, "label"> => {
  const outer = box(element);
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const point = { x: clamp((pointer.x - outer.left) / outer.width), y: clamp((pointer.y - outer.top) / outer.height) };
  const rect = rectAt(point, size ?? DEFAULT_RECT);
  return {
    target: { parentId: canvas.id, index: canvas.children.length, point },
    mark: { left: outer.left + rect.x * outer.width, top: outer.top + rect.y * outer.height, width: rect.w * outer.width, height: rect.h * outer.height },
    into: outer,
  };
};

// The frame's own slots (not those of frames inside it), so a drop on its chrome goes to the nearest one.
const ownSlots = (frame: HTMLElement): HTMLElement[] =>
  [...frame.querySelectorAll<HTMLElement>("[data-slot]")].filter((slot) => slot.parentElement?.closest("[data-node-id]") === frame);

const fromRelative = (stage: Box, drop: Omit<Drop, "label">, label: string): Drop => ({
  ...drop,
  mark: relativeTo(stage, drop.mark),
  into: relativeTo(stage, drop.into),
  label,
});

// Where a drop at `pointer` (client coordinates) lands, or undefined when there is nowhere to put it. `dragged` is
// a node being moved: it cannot go into itself, so the search starts at its parent.
export const findDrop = (stage: HTMLElement, screen: Screen, pointer: Point, dragged?: string): Drop | undefined => {
  let places = placesAt(stage, pointer);
  const own = dragged ? places.findIndex((place) => place.kind === "node" && place.id === dragged) : -1;
  if (own !== -1) places = places.slice(own + 1);
  const stageBox = box(stage);

  for (const [position, place] of places.entries()) {
    if (place.kind === "slot") {
      const frame = findNode(screen.root, place.frameId)?.node;
      if (frame?.type !== "container") continue;
      return fromRelative(stageBox, intoSlot(frame, place.slot, place.element, pointer), `Into ${place.slot}`);
    }
    const location = findNode(screen.root, place.id);
    const node = location?.node;
    if (node?.type !== "container") continue;
    // Near the edge of a container that sits in another one, the drop goes next to it instead of into it.
    if (location?.parent && position < places.length - 1 && inEdgeBand(box(place.element), pointer)) continue;
    const label = `Into ${nodeLabel(node)}`;
    const { layout } = node;
    if (layout.kind === "stack") {
      const entries = node.children.map((child, index) => ({ id: child.node.id, index }));
      const { index, mark, into } = alongAxis(place.element, entries, layout.direction, pointer, node.children.length);
      return fromRelative(stageBox, { target: { parentId: node.id, index }, mark, into }, label);
    }
    if (layout.kind === "grid") {
      const { before, ...drop } = intoGrid(node, place.element, pointer);
      // Dropped back on its own cell: nothing to do.
      if (drop.target.flow && node.children[drop.target.index]?.node.id === dragged) return undefined;
      const area = drop.target.area;
      return fromRelative(stageBox, drop, area ? `${label}, cell ${area.col}·${area.row}` : before ? `${label}, before ${before}` : label);
    }
    if (layout.kind === "canvas") {
      const size = dragged ? findNode(screen.root, dragged)?.entry?.rect : undefined;
      return fromRelative(stageBox, intoCanvas(node, place.element, pointer, size), label);
    }
    const slots = ownSlots(place.element);
    const nearest = slots[nearestBox(slots.map(box), pointer)];
    const slot = nearest?.dataset["slot"] as SlotName | undefined;
    if (nearest && slot) return fromRelative(stageBox, intoSlot(node, slot, nearest, pointer), `Into ${slot}`);
  }
  return undefined;
};
