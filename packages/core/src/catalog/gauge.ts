import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const gauge = defineWidget({
  kind: "gauge",
  label: "Gauge",
  category: "data",
  description: "A level between a minimum and a maximum, such as core output or shield strength.",
  props: z
    .strictObject({
      label: z.string().min(1).max(40),
      value: z.number().default(0),
      min: z.number().default(0),
      max: z.number().default(100),
      unit: z.string().max(8).optional(),
      precision: z.number().int().min(0).max(4).default(0).meta({ description: "Decimals shown" }),
      variant: z.enum(["bar", "segmented", "arc"]).default("bar"),
      tone: ToneSchema.default("primary"),
      dangerBelow: z.number().optional().meta({ description: "Turns danger below this value" }),
      dangerAbove: z.number().optional().meta({ description: "Turns danger above this value" }),
    })
    .refine((props) => props.min < props.max, { message: "min must be below max", path: ["max"] }),
  example: { label: "CORE OUTPUT", value: 72, unit: "%" },
  bindable: ["value"],
});
