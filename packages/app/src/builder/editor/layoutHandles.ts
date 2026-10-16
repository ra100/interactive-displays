import { type ContainerNode, findNode, type GridArea, type Screen, SLOT_DIRECTION, type SlotName } from "@interactive-displays/core";
import { type Axis, type Box, parseTrackSizes, relativeTo, trackAt, trackSpans } from "./dropGeometry.ts";
import type { Selection } from "./editing.ts";

// The drag handles the preview draws for the selection: the edges between it and its neighbours (or between the
// children of a selected row, column or slot), the lines between a selected grid's tracks, and the right and
// bottom edges of a part in a grid. Measured from the rendered preview; boxes are relative to the stage.

interface Share {
  id: string;
  share: number;
  size: number;
}

export type Handle =
  | { kind: "share"; key: string; box: Box; axis: Axis; first: Share; second: Share }
  | { kind: "track"; key: string; box: Box; axis: Axis; gridId: string; tracks: string[]; index: number; sizes: [number, number] }
  | { kind: "span"; key: string; box: Box; edge: "right" | "bottom"; id: string; area: GridArea; spans: Array<[number, number]> };

const THICK = 12;

const rect = (element: Element): Box => {
  const each = element.getBoundingClientRect();
  return { left: each.left, top: each.top, width: each.width, height: each.height };
};

const escape = (id: string) => CSS.escape(id);

const elementOf = (stage: HTMLElement, id: string) => stage.querySelector<HTMLElement>(`[data-node-id="${escape(id)}"]`);

// A bar in the space between two boxes that sit next to each other along an axis.
const between = (axis: Axis, a: Box, b: Box): Box => {
  if (axis === "x") {
    const middle = (a.left + a.width + b.left) / 2;
    const top = Math.min(a.top, b.top);
    return { left: middle - THICK / 2, top, width: THICK, height: Math.max(a.top + a.height, b.top + b.height) - top };
  }
  const middle = (a.top + a.height + b.top) / 2;
  const left = Math.min(a.left, b.left);
  return { left, top: middle - THICK / 2, width: Math.max(a.left + a.width, b.left + b.width) - left, height: THICK };
};

interface Sequence {
  axis: Axis;
  items: Array<Share & { box: Box }>;
}

// Which way a frame slot runs as drawn: on a portrait display the nav and the side panel are bands.
const slotDirectionIn = (stage: HTMLElement, frameId: string, slot: SlotName): "row" | "column" => {
  const frame = elementOf(stage, frameId);
  const own = [...(frame?.querySelectorAll<HTMLElement>(`.slot[data-slot="${slot}"]`) ?? [])].find((each) => each.closest(".frame") === frame);
  const drawn = own?.dataset["direction"];
  return drawn === "row" || drawn === "column" ? drawn : SLOT_DIRECTION[slot];
};

// The visible children of a stack, or of one frame slot, in order along their axis.
const sequenceOf = (stage: HTMLElement, container: ContainerNode, slot: SlotName | undefined): Sequence | undefined => {
  const { layout } = container;
  const direction = layout.kind === "stack" ? layout.direction : layout.kind === "frame" && slot ? slotDirectionIn(stage, container.id, slot) : undefined;
  if (!direction) return undefined;
  const axis: Axis = direction === "row" ? "x" : "y";
  const items = container.children.flatMap((child) => {
    if (layout.kind === "frame" && child.slot !== slot) return [];
    const element = elementOf(stage, child.node.id);
    if (!element) return [];
    const box = rect(element);
    return [{ id: child.node.id, share: child.weight ?? 1, size: axis === "x" ? box.width : box.height, box }];
  });
  return { axis, items };
};

const shareHandles = (stage: Box, sequence: Sequence, only?: string): Handle[] =>
  sequence.items.slice(1).flatMap((second, position) => {
    const first = sequence.items[position];
    if (!first || (only && first.id !== only && second.id !== only)) return [];
    return [
      {
        kind: "share" as const,
        key: `share:${first.id}:${second.id}`,
        box: relativeTo(stage, between(sequence.axis, first.box, second.box)),
        axis: sequence.axis,
        first: { id: first.id, share: first.share, size: first.size },
        second: { id: second.id, share: second.share, size: second.size },
      },
    ];
  });

const px = (value: string) => Number.parseFloat(value) || 0;

interface GridGeometry {
  columns: Array<[number, number]>;
  rows: Array<[number, number]>;
  outer: Box;
}

const gridGeometry = (element: HTMLElement): GridGeometry => {
  const style = getComputedStyle(element);
  const outer = rect(element);
  return {
    columns: trackSpans(outer.left + px(style.paddingLeft), parseTrackSizes(style.gridTemplateColumns), px(style.columnGap)),
    rows: trackSpans(outer.top + px(style.paddingTop), parseTrackSizes(style.gridTemplateRows), px(style.rowGap)),
    outer,
  };
};

const trackHandles = (stage: Box, grid: ContainerNode, element: HTMLElement): Handle[] => {
  if (grid.layout.kind !== "grid") return [];
  const geometry = gridGeometry(element);
  const lines = (axis: Axis, tracks: string[], spans: Array<[number, number]>): Handle[] =>
    spans.slice(1).flatMap(([nextStart, nextEnd], position) => {
      const [start, end] = spans[position] ?? [0, 0];
      if (!tracks[position]?.endsWith("fr") || !tracks[position + 1]?.endsWith("fr")) return [];
      const middle = (end + nextStart) / 2;
      const { outer } = geometry;
      const box: Box =
        axis === "x"
          ? { left: middle - THICK / 2, top: outer.top, width: THICK, height: outer.height }
          : { left: outer.left, top: middle - THICK / 2, width: outer.width, height: THICK };
      return [
        {
          kind: "track" as const,
          key: `track:${grid.id}:${axis}:${position}`,
          box: relativeTo(stage, box),
          axis,
          gridId: grid.id,
          tracks,
          index: position,
          sizes: [end - start, nextEnd - nextStart] as [number, number],
        },
      ];
    });
  return [...lines("x", grid.layout.columns, geometry.columns), ...lines("y", grid.layout.rows, geometry.rows)];
};

const spanHandles = (stage: HTMLElement, stageBox: Box, grid: ContainerNode, id: string, area: GridArea | undefined): Handle[] => {
  const gridElement = elementOf(stage, grid.id);
  const element = elementOf(stage, id);
  if (!gridElement || !element) return [];
  const geometry = gridGeometry(gridElement);
  const own = rect(element);
  // A part that flows into the next free cell has no area yet; it starts from the cell it is drawn in.
  const cell = area ?? { col: trackAt(geometry.columns, own.left + 1), row: trackAt(geometry.rows, own.top + 1) };
  return [
    {
      kind: "span",
      key: `span:${id}:right`,
      box: relativeTo(stageBox, { left: own.left + own.width - THICK / 2, top: own.top + own.height / 2 - 20, width: THICK, height: 40 }),
      edge: "right",
      id,
      area: cell,
      spans: geometry.columns,
    },
    {
      kind: "span",
      key: `span:${id}:bottom`,
      box: relativeTo(stageBox, { left: own.left + own.width / 2 - 20, top: own.top + own.height - THICK / 2, width: 40, height: THICK }),
      edge: "bottom",
      id,
      area: cell,
      spans: geometry.rows,
    },
  ];
};

export const measureHandles = (stage: HTMLElement, screen: Screen, selection: Selection): Handle[] => {
  if (!selection) return [];
  const stageBox = rect(stage);
  if (selection.kind === "slot") {
    const frame = findNode(screen.root, selection.frameId)?.node;
    const sequence = frame?.type === "container" ? sequenceOf(stage, frame, selection.slot) : undefined;
    return sequence ? shareHandles(stageBox, sequence) : [];
  }
  const location = findNode(screen.root, selection.id);
  if (!location) return [];
  const handles: Handle[] = [];
  const { node, parent, entry } = location;
  if (parent) {
    const sequence = sequenceOf(stage, parent, entry?.slot);
    if (sequence) handles.push(...shareHandles(stageBox, sequence, node.id));
    if (parent.layout.kind === "grid") handles.push(...spanHandles(stage, stageBox, parent, node.id, entry?.area));
  }
  if (node.type === "container") {
    const element = elementOf(stage, node.id);
    if (node.layout.kind === "stack") {
      const sequence = sequenceOf(stage, node, undefined);
      if (sequence) handles.push(...shareHandles(stageBox, sequence));
    }
    if (node.layout.kind === "grid" && element) handles.push(...trackHandles(stageBox, node, element));
  }
  return handles;
};
