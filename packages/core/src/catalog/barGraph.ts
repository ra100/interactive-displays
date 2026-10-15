import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const ACTIVITY = ["still", "calm", "busy"] as const;

export const barGraph = defineWidget({
  kind: "bar-graph",
  label: "Bar graph",
  category: "data",
  description: "A row of bars that rise and fall on their own, for spectra, field strengths and other busy data.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    bars: z.number().int().min(3).max(24).default(8),
    activity: z.enum(ACTIVITY).default("calm"),
    tone: ToneSchema.default("info"),
    levels: z
      .array(z.number().min(0).max(100))
      .max(24)
      .optional()
      .meta({ description: "Resting level of each bar in percent; random when empty" }),
  }),
  example: { label: "SUBSPACE FIELD", bars: 10 },
});
