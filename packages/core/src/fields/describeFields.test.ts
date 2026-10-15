import { describe, expect, it } from "vitest";
import { z } from "zod";
import { catalog } from "../catalog/index.ts";
import { ToneSchema } from "../schema/tone.ts";
import { describeFields, humanize } from "./describeFields.ts";

describe("describeFields", () => {
  it("describes the button widget", () => {
    const button = catalog.get("button");
    expect(button && describeFields(button.props)).toEqual([
      { key: "label", label: "Label", required: true, type: "text", maxLength: 40, multiline: false },
      { key: "tone", label: "Tone", required: false, type: "tone", default: "accent" },
    ]);
  });

  it("uses a multi-line text field for long text", () => {
    const text = catalog.get("text");
    expect(text && describeFields(text.props)[0]).toMatchObject({ key: "text", type: "text", multiline: true });
  });

  it("describes enums, numbers and booleans with their limits and defaults", () => {
    const fields = describeFields(
      z.strictObject({
        size: z.enum(["small", "large"]).default("small"),
        count: z.number().int().min(1).max(8).optional(),
        ratio: z.number(),
        on: z.boolean().default(true),
      }),
    );
    expect(fields).toEqual([
      { key: "size", label: "Size", required: false, type: "enum", options: ["small", "large"], default: "small" },
      { key: "count", label: "Count", required: false, type: "number", integer: true, min: 1, max: 8 },
      { key: "ratio", label: "Ratio", required: true, type: "number", integer: false },
      { key: "on", label: "On", required: false, type: "boolean", default: true },
    ]);
  });

  it("recognises tone roles", () => {
    expect(describeFields(z.object({ colour: ToneSchema }))[0]?.type).toBe("tone");
  });

  it("takes labels, help and editor hints from .meta()", () => {
    const fields = describeFields(
      z.object({
        src: z.string().min(1).meta({ title: "Picture", description: "An image from the show", "x-editor": "asset:image" }),
        clip: z.string().meta({ "x-editor": "asset:video" }),
        file: z.string().meta({ "x-editor": "asset" }),
      }),
    );
    expect(fields).toEqual([
      { key: "src", label: "Picture", description: "An image from the show", required: true, type: "asset", accept: "image" },
      { key: "clip", label: "Clip", required: true, type: "asset", accept: "video" },
      { key: "file", label: "File", required: true, type: "asset", accept: "any" },
    ]);
  });

  it("describes lists, number lists, tables and number-or-text values", () => {
    const fields = describeFields(
      z.object({
        items: z.array(z.string()).max(8),
        levels: z.array(z.number().min(0).max(100)).optional(),
        rows: z.array(z.array(z.string())),
        value: z.union([z.number(), z.string()]).default(0),
      }),
    );
    expect(fields).toEqual([
      { key: "items", label: "Items", required: true, type: "list", maxItems: 8 },
      { key: "levels", label: "Levels", required: false, type: "numbers", min: 0, max: 100 },
      { key: "rows", label: "Rows", required: true, type: "table" },
      { key: "value", label: "Value", required: false, type: "value", default: 0 },
    ]);
  });

  it("falls back to JSON for nested values", () => {
    const fields = describeFields(
      z.object({ area: z.object({ col: z.number() }).optional(), deep: z.array(z.object({ a: z.number() })) }),
    );
    expect(fields.map((field) => field.type)).toEqual(["json", "json"]);
  });

  it("returns no fields for a schema that is not an object", () => {
    expect(describeFields(z.string())).toEqual([]);
  });

  it.each([...catalog.values()])("describes every prop of $kind", (definition) => {
    const fields = describeFields(definition.props);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((field) => field.type !== "json")).toBe(true);
  });
});

describe("humanize", () => {
  it.each([
    ["label", "Label"],
    ["colSpan", "Col span"],
    ["max-value", "Max value"],
    ["snake_case", "Snake case"],
  ])("%s → %s", (key, label) => {
    expect(humanize(key)).toBe(label);
  });
});
