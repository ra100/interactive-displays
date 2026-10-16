import { isSettable, type Show, ShowSchema } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { createSignals } from "./signals.ts";

const show: Show = ShowSchema.parse({
  schemaVersion: 1,
  id: "s",
  name: "Show",
  theme: { id: "base" },
  states: [{ id: "normal", label: "Normal" }, { id: "red-alert", label: "Red alert", effect: "alert" }],
  signals: [
    { id: "shields", label: "Shields", scope: "shared", source: { kind: "manual", initial: 0, min: 0, max: 100, step: 5 } },
    {
      id: "warp.output",
      label: "Warp output",
      scope: "shared",
      source: { kind: "walk", min: 80, max: 90 },
      byState: { "red-alert": { min: 100, max: 110 } },
    },
    { id: "eps.load", label: "EPS load", scope: "ambient", source: { kind: "walk", min: 0, max: 100 } },
    { id: "callsign", label: "Callsign", scope: "shared", source: { kind: "static", value: "NCC-1701-D" } },
  ],
});

const signal = (id: string) => {
  const found = show.signals.find((each) => each.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("server signals", () => {
  it("knows which signals can be set", () => {
    expect(show.signals.filter(isSettable).map((each) => each.id)).toEqual(["shields"]);
  });

  it("reports manual and ticking shared values, never ambient or static ones", () => {
    const values = createSignals({}).values(show, "normal", 0);
    expect(Object.keys(values)).toEqual(["shields", "warp.output"]);
    expect(values["shields"]).toBe(0);
    expect(values["warp.output"]).toBeGreaterThanOrEqual(80);
    expect(values["warp.output"]).toBeLessThanOrEqual(90);
  });

  it("starts from saved values, clamped to the signal's current range", () => {
    expect(createSignals({ shields: 40 }).values(show, "normal", 0)["shields"]).toBe(40);
    expect(createSignals({ shields: 140 }).values(show, "normal", 0)["shields"]).toBe(100);
  });

  it("starts an unset manual value from its initial value kept in range", () => {
    const narrow: Show = {
      ...show,
      signals: [{ id: "shields", label: "Shields", scope: "shared", source: { kind: "manual", initial: 0, min: 20, max: 100, step: 5 } }],
    };
    expect(createSignals({}).values(narrow, "normal", 0)["shields"]).toBe(20);
    expect(createSignals({}).set(signal("shields"), { delta: 1 })).toBe(5);
  });

  it("sets manual values within range and step, and says when nothing changed", () => {
    const signals = createSignals({});
    expect(signals.set(signal("shields"), { value: 42 })).toBe(40);
    expect(signals.set(signal("shields"), { delta: 100 })).toBe(100);
    expect(signals.set(signal("shields"), { value: 100 })).toBeUndefined();
    expect(signals.current(signal("shields"))).toBe(100);
    expect(signals.saved(show)).toEqual({ shields: 100 });
  });

  it("ticks only what changed, following the state's overrides", () => {
    const signals = createSignals({});
    const first = signals.tick(show, "normal", 1000);
    expect(Object.keys(first)).toEqual(["warp.output"]);
    expect(signals.tick(show, "normal", 1000)).toEqual({});

    const alert = signals.tick(show, "red-alert", 1000)["warp.output"];
    expect(alert).toBeGreaterThanOrEqual(100);
    expect(signals.values(show, "red-alert", 1000)["warp.output"]).toBe(alert);
  });

  it("forgets values of signals that are gone or no longer manual", () => {
    const signals = createSignals({ shields: 50, gone: 3 });
    signals.prune(show);
    expect(signals.saved(show)).toEqual({ shields: 50 });

    signals.prune({ ...show, signals: [] });
    expect(signals.saved(show)).toEqual({});
  });
});
