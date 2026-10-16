import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const sparkline = defineWidget({
  kind: "sparkline",
  label: "Sparkline",
  category: "data",
  description: "A line tracing a value over time; without a live value it draws a believable trace of its own.",
  props: z
    .strictObject({
      label: z.string().max(40).optional(),
      value: z.number().optional(),
      min: z.number().default(0),
      max: z.number().default(100),
      points: z.number().int().min(10).max(120).default(48).meta({ description: "How much history it shows" }),
      tone: ToneSchema.default("accent"),
    })
    .refine((props) => props.min < props.max, { message: "min must be below max", path: ["max"] }),
  example: { label: "PLASMA FLOW" },
  bindable: ["value"],
});
