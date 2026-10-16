import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const reactor = defineWidget({
  kind: "reactor",
  label: "Reactor core",
  category: "data",
  description:
    "A reactor column with light pulsing from both ends into the reaction chamber, like a warp core; the level sets how fast and bright it beats.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    level: z.number().default(70).meta({ description: "Output, 0 to 100" }),
    segments: z.number().int().min(6).max(24).default(14),
    direction: z.enum(["column", "row"]).default("column"),
    tone: ToneSchema.default("info"),
  }),
  example: { label: "WARP CORE", level: 70 },
  bindable: ["level"],
});
