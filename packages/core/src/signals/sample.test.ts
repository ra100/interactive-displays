import { describe, expect, it } from "vitest";
import { ManualSourceSchema, SignalDefSchema, SourceSchema } from "../schema/signal.ts";
import {
  formatClock,
  isServerOwned,
  isSettable,
  isTicking,
  manualStart,
  nextManualValue,
  roundValue,
  sampleAmbient,
  sampleSource,
  seedOf,
  sourceInState,
  stardate,
  wander,
} from "./sample.ts";

const walk = SourceSchema.parse({ kind: "walk", min: 90, max: 99, volatility: 0.5 });
const wave = SourceSchema.parse({ kind: "wave", min: 0, max: 10, periodMs: 1000 });

describe("seedOf", () => {
  it("is stable and tells ids apart", () => {
    expect(seedOf("warp.output")).toBe(seedOf("warp.output"));
    expect(seedOf("warp.output")).not.toBe(seedOf("warp.input"));
  });
});

describe("wander", () => {
  it("stays between 0 and 1 and moves smoothly", () => {
    const seed = seedOf("x");
    let previous = wander(seed, 0);
    for (let x = 0.01; x < 50; x += 0.01) {
      const value = wander(seed, x);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(Math.abs(value - previous)).toBeLessThan(0.05);
      previous = value;
    }
  });
});

describe("sampleAmbient", () => {
  it("keeps a walk inside its range and actually moves", () => {
    const values = Array.from({ length: 200 }, (_, index) => sampleAmbient(walk as never, 7, index * 500));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(90);
    expect(Math.max(...values)).toBeLessThanOrEqual(99);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(3);
  });

  it("gives the same value for the same seed and time on every machine", () => {
    expect(sampleAmbient(walk as never, 42, 123_456)).toBe(sampleAmbient(walk as never, 42, 123_456));
    expect(sampleAmbient(walk as never, 42, 123_456)).not.toBe(sampleAmbient(walk as never, 43, 123_456));
  });

  it("swings a wave from min to max and back once per period", () => {
    expect(sampleAmbient(wave as never, 0, 0)).toBeCloseTo(0);
    expect(sampleAmbient(wave as never, 0, 500)).toBeCloseTo(10);
    expect(sampleAmbient(wave as never, 0, 1000)).toBeCloseTo(0);
  });
});

describe("sampleSource", () => {
  it("answers static values, manual initial values and clocks", () => {
    expect(sampleSource(SourceSchema.parse({ kind: "static", value: "ONLINE" }), 0, 0)).toBe("ONLINE");
    expect(sampleSource(SourceSchema.parse({ kind: "manual", initial: 80 }), 0, 0)).toBe(80);
    expect(sampleSource(SourceSchema.parse({ kind: "clock", format: "stardate" }), 0, Date.UTC(2026, 0, 1))).toBe("47000.0");
  });
});

describe("clocks", () => {
  it("formats time and date from the local clock", () => {
    const at = new Date(2026, 9, 15, 9, 5, 7).getTime();
    expect(formatClock("time", at)).toBe("09:05:07");
    expect(formatClock("date", at)).toBe("2026-10-15");
  });

  it("moves the stardate about a thousand a year", () => {
    expect(Number(stardate(Date.UTC(2027, 0, 1, 6)))).toBeCloseTo(48000, 0);
  });
});

describe("sourceInState", () => {
  const signal = SignalDefSchema.parse({
    id: "warp.output",
    label: "Warp output",
    source: { kind: "walk", min: 90, max: 99 },
    byState: { "red-alert": { min: 95, max: 120 }, broken: { min: 200 } },
  });

  it("applies the state's change to the source", () => {
    expect(sourceInState(signal, "red-alert")).toMatchObject({ kind: "walk", min: 95, max: 120 });
    expect(sourceInState(signal, "normal")).toBe(signal.source);
  });

  it("ignores a change that would turn the range around", () => {
    expect(sourceInState(signal, "broken")).toBe(signal.source);
  });
});

describe("server-owned signals", () => {
  it("are shared signals that tick or are set by hand", () => {
    const shared = (source: object) => SignalDefSchema.parse({ id: "s", label: "S", scope: "shared", source });
    expect(isServerOwned(shared({ kind: "manual" }))).toBe(true);
    expect(isServerOwned(shared({ kind: "walk", min: 0, max: 1 }))).toBe(true);
    expect(isServerOwned(shared({ kind: "clock" }))).toBe(false);
    expect(isTicking(shared({ kind: "manual" }))).toBe(false);
    expect(isTicking(shared({ kind: "wave", min: 0, max: 1 }))).toBe(true);
    expect(isServerOwned(SignalDefSchema.parse({ id: "a", label: "A", source: { kind: "manual" } }))).toBe(false);
    expect(isSettable(shared({ kind: "manual" }))).toBe(true);
    expect(isSettable(shared({ kind: "walk", min: 0, max: 1 }))).toBe(false);
  });
});

describe("nextManualValue", () => {
  const shields = SignalDefSchema.parse({ id: "shields", label: "Shields", source: { kind: "manual", min: 0, max: 100, step: 5 } });

  it("sets, moves, clamps and snaps", () => {
    expect(nextManualValue(shields, 50, { value: 72 })).toBe(70);
    expect(nextManualValue(shields, 50, { delta: -10 })).toBe(40);
    expect(nextManualValue(shields, 95, { delta: 20 })).toBe(100);
    expect(nextManualValue(shields, 5, { value: -3 })).toBe(0);
  });

  it("moves by whole steps, at least one, in the delta's direction", () => {
    expect(nextManualValue(shields, 50, { delta: 1 })).toBe(55);
    expect(nextManualValue(shields, 50, { delta: -1 })).toBe(45);
    expect(nextManualValue(shields, 50, { delta: 2.5 })).toBe(55);
    expect(nextManualValue(shields, 50, { delta: -2.5 })).toBe(45);
    expect(nextManualValue(shields, 50, { delta: 7 })).toBe(55);
    expect(nextManualValue(shields, 50, { delta: 0 })).toBe(50);
    expect(nextManualValue(shields, 0, { delta: -1 })).toBe(0);
  });

  it("reaches and keeps the top of a range its step does not divide evenly", () => {
    const power = SignalDefSchema.parse({ id: "power", label: "Power", source: { kind: "manual", initial: 100, max: 100, step: 30 } });
    expect(manualStart(ManualSourceSchema.parse(power.source))).toBe(100);
    expect(nextManualValue(power, 90, { delta: 30 })).toBe(100);
    expect(nextManualValue(power, 100, { value: 100 })).toBe(100);
    expect(nextManualValue(power, 100, { delta: -30 })).toBe(90);
    expect(nextManualValue(power, 100, { delta: -60 })).toBe(60);
    expect(nextManualValue(power, 60, { delta: 90 })).toBe(100);
    expect(nextManualValue(power, 50, { value: 97 })).toBe(100);
    expect(nextManualValue(power, 50, { value: 94 })).toBe(90);
  });

  it("starts from the initial value kept in range and on the step", () => {
    const start = (source: object) => manualStart(ManualSourceSchema.parse({ kind: "manual", ...source }));
    expect(start({ initial: 0, min: 20, max: 100 })).toBe(20);
    expect(start({ initial: 500, min: 0, max: 100, step: 5 })).toBe(100);
    expect(start({ initial: 42, min: 0, max: 100, step: 5 })).toBe(40);
    expect(sampleSource(ManualSourceSchema.parse({ kind: "manual", initial: 0, min: 20, max: 40 }), 0, 0)).toBe(20);
  });

  it("does nothing for other sources", () => {
    const clock = SignalDefSchema.parse({ id: "c", label: "C", source: { kind: "clock" } });
    expect(nextManualValue(clock, 0, { value: 1 })).toBeUndefined();
  });
});

describe("roundValue", () => {
  it("keeps two decimals and leaves text alone", () => {
    expect(roundValue(94.12345)).toBe(94.12);
    expect(roundValue("ONLINE")).toBe("ONLINE");
  });
});
