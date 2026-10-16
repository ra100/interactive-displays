import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const speedLadder = defineWidget({
  kind: "speed-ladder",
  label: "Speed ladder",
  category: "navigation",
  description:
    "A ladder of numbered speed steps with the current one lit, for warp factor, impulse or thrust settings.",
  props: z.strictObject({
    label: z.string().max(40).default("WARP"),
    value: z.number().default(6),
    steps: z.number().int().min(3).max(12).default(9),
    precision: z.number().int().min(0).max(2).default(1).meta({ description: "Decimals shown" }),
    direction: z.enum(["column", "row"]).default("column"),
    dangerAbove: z.number().optional().meta({ description: "Turns danger above this step" }),
    tone: ToneSchema.default("primary"),
  }),
  example: { label: "WARP", value: 6, steps: 9 },
  bindable: ["value"],
});
