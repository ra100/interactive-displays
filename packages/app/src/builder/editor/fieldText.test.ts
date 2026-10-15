import { describe, expect, it } from "vitest";
import { formatField, parseField } from "./fieldText.ts";

const base = { key: "k", label: "K", required: false };

describe("text-edited fields", () => {
  it("keeps a numeric value as a number and anything else as text", () => {
    const field = { ...base, type: "value" as const };
    expect(parseField(field, " 6.2 ")).toEqual({ value: 6.2 });
    expect(parseField(field, "NOMINAL")).toEqual({ value: "NOMINAL" });
    expect(parseField(field, "-12")).toEqual({ value: -12 });
    expect(parseField(field, "0x3F")).toEqual({ value: "0x3F" });
    expect(parseField(field, "007")).toEqual({ value: "007" });
    expect(parseField(field, "1e3")).toEqual({ value: "1e3" });
    expect(parseField(field, "")).toEqual({ value: undefined });
    expect(formatField(field, 6.2)).toBe("6.2");
  });

  it("edits lists one item per line", () => {
    const field = { ...base, type: "list" as const, maxItems: 3 };
    expect(parseField(field, "Impulse\n\n  Warp  \n")).toEqual({ value: ["Impulse", "Warp"] });
    expect(parseField(field, "a\nb\nc\nd")).toEqual({ problem: "At most 3" });
    expect(parseField({ ...field, required: true }, "")).toEqual({ value: [] });
    expect(formatField(field, ["Impulse", "Warp"])).toBe("Impulse\nWarp");
  });

  it("edits numbers separated by commas or spaces, within their range", () => {
    const field = { ...base, type: "numbers" as const, min: 0, max: 100 };
    expect(parseField(field, "40, 80 95;10")).toEqual({ value: [40, 80, 95, 10] });
    expect(parseField(field, "40, lots")).toEqual({ problem: "Use numbers separated by commas" });
    expect(parseField(field, "120")).toEqual({ problem: "Each at most 100" });
    expect(parseField(field, "-1")).toEqual({ problem: "Each at least 0" });
    expect(formatField(field, [40, 80])).toBe("40, 80");
  });

  it("edits tables one row per line with cells split by a bar", () => {
    const field = { ...base, type: "table" as const };
    expect(parseField(field, "Romulan | 2.4 ly\nKlingon|0.8 ly")).toEqual({
      value: [
        ["Romulan", "2.4 ly"],
        ["Klingon", "0.8 ly"],
      ],
    });
    expect(formatField(field, [["a", "b"]])).toBe("a | b");
  });
});
