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

export const segments = defineDecor({
  kind: "lcars.segments",
  label: "Segments",
  description:
    "A run of coloured blocks with reference numbers, the broken bars and columns that edge TNG frames. Use a row along a section edge or a column beside a panel.",
  props: z.strictObject({
    direction: z.enum(["row", "column"]).default("row"),
    count: z.number().int().min(2).max(12).default(5),
    // The tones the blocks cycle through.
    tones: z.array(ToneSchema).min(1).max(6).default(["primary", "secondary", "accent", "info"]),
    caps: z.enum(["none", "start", "end", "both"]).default("end"),
    numbers: z.boolean().default(true),
  }),
  example: { direction: "row", count: 5 },
});

export const scan = defineDecor({
  kind: "lcars.scan",
  label: "Sensor scope",
  description:
    "A round scope: range rings, bearing ticks, a sweeping arm and a few contacts, the circular Okudagram of tactical and science displays.",
  props: z.strictObject({
    rings: z.number().int().min(2).max(6).default(4),
    contacts: z.number().int().min(0).max(12).default(4),
    sweep: z.boolean().default(true),
    tone: ToneSchema.default("info"),
  }),
  example: { rings: 4, contacts: 4 },
});
