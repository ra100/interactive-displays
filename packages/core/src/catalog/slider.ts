import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const slider = defineWidget({
  kind: "slider",
  label: "Slider",
  category: "control",
  description: "A level an actor drags, such as impulse power; its value is the slider position.",
  props: z
    .strictObject({
      label: z.string().min(1).max(40),
      value: z.number().default(50),
      min: z.number().default(0),
      max: z.number().default(100),
      step: z.number().positive().default(1),
      unit: z.string().max(8).optional(),
      tone: ToneSchema.default("accent"),
    })
    .refine((props) => props.min < props.max, { message: "min must be below max", path: ["max"] }),
  example: { label: "IMPULSE", value: 25, unit: "%" },
  bindable: ["value"],
  interactive: true,
});
