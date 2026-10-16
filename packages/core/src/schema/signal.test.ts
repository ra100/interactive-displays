import { describe, expect, it } from "vitest";
import { BindingSchema, SignalDefSchema, SignalIdSchema, SourceSchema } from "./signal.ts";

describe("signal ids", () => {
  it.each(["shields", "warp.output", "deck-4.eps_2"])("accepts %s", (id) => {
    expect(SignalIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["", "Warp", "warp..output", ".warp", "warp.", "warp output"])("rejects %j", (id) => {
    expect(SignalIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("sources", () => {
  it("fills in defaults", () => {
    expect(SourceSchema.parse({ kind: "walk", min: 0, max: 10 })).toEqual({ kind: "walk", min: 0, max: 10, volatility: 0.3 });
    expect(SourceSchema.parse({ kind: "manual" })).toEqual({ kind: "manual", initial: 0, min: 0, max: 100, step: 1 });
    expect(SourceSchema.parse({ kind: "clock" })).toEqual({ kind: "clock", format: "time" });
  });

  it("rejects ranges that run backwards", () => {
    expect(SourceSchema.safeParse({ kind: "walk", min: 10, max: 10 }).success).toBe(false);
    expect(SourceSchema.safeParse({ kind: "wave", min: 5, max: 1 }).success).toBe(false);
    expect(SourceSchema.safeParse({ kind: "manual", min: 100, max: 0 }).success).toBe(false);
  });
});

describe("signal definitions", () => {
  it("are ambient unless said otherwise", () => {
    const signal = SignalDefSchema.parse({ id: "hull", label: "Hull", source: { kind: "static", value: 100 } });
    expect(signal.scope).toBe("ambient");
  });

  it("take per-state changes", () => {
    const signal = SignalDefSchema.parse({
      id: "warp.output",
      label: "Warp output",
      scope: "shared",
      source: { kind: "walk", min: 90, max: 99 },
      byState: { "red-alert": { min: 95, max: 120 } },
    });
    expect(signal.byState?.["red-alert"]).toEqual({ min: 95, max: 120 });
  });
});

describe("bindings", () => {
  it("point at a show signal or carry an ambient source", () => {
    expect(BindingSchema.safeParse({ signal: "shields" }).success).toBe(true);
    expect(BindingSchema.safeParse({ ambient: { kind: "wave", min: 0, max: 1 } }).success).toBe(true);
  });

  it("reject ambient sources that do not move on their own", () => {
    expect(BindingSchema.safeParse({ ambient: { kind: "manual" } }).success).toBe(false);
    expect(BindingSchema.safeParse({ signal: "shields", ambient: { kind: "wave", min: 0, max: 1 } }).success).toBe(false);
  });
});
