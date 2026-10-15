import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCatalog, defineWidget } from "./defineWidget.ts";
import { button } from "./button.ts";
import { buttonGroup } from "./buttonGroup.ts";
import { gauge } from "./gauge.ts";
import { readout } from "./readout.ts";
import { slider } from "./slider.ts";
import { image } from "./image.ts";
import { catalog, widgets } from "./index.ts";
import { text } from "./text.ts";
import { title } from "./title.ts";

describe("catalog", () => {
  it("contains the text, control, data, alert and media widgets", () => {
    expect([...catalog.keys()]).toEqual([
      "title",
      "text",
      "button",
      "button-group",
      "toggle",
      "slider",
      "readout",
      "gauge",
      "bar-graph",
      "sparkline",
      "status-light",
      "status-matrix",
      "data-cascade",
      "data-grid",
      "clock",
      "alert-banner",
      "image",
      "video",
      "placeholder",
    ]);
  });

  it.each([...catalog.values()].filter((definition) => definition.bindable))(
    "$kind can only bind props it has",
    (definition) => {
      const props = Object.keys(z.toJSONSchema(definition.props, { io: "input" }).properties ?? {});
      for (const prop of definition.bindable ?? []) expect(props).toContain(prop);
    },
  );

  it("marks exactly the controls as interactive", () => {
    const controls = [...catalog.values()].filter((definition) => definition.interactive).map((definition) => definition.kind);
    expect(controls).toEqual(["button", "button-group", "toggle", "slider"]);
  });

  it.each(Object.entries(widgets))("registers %s under its own kind", (key, definition) => {
    expect(definition.kind).toBe(key);
  });

  it.each([...catalog.values()])("$kind has a valid example", (definition) => {
    expect(definition.props.safeParse(definition.example).success).toBe(true);
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

describe("image", () => {
  it("defaults to showing the whole image", () => {
    expect(image.props.parse({ asset: "warp.png" })).toEqual({ asset: "warp.png", fit: "contain" });
  });

  it("rejects asset names that could escape the assets folder", () => {
    expect(image.props.safeParse({ asset: "../show.json" }).success).toBe(false);
    expect(image.props.safeParse({ asset: "https://example.com/x.png" }).success).toBe(false);
  });
});

describe("readout", () => {
  it("takes numbers or short text as its value", () => {
    expect(readout.props.parse({ label: "WARP" })).toEqual({ label: "WARP", value: 0, precision: 0, tone: "secondary" });
    expect(readout.props.safeParse({ label: "SHIELDS", value: "RAISED" }).success).toBe(true);
  });
});

describe("gauge", () => {
  it("fills in its range and look", () => {
    expect(gauge.props.parse({ label: "CORE" })).toEqual({
      label: "CORE",
      value: 0,
      min: 0,
      max: 100,
      precision: 0,
      variant: "bar",
      tone: "primary",
    });
  });

  it("rejects a range that runs backwards", () => {
    expect(gauge.props.safeParse({ label: "CORE", min: 10, max: 5 }).success).toBe(false);
  });
});

describe("controls", () => {
  it("button-group needs at least one option and at most eight", () => {
    expect(buttonGroup.props.safeParse({ items: [] }).success).toBe(false);
    expect(buttonGroup.props.safeParse({ items: Array.from({ length: 9 }, (_, index) => `O${index}`) }).success).toBe(false);
  });

  it("slider rejects a step that does not move", () => {
    expect(slider.props.safeParse({ label: "IMPULSE", step: 0 }).success).toBe(false);
  });
});
