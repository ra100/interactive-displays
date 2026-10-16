import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { SPEEDS } from "./waveform.ts";
import { defineWidget } from "./defineWidget.ts";

export const globe = defineWidget({
  kind: "globe",
  label: "Planet scan",
  category: "scan",
  description:
    "A turning wireframe planet with a scan line passing over it and marked sites, for orbital surveys, away team positions and target worlds.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    sites: z.number().int().min(0).max(8).default(3).meta({ description: "Marked points on the surface" }),
    scan: z.boolean().default(true),
    speed: z.enum(SPEEDS).default("normal"),
    tone: ToneSchema.default("info"),
  }),
  example: { label: "PLANETARY SURVEY", sites: 3 },
});
