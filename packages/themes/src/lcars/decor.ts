import { defineDecor, ToneSchema } from "@interactive-displays/core";
import { z } from "zod";

const fraction = z.number().min(0.05).max(0.95);

export const elbow = defineDecor({
  kind: "lcars.elbow",
  label: "Elbow",
  description: "The L-shaped sweep that joins a vertical column to a horizontal bar.",
  props: z.strictObject({
    corner: z.enum(["tl", "tr", "bl", "br"]).default("tl"),
    // Share of the box the vertical arm and the horizontal bar take; LCARS elbows are asymmetric.
    arm: fraction.default(0.35),
    bar: fraction.default(0.3),
    tone: ToneSchema.default("neutral"),
  }),
  example: { corner: "tl" },
});

export const bar = defineDecor({
  kind: "lcars.bar",
  label: "Bar",
  description: "A horizontal bar with optional rounded end caps and a reference number.",
  props: z.strictObject({
    caps: z.enum(["none", "left", "right", "both"]).default("none"),
    code: z.string().max(16).optional(),
    tone: ToneSchema.default("secondary"),
  }),
  example: { caps: "right", code: "47-0219" },
});

export const cap = defineDecor({
  kind: "lcars.cap",
  label: "End cap",
  description: "A rounded end piece that closes a bar.",
  props: z.strictObject({
    side: z.enum(["left", "right"]).default("left"),
    tone: ToneSchema.default("primary"),
  }),
  example: { side: "left" },
});

export const bracket = defineDecor({
  kind: "lcars.bracket",
  label: "Bracket",
  description: "A rounded bracket that groups the content next to it.",
  props: z.strictObject({
    side: z.enum(["left", "right"]).default("left"),
    tone: ToneSchema.default("accent"),
  }),
  example: { side: "left" },
});
