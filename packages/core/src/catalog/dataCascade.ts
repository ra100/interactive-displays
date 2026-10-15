import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const dataCascade = defineWidget({
  kind: "data-cascade",
  label: "Data cascade",
  category: "data",
  description: "Columns of numbers scrolling past, the classic computer-at-work background.",
  props: z.strictObject({
    columns: z.number().int().min(1).max(16).default(6),
    speed: z.enum(["slow", "normal", "fast"]).default("normal"),
    tone: ToneSchema.default("secondary"),
  }),
  example: { columns: 6 },
});
