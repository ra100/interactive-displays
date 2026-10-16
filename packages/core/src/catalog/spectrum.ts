import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { ACTIVITY } from "./barGraph.ts";
import { defineWidget } from "./defineWidget.ts";

export const spectrum = defineWidget({
  kind: "spectrum",
  label: "Spectrum",
  category: "scan",
  description:
    "A spectrum analyser: many thin bands over a frequency ruler, each holding its peak, for EM scans, sensor returns and comm frequencies.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    bands: z.number().int().min(8).max(64).default(32),
    activity: z.enum(ACTIVITY).default("calm"),
    peaks: z.boolean().default(true).meta({ description: "Mark each band's peak" }),
    from: z.string().max(12).optional().meta({ description: "Ruler label at the low end" }),
    to: z.string().max(12).optional().meta({ description: "Ruler label at the high end" }),
    tone: ToneSchema.default("accent"),
  }),
  example: { label: "EM SPECTRUM", bands: 32, from: "0.1 THZ", to: "40 THZ" },
});
