import { describe, expect, it } from "vitest";
import { headingTicks } from "./base/BaseNavigation.tsx";
import { alongCourse, bankCharge, bankState, bearingText, coursePoints, ellipseArc, scanAt, spectrumLevels, wavePath } from "./instruments.ts";
import { panelLook } from "./panel.ts";

describe("instrument geometry", () => {
  it("draws a trace that repeats every 100 units, so it loops without a seam", () => {
    for (const shape of ["sine", "pulse", "noise", "heartbeat"] as const) {
      const points = wavePath(shape, "trace", 1).slice(1).split(" L").map((point) => point.split(",").map(Number));
      const at = (x: number) => points.find(([px]) => Math.abs((px ?? 0) - x) < 0.01)?.[1];
      expect(at(0)).toBeCloseTo(at(100) ?? Number.NaN, 1);
      expect(at(37.5)).toBeCloseTo(at(137.5) ?? Number.NaN, 1);
    }
  });

  it("keeps a flat line at zero level", () => {
    expect(new Set(wavePath("sine", "flat", 0).match(/,[\d.]+/g))).toEqual(new Set([",50.00"]));
  });

  it("gives a spectrum the same bands on every render, between 0 and 1", () => {
    const levels = spectrumLevels("scan", 32);
    expect(levels).toEqual(spectrumLevels("scan", 32));
    expect(levels.every((level) => level > 0 && level < 1)).toBe(true);
  });

  it("draws shield arcs from one angle to another", () => {
    expect(ellipseArc(50, 50, 40, 40, -90, 90)).toBe("M10.00 50.00 A40 40 0 0 1 90.00 50.00");
  });

  it("puts the ship along its course by distance", () => {
    const course = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(alongCourse(course, 0)).toMatchObject({ x: 0, y: 0, leg: 0 });
    expect(alongCourse(course, 0.5)).toMatchObject({ x: 10, y: 10, leg: 1, angle: 90 });
    expect(alongCourse(course, 1)).toMatchObject({ x: 10, y: 30 });
    expect(coursePoints("chart", 4)).toHaveLength(4);
  });

  it("reads bank readiness from the charge", () => {
    expect(bankState(100, false)).toBe("ready");
    expect(bankState(60, false)).toBe("charging");
    expect(bankState(60, true)).toBe("armed");
    expect(bankState(2, true)).toBe("offline");
    expect(bankCharge(100, "banks", 0)).toBe(100);
    expect(bankCharge(80, "banks", 1)).toBeLessThanOrEqual(80);
  });

  it("writes bearings as three digits and wraps them", () => {
    expect(bearingText(7)).toBe("007");
    expect(bearingText(-3)).toBe("357");
    expect(bearingText(361)).toBe("001");
  });

  it("runs a scan to 100% and holds it before starting again", () => {
    const values = Array.from({ length: 60 }, (_, index) => scanAt(index * 250, 10, "scan"));
    expect(Math.max(...values)).toBe(100);
    expect(Math.min(...values)).toBeLessThan(10);
  });

  it("labels the heading tape every 30 degrees around the heading", () => {
    const ticks = headingTicks(127);
    expect(ticks.filter((tick) => tick.label).map((tick) => tick.label)).toEqual(["090", "120", "150", "180"]);
    expect(ticks.every((tick) => tick.left >= 0 && tick.left <= 100)).toBe(true);
  });
});

describe("panel shapes", () => {
  it("follows the layout's hint", () => {
    expect(panelLook("sweep-right", "a")).toMatchObject({ shape: "sweep", side: "right" });
    expect(panelLook("bracket", "a")).toMatchObject({ shape: "bracket", side: "left" });
  });

  it("picks the same shape for the same panel without a hint, and varies between panels", () => {
    expect(panelLook(undefined, "engines").shape).toBe(panelLook(undefined, "engines").shape);
    const shapes = new Set(Array.from({ length: 20 }, (_, index) => `${panelLook(undefined, `p${index}`).shape}-${panelLook(undefined, `p${index}`).side}`));
    expect(shapes.size).toBeGreaterThan(2);
  });

  it("ignores a hint it does not know", () => {
    expect(["sweep", "top", "bottom"]).toContain(panelLook("zigzag", "a").shape);
  });
});
