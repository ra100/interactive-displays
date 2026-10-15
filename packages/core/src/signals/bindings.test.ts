import { describe, expect, it } from "vitest";
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

  it("keeps the fixed value when the signal is missing", () => {
    expect(bindProps({ value: 3 }, { value: { signal: "nope" } }, "g", environment())).toEqual({ value: 3 });
  });
});
