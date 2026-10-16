import {
  type ContainerNode,
  findNode,
  type GridArea,
  type Op,
  type Screen,
  takenIds,
  uniqueId,
} from "@interactive-displays/core";
import { fitArea, layoutOps } from "./editing.ts";

// Layout changes made with the mouse in the preview: dragging the edge between two parts, the line between
// two grid tracks or the corner of a grid cell, and the quick buttons on the selection. Pure, like editing.ts.

const round = (value: number, step: number) => Math.round(value / step) * step;

const tidy = (value: number) => Number(value.toFixed(2));

// How two neighbours share their room after the edge between them moved by `delta` pixels towards the second.
// The pair keeps its total, so the rest of the row does not move; neither gets less than a twentieth of it.
export const shareAfterDrag = (shares: [number, number], sizes: [number, number], delta: number, step = 0.1): [number, number] => {
  const total = shares[0] + shares[1];
  const room = sizes[0] + sizes[1];
  if (room <= 0 || total <= 0) return shares;
  const least = Math.max(step, total / 20);
  const first = Math.min(total - least, Math.max(least, round((total * (sizes[0] + delta)) / room, step)));
  return [tidy(first), tidy(total - first)];
};

// The weights two children of a stack or frame slot get, as place ops; 1 is the default, so it is left out.
export const weightOps = (first: string, second: string, shares: [number, number]): Op[] =>
  [
    [first, shares[0]],
    [second, shares[1]],
  ].map(([id, weight]) => ({ op: "place", id: String(id), weight: weight === 1 ? null : Number(weight) }));

const fraction = (track: string): number | undefined => (track.endsWith("fr") ? Number(track.slice(0, -2)) : undefined);

// Grid tracks after dragging the line between track `index` and the next one; "auto" tracks cannot be dragged.
export const tracksAfterDrag = (tracks: readonly string[], index: number, sizes: [number, number], delta: number): string[] | undefined => {
  const a = fraction(tracks[index] ?? "");
  const b = fraction(tracks[index + 1] ?? "");
  if (a === undefined || b === undefined) return undefined;
  const [first, second] = shareAfterDrag([a, b], sizes, delta);
  const next = [...tracks];
  next[index] = `${first}fr`;
  next[index + 1] = `${second}fr`;
  return next;
};

// Ops that change one track list of a grid and keep every child inside it.
const gridOps = (grid: ContainerNode, axis: "columns" | "rows", tracks: string[]): Op[] => {
  if (grid.layout.kind !== "grid") return [];
  const layout = { ...grid.layout, [axis]: tracks };
  const fixes = grid.children.flatMap((child): Op[] => {
    if (!child.area) return [];
    const area = fitArea(child.area, layout.columns.length, layout.rows.length);
    const same = area.col === child.area.col && area.row === child.area.row && area.colSpan === child.area.colSpan && area.rowSpan === child.area.rowSpan;
    return same ? [] : [{ op: "place", id: child.node.id, area }];
  });
  return [{ op: "layout", id: grid.id, layout }, ...fixes];
};

const gridById = (screen: Screen, id: string): ContainerNode | undefined => {
  const node = findNode(screen.root, id)?.node;
  return node?.type === "container" && node.layout.kind === "grid" ? node : undefined;
};

export const MAX_TRACKS = 12;

// One more column or row, the same size as the last one; or one fewer, from the end.
export const addTrackOps = (screen: Screen, gridId: string, axis: "columns" | "rows"): Op[] => {
  const grid = gridById(screen, gridId);
  if (grid?.layout.kind !== "grid" || grid.layout[axis].length >= MAX_TRACKS) return [];
  const tracks = grid.layout[axis];
  return gridOps(grid, axis, [...tracks, tracks.at(-1) ?? "1fr"]);
};

export const removeTrackOps = (screen: Screen, gridId: string, axis: "columns" | "rows"): Op[] => {
  const grid = gridById(screen, gridId);
  if (grid?.layout.kind !== "grid" || grid.layout[axis].length <= 1) return [];
  return gridOps(grid, axis, grid.layout[axis].slice(0, -1));
};

export const setTracksOps = (screen: Screen, gridId: string, axis: "columns" | "rows", tracks: string[]): Op[] => {
  const grid = gridById(screen, gridId);
  return grid ? gridOps(grid, axis, tracks) : [];
};

// The area of a grid child after dragging its right or bottom edge onto track `track` (1-based); it spans at
// least its own cell.
export const spanAfterDrag = (area: GridArea, edge: "right" | "bottom", track: number): GridArea => {
  const { colSpan: _colSpan, rowSpan: _rowSpan, ...cell } = area;
  const colSpan = edge === "right" ? Math.max(1, track - area.col + 1) : (area.colSpan ?? 1);
  const rowSpan = edge === "bottom" ? Math.max(1, track - area.row + 1) : (area.rowSpan ?? 1);
  return { ...cell, ...(colSpan > 1 ? { colSpan } : {}), ...(rowSpan > 1 ? { rowSpan } : {}) };
};

// Puts a node into a new row or column in its place, so something can go next to it. The node keeps its id
// and the new stack takes over its place (slot, weight, cell or rect).
export const wrapOps = (screen: Screen, id: string, direction: "row" | "column"): { ops: Op[]; id: string } | undefined => {
  const location = findNode(screen.root, id);
  if (!location?.parent) return undefined;
  const stackId = uniqueId("stack", takenIds(screen.root));
  return {
    id: stackId,
    ops: [
      {
        op: "replace",
        id,
        node: { id: stackId, type: "container", layout: { kind: "stack", direction, gap: "medium" }, children: [{ node: location.node }] },
      },
    ],
  };
};

// Turns a row into a column and back.
export const flipOps = (screen: Screen, id: string): Op[] => {
  const node = findNode(screen.root, id)?.node;
  if (node?.type !== "container" || node.layout.kind !== "stack") return [];
  return layoutOps(screen, id, { ...node.layout, direction: node.layout.direction === "row" ? "column" : "row" });
};
