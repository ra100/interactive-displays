import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const readout = defineWidget({
  kind: "readout",
  label: "Readout",
  category: "data",
  description: "A labelled value, such as a warp factor or a temperature; it can follow a live signal.",
  props: z.strictObject({
    label: z.string().min(1).max(40),
    value: z.union([z.number(), z.string().max(40)]).default(0),
    unit: z.string().max(8).optional(),
    precision: z.number().int().min(0).max(4).default(0).meta({ description: "Decimals shown for numbers" }),
    tone: ToneSchema.default("secondary"),
  }),
  example: { label: "WARP FACTOR", value: 6.2, precision: 1 },
  bindable: ["value"],
});
