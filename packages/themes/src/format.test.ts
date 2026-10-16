import { describe, expect, it } from "vitest";
import { cascadeLines, formatValue, fractionOf, noiseFor } from "./format.ts";

describe("format helpers", () => {
  it("formats numbers to a precision and leaves text alone", () => {
    expect(formatValue(87.456, 1)).toBe("87.5");
    expect(formatValue("NOMINAL", 2)).toBe("NOMINAL");
  });

  it("clamps fractions to 0..1", () => {
    expect(fractionOf(50, 0, 200)).toBe(0.25);
    expect(fractionOf(-5, 0, 100)).toBe(0);
    expect(fractionOf(500, 0, 100)).toBe(1);
  });

  it("gives every node its own stable noise", () => {
    expect(noiseFor("a")(3)).toBe(noiseFor("a")(3));
    expect(noiseFor("a")(3)).not.toBe(noiseFor("b")(3));
  });

  it("makes the same cascade lines on every display", () => {
    const lines = cascadeLines("cascade", 0, 10);
    expect(lines).toEqual(cascadeLines("cascade", 0, 10));
    expect(lines).toHaveLength(10);
    for (const line of lines) expect(line).toMatch(/^\d{2,6}$/);
  });
});
