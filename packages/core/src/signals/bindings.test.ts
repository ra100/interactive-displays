import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SignalDefSchema } from "../schema/signal.ts";
import { bindingTicks, bindingValue, bindProps, coerceTo, type SignalEnvironment } from "./bindings.ts";
import { sampleAmbient, seedOf } from "./sample.ts";

const signals = [
  SignalDefSchema.parse({ id: "shields", label: "Shields", scope: "shared", source: { kind: "manual", initial: 100 } }),
  SignalDefSchema.parse({
    id: "warp.output",
    label: "Warp",
    scope: "shared",
    source: { kind: "walk", min: 90, max: 99 },
    byState: { "red-alert": { min: 100, max: 120 } },
  }),
  SignalDefSchema.parse({ id: "core.temp", label: "Core", source: { kind: "wave", min: 0, max: 10, periodMs: 1000 } }),
  SignalDefSchema.parse({ id: "status", label: "Status", source: { kind: "static", value: "ONLINE" } }),
];

const environment = (patch: Partial<SignalEnvironment> = {}): SignalEnvironment => ({
  signals,
  values: {},
  state: "normal",
  now: 500,
  ...patch,
});

describe("bindingValue", () => {
  it("uses the server's value for shared signals", () => {
    expect(bindingValue({ signal: "shields" }, "g", "value", environment({ values: { shields: 40 } }))).toBe(40);
  });

  it("works a shared signal out locally until the server has sent it, following the state", () => {
    expect(bindingValue({ signal: "shields" }, "g", "value", environment())).toBe(100);
    const hot = bindingValue({ signal: "warp.output" }, "g", "value", environment({ state: "red-alert" }));
    expect(hot).toBeGreaterThanOrEqual(100);
  });

  it("computes ambient signals on the display", () => {
    expect(bindingValue({ signal: "core.temp" }, "g", "value", environment())).toBeCloseTo(10);
    expect(bindingValue({ signal: "status" }, "g", "value", environment())).toBe("ONLINE");
  });

  it("seeds inline ambient sources by node and prop", () => {
    const ambient = { kind: "walk", min: 0, max: 100, volatility: 0.5 } as const;
    expect(bindingValue({ ambient }, "gauge-1", "value", environment())).toBe(sampleAmbient(ambient, seedOf("gauge-1/value"), 500));
  });

  it("moves an inline ambient source to its range for the show state", () => {
    const binding = {
      ambient: { kind: "walk", min: 90, max: 99, volatility: 0.2 },
      byState: { "red-alert": { min: 40, max: 60, volatility: 0.9 } },
    } as const;
    for (const now of [0, 1_000, 7_000, 60_000]) {
      const calm = bindingValue(binding, "g", "value", environment({ now }));
      const alert = bindingValue(binding, "g", "value", environment({ now, state: "red-alert" }));
      expect(calm).toBeGreaterThanOrEqual(90);
      expect(alert).toBeLessThanOrEqual(60);
    }
  });

  it("ignores a per-state range that would turn an inline source upside down", () => {
    const binding = { ambient: { kind: "wave", min: 0, max: 10, periodMs: 1000 }, byState: { odd: { min: 20 } } } as const;
    expect(bindingValue(binding, "g", "value", environment({ state: "odd" }))).toBe(
      bindingValue(binding, "g", "value", environment()),
    );
  });

  it("answers nothing for a signal the show does not have", () => {
    expect(bindingValue({ signal: "nope" }, "g", "value", environment())).toBeUndefined();
  });
});

describe("bindingTicks", () => {
  it("is true only for values that change with the display's clock", () => {
    expect(bindingTicks({ ambient: { kind: "wave", min: 0, max: 1, periodMs: 1000 } }, signals)).toBe(true);
    expect(bindingTicks({ signal: "core.temp" }, signals)).toBe(true);
    expect(bindingTicks({ signal: "shields" }, signals)).toBe(false);
    expect(bindingTicks({ signal: "warp.output" }, signals)).toBe(false);
    expect(bindingTicks({ signal: "status" }, signals)).toBe(false);
  });
});

describe("coerceTo", () => {
  it("adapts numbers and text to the prop's type", () => {
    expect(coerceTo(1, false)).toBe(true);
    expect(coerceTo(0, true)).toBe(false);
    expect(coerceTo("42", 0)).toBe(42);
    expect(coerceTo("high", 0)).toBe("high");
    expect(coerceTo(7, "label")).toBe("7");
  });
});

describe("bindProps", () => {
  it("replaces bound props and keeps the rest", () => {
    const props = bindProps({ label: "SHIELDS", value: 0 }, { value: { signal: "shields" } }, "g", environment({ values: { shields: 65 } }));
    expect(props).toEqual({ label: "SHIELDS", value: 65 });
  });

  it("uses a bound value as it is when it already fits, and coerces it only when it does not", () => {
    const readout = z.object({ value: z.union([z.number(), z.string()]) });
    const fits = (props: Record<string, unknown>) => readout.safeParse(props).success;
    const x = SignalDefSchema.parse({ id: "x", label: "X", scope: "shared", source: { kind: "manual" } });
    const live = (value: number | string) => environment({ signals: [x], values: { x: value } });
    const bound = (fixed: unknown, value: number | string) => bindProps({ value: fixed }, { value: { signal: "x" } }, "r", live(value), fits)["value"];
    expect(bound("RAISED", 47.38)).toBe(47.38);
    expect(bound(0, "47787.3")).toBe("47787.3");
    expect(bindProps({ on: false }, { on: { signal: "x" } }, "t", live(1), () => false)).toEqual({ on: true });
  });

  it("keeps the fixed value when the signal is missing", () => {
    expect(bindProps({ value: 3 }, { value: { signal: "nope" } }, "g", environment())).toEqual({ value: 3 });
  });
});
