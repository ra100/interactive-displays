import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCatalog, defineWidget } from "./defineWidget.ts";
import { button, catalog, text, title } from "./index.ts";

describe("catalog", () => {
  it("contains the Phase 0 widgets", () => {
    expect([...catalog.keys()]).toEqual(["title", "text", "button"]);
  });

  it("rejects duplicate kinds", () => {
    const again = defineWidget({ ...title, label: "Title again" });
    expect(() => createCatalog([title, again])).toThrow(/Duplicate widget kind "title"/);
  });

  it.each([...catalog.values()])("$kind exports a JSON Schema for its props", (definition) => {
    expect(() => z.toJSONSchema(definition.props)).not.toThrow();
  });
});

describe("title", () => {
  it("defaults tone to primary", () => {
    expect(title.props.parse({ text: "BRIDGE" })).toEqual({ text: "BRIDGE", tone: "primary" });
  });

  it("rejects empty text and unknown props", () => {
    expect(title.props.safeParse({ text: "" }).success).toBe(false);
    expect(title.props.safeParse({ text: "A", colour: "#fff" }).success).toBe(false);
  });
});

describe("text", () => {
  it("defaults size and tone", () => {
    expect(text.props.parse({ text: "Hello" })).toEqual({ text: "Hello", size: "medium", tone: "secondary" });
  });

  it("rejects text over 500 characters", () => {
    expect(text.props.safeParse({ text: "x".repeat(501) }).success).toBe(false);
  });
});

describe("button", () => {
  it("defaults tone to accent", () => {
    expect(button.props.parse({ label: "ENGAGE" })).toEqual({ label: "ENGAGE", tone: "accent" });
  });

  it("rejects a missing label and an unknown tone", () => {
    expect(button.props.safeParse({}).success).toBe(false);
    expect(button.props.safeParse({ label: "GO", tone: "orange" }).success).toBe(false);
  });
});
