// Geometry for dropping and resizing in the preview: where in a row of boxes a pointer falls, which grid track
// is under it, and where to draw the marks. Plain numbers, so it is testable without a browser.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type Axis = "x" | "y";

const start = (box: Box, axis: Axis) => (axis === "x" ? box.left : box.top);
const size = (box: Box, axis: Axis) => (axis === "x" ? box.width : box.height);
const end = (box: Box, axis: Axis) => start(box, axis) + size(box, axis);
const along = (point: Point, axis: Axis) => (axis === "x" ? point.x : point.y);

// Where a pointer falls among boxes laid out along an axis: the position of the first box whose middle is past
// the pointer, or the number of boxes when it is past all of them.
export const insertionIndex = (axis: Axis, boxes: readonly Box[], pointer: Point): number => {
  const at = along(pointer, axis);
  const found = boxes.findIndex((box) => at < start(box, axis) + size(box, axis) / 2);
  return found === -1 ? boxes.length : found;
};

const LINE = 4;

// The insertion mark between two boxes (either may be missing at the ends), across the whole container.
export const insertionLine = (axis: Axis, container: Box, before: Box | undefined, after: Box | undefined): Box => {
  const from = before ? end(before, axis) : start(container, axis);
  const to = after ? start(after, axis) : end(container, axis);
  // Inside the container, so a mark at either end stays visible.
  // In an empty container the mark goes across its middle.
  const wanted = before && after ? (from + to) / 2 : before ? from + LINE : after ? to - LINE : (from + to) / 2;
  const middle = Math.min(end(container, axis) - LINE / 2, Math.max(start(container, axis) + LINE / 2, wanted));
  return axis === "x"
    ? { left: middle - LINE / 2, top: container.top, width: LINE, height: container.height }
    : { left: container.left, top: middle - LINE / 2, width: container.width, height: LINE };
};

// Computed grid track sizes ("120px 80.5px") as numbers.
export const parseTrackSizes = (computed: string): number[] =>
  computed
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value));

// Where each track starts and ends along one side of the grid.
export const trackSpans = (from: number, sizes: readonly number[], gap: number): Array<[number, number]> => {
  let at = from;
  return sizes.map((each) => {
    const span: [number, number] = [at, at + each];
    at += each + gap;
    return span;
  });
};

// The 1-based track under a coordinate; one in a gap counts as the track before it, past the ends as the
// first or last.
export const trackAt = (spans: ReadonlyArray<[number, number]>, at: number): number => {
  const found = spans.findIndex(([, until]) => at < until);
  if (found !== -1) return found + 1;
  return Math.max(1, spans.length);
};

// Near the edge of a part: there a drop goes next to the part rather than into it.
export const inEdgeBand = (box: Box, pointer: Point, band = 14): boolean => {
  const edge = Math.min(band, box.width / 5, box.height / 5);
  return (
    pointer.x - box.left < edge ||
    box.left + box.width - pointer.x < edge ||
    pointer.y - box.top < edge ||
    box.top + box.height - pointer.y < edge
  );
};

const distance = (box: Box, point: Point) => {
  const dx = Math.max(box.left - point.x, 0, point.x - (box.left + box.width));
  const dy = Math.max(box.top - point.y, 0, point.y - (box.top + box.height));
  return Math.hypot(dx, dy);
};

// The index of the box closest to a point (0 when it is inside one).
export const nearestBox = (boxes: readonly Box[], point: Point): number => {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  boxes.forEach((box, index) => {
    const each = distance(box, point);
    if (each < bestDistance) {
      best = index;
      bestDistance = each;
    }
  });
  return best;
};

export const relativeTo = (outer: Box, inner: Box): Box => ({
  left: inner.left - outer.left,
  top: inner.top - outer.top,
  width: inner.width,
  height: inner.height,
});
