import { describe, expect, it } from "vitest";
import { inEdgeBand, insertionIndex, insertionLine, nearestBox, parseTrackSizes, trackAt, trackSpans } from "./dropGeometry.ts";

const row = [
  { left: 0, top: 0, width: 100, height: 50 },
  { left: 110, top: 0, width: 100, height: 50 },
  { left: 220, top: 0, width: 100, height: 50 },
];

describe("insertionIndex", () => {
  it("counts the boxes whose middle the pointer has passed", () => {
    expect(insertionIndex("x", row, { x: 10, y: 10 })).toBe(0);
    expect(insertionIndex("x", row, { x: 70, y: 10 })).toBe(1);
    expect(insertionIndex("x", row, { x: 200, y: 10 })).toBe(2);
    expect(insertionIndex("x", row, { x: 300, y: 10 })).toBe(3);
    expect(insertionIndex("y", [], { x: 0, y: 0 })).toBe(0);
  });
});

describe("insertionLine", () => {
  const container = { left: 0, top: 0, width: 320, height: 50 };

  it("sits in the gap between two boxes, across the container", () => {
    expect(insertionLine("x", container, row[0], row[1])).toEqual({ left: 103, top: 0, width: 4, height: 50 });
  });

  it("stays inside the container at either end", () => {
    expect(insertionLine("x", container, undefined, row[0]).left).toBeGreaterThanOrEqual(0);
    const last = insertionLine("x", container, row[2], undefined);
    expect(last.left + last.width).toBeLessThanOrEqual(320);
    expect(insertionLine("y", { left: 0, top: 0, width: 100, height: 100 }, undefined, undefined)).toMatchObject({ top: 48, height: 4, width: 100 });
  });
});

describe("grid tracks", () => {
  it("reads computed track sizes and finds the track under a point", () => {
    const sizes = parseTrackSizes("100px 50.5px 100px");
    expect(sizes).toEqual([100, 50.5, 100]);
    const spans = trackSpans(10, sizes, 10);
    expect(spans).toEqual([
      [10, 110],
      [120, 170.5],
      [180.5, 280.5],
    ]);
    expect(trackAt(spans, 0)).toBe(1);
    expect(trackAt(spans, 115)).toBe(2);
    expect(trackAt(spans, 200)).toBe(3);
    expect(trackAt(spans, 999)).toBe(3);
  });
});

describe("inEdgeBand", () => {
  const box = { left: 0, top: 0, width: 200, height: 200 };
  it("is true near any edge and false in the middle", () => {
    expect(inEdgeBand(box, { x: 5, y: 100 })).toBe(true);
    expect(inEdgeBand(box, { x: 100, y: 195 })).toBe(true);
    expect(inEdgeBand(box, { x: 100, y: 100 })).toBe(false);
  });

  it("narrows the band for small boxes", () => {
    expect(inEdgeBand({ left: 0, top: 0, width: 40, height: 40 }, { x: 10, y: 20 })).toBe(false);
  });
});

describe("nearestBox", () => {
  it("picks the box closest to a point", () => {
    expect(nearestBox(row, { x: 215, y: 100 })).toBe(1);
    expect(nearestBox(row, { x: 250, y: 20 })).toBe(2);
    expect(nearestBox([], { x: 0, y: 0 })).toBe(-1);
  });
});
