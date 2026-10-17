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
      "reactor",
      "waveform",
      "spectrum",
      "globe",
      "scan-progress",
      "shield-status",
      "weapons",
      "target-lock",
      "ship-schematic",
      "heading",
      "speed-ladder",
      "star-chart",
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

describe("scans, tactical and navigation widgets", () => {
  it("draws a waveform with two sine traces by default", () => {
    expect(widgets.waveform.props.parse({})).toEqual({ shape: "sine", traces: 2, level: 70, speed: "normal", grid: true, tone: "info" });
    expect(widgets.waveform.props.safeParse({ traces: 5 }).success).toBe(false);
    expect(widgets.waveform.props.safeParse({ shape: "square" }).success).toBe(false);
  });

  it("keeps a spectrum between 8 and 64 bands", () => {
    expect(widgets.spectrum.props.parse({}).bands).toBe(32);
    expect(widgets.spectrum.props.safeParse({ bands: 4 }).success).toBe(false);
    expect(widgets.spectrum.props.safeParse({ bands: 65 }).success).toBe(false);
  });

  it("repeats a scan on its own until it is given a value", () => {
    expect(widgets["scan-progress"].props.parse({})).toEqual({ label: "SCANNING", done: "COMPLETE", seconds: 12, tone: "info" });
    expect(widgets["scan-progress"].props.parse({ value: 40 }).value).toBe(40);
  });

  it("starts shields at full on every facing", () => {
    const shields = widgets["shield-status"].props.parse({});
    expect([shields.forward, shields.aft, shields.port, shields.starboard]).toEqual([100, 100, 100, 100]);
    expect(shields.warningBelow).toBeGreaterThan(shields.dangerBelow);
    expect(widgets["shield-status"].bindable).toEqual(["forward", "aft", "port", "starboard"]);
  });

  it("names four phaser banks and two tubes unless told otherwise", () => {
    const banks = widgets.weapons.props.parse({});
    expect(banks.banks).toHaveLength(4);
    expect(banks.tubes).toBe(2);
    expect(widgets.weapons.props.safeParse({ banks: [] }).success).toBe(false);
    expect(widgets.weapons.props.safeParse({ tubes: 7 }).success).toBe(false);
  });

  it("aims a target lock at a bearing and mark, not locked yet", () => {
    expect(widgets["target-lock"].props.parse({})).toMatchObject({ locked: false, bearing: 127, mark: 4, unit: "KM" });
  });

  it("draws the Norway class from above with every system in order", () => {
    expect(widgets["ship-schematic"].props.parse({})).toEqual({
      label: "NORWAY CLASS",
      ship: "norway",
      view: "top",
      mode: "schematic",
      highlight: [],
      damaged: [],
      offline: [],
      shields: 100,
      armed: false,
      power: 100,
      labels: true,
      seconds: 40,
      tone: "info",
    });
    expect(widgets["ship-schematic"].bindable).toEqual(["shields", "armed", "power"]);
  });

  it("marks only systems a ship has, in views and modes it knows", () => {
    const parse = (props: Record<string, unknown>) => widgets["ship-schematic"].props.safeParse(props).success;
    expect(parse({ view: "turn", mode: "engineering", highlight: ["warp-core", "nacelles"], damaged: ["phasers"] })).toBe(true);
    expect(parse({ highlight: ["holodeck"] })).toBe(false);
    expect(parse({ view: "aft" })).toBe(false);
    expect(parse({ mode: "science" })).toBe(false);
    expect(parse({ ship: "galaxy" })).toBe(false);
    expect(parse({ seconds: 1 })).toBe(false);
  });

  it("shows heading as a tape unless asked for a rose", () => {
    expect(widgets.heading.props.parse({}).variant).toBe("tape");
    expect(widgets.heading.props.safeParse({ variant: "dial" }).success).toBe(false);
  });

  it("ladders warp factor in nine steps", () => {
    expect(widgets["speed-ladder"].props.parse({})).toMatchObject({ label: "WARP", value: 6, steps: 9, direction: "column" });
    expect(widgets["speed-ladder"].props.safeParse({ steps: 2 }).success).toBe(false);
  });

  it("plots a course through two to eight waypoints", () => {
    expect(widgets["star-chart"].props.parse({}).waypoints).toBe(4);
    expect(widgets["star-chart"].props.safeParse({ waypoints: 1 }).success).toBe(false);
    expect(widgets["star-chart"].props.safeParse({ waypoints: 9 }).success).toBe(false);
  });

  it("pulses a reactor column at its level", () => {
    expect(widgets.reactor.props.parse({})).toEqual({ level: 70, segments: 14, direction: "column", tone: "info" });
  });

  it("files the new widgets under scans, tactical and navigation", () => {
    const categories = Object.fromEntries([...catalog.values()].map((definition) => [definition.kind, definition.category]));
    expect(categories).toMatchObject({
      waveform: "scan",
      spectrum: "scan",
      globe: "scan",
      "scan-progress": "scan",
      "shield-status": "tactical",
      weapons: "tactical",
      "target-lock": "tactical",
      "ship-schematic": "tactical",
      heading: "navigation",
      "speed-ladder": "navigation",
      "star-chart": "navigation",
    });
  });
});
