import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { ACTIVITY } from "./barGraph.ts";
import { defineWidget } from "./defineWidget.ts";

export const statusMatrix = defineWidget({
  kind: "status-matrix",
  label: "Status matrix",
  category: "data",
  description: "A grid of small lamps flickering on and off, the background hum of a working console.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    columns: z.number().int().min(2).max(16).default(8),
    rows: z.number().int().min(1).max(8).default(3),
    activity: z.enum(ACTIVITY).default("calm"),
    tone: ToneSchema.default("info"),
  }),
  example: { label: "EPS TAPS", columns: 8, rows: 3 },
});
