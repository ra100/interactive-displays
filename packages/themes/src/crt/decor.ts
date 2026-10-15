import { defineDecor, ToneSchema } from "@interactive-displays/core";
import { z } from "zod";

export const rule = defineDecor({
  kind: "crt.rule",
  label: "Rule",
  description: "A line of box-drawing characters with an optional label, like a section break in a terminal listing.",
  props: z.strictObject({
    label: z.string().max(24).optional(),
    style: z.enum(["single", "double", "dashed"]).default("double"),
    tone: ToneSchema.default("neutral"),
  }),
  example: { label: "SUBSYSTEMS", style: "double" },
});

export const brackets = defineDecor({
  kind: "crt.brackets",
  label: "Corner brackets",
  description: "Four corner marks that frame whatever sits behind them, like a targeting reticle.",
  props: z.strictObject({
    tone: ToneSchema.default("secondary"),
  }),
  example: {},
});

export const radar = defineDecor({
  kind: "crt.radar",
  label: "Radar sweep",
  description: "A round scope with range rings, a rotating sweep and a few contacts.",
  props: z.strictObject({
    contacts: z.number().int().min(0).max(8).default(3),
    tone: ToneSchema.default("primary"),
  }),
  example: { contacts: 3 },
});

export const log = defineDecor({
  kind: "crt.log",
  label: "Scrolling log",
  description: "System messages scrolling up the screen, as if the computer were busy.",
  props: z.strictObject({
    lines: z.number().int().min(3).max(14).default(8),
    speed: z.enum(["slow", "normal", "fast"]).default("normal"),
    tone: ToneSchema.default("secondary"),
  }),
  example: { lines: 6 },
});
