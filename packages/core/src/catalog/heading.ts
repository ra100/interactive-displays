import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const heading = defineWidget({
  kind: "heading",
  label: "Heading",
  category: "navigation",
  description:
    "The ship's heading as bearing and mark (\"127 mark 4\"), on a running compass tape or a compass rose.",
  props: z.strictObject({
    label: z.string().max(40).default("HEADING"),
    bearing: z.number().default(127).meta({ description: "Degrees, 0 to 360" }),
    mark: z.number().default(4).meta({ description: "Degrees above or below the galactic plane" }),
    variant: z.enum(["tape", "rose"]).default("tape"),
    tone: ToneSchema.default("primary"),
  }),
  example: { bearing: 127, mark: 4 },
  bindable: ["bearing", "mark"],
});
