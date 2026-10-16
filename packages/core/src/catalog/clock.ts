import { z } from "zod";
import { CLOCK_FORMATS } from "../schema/signal.ts";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const clock = defineWidget({
  kind: "clock",
  label: "Clock",
  category: "data",
  description: "The time, the date or the stardate, ticking on each display.",
  props: z.strictObject({
    format: z.enum(CLOCK_FORMATS).default("stardate"),
    label: z.string().max(40).optional(),
    tone: ToneSchema.default("primary"),
  }),
  example: { format: "stardate", label: "STARDATE" },
});
