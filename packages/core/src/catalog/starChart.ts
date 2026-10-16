import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const starChart = defineWidget({
  kind: "star-chart",
  label: "Star chart",
  category: "navigation",
  description:
    "A sector chart: a grid with stars, a plotted course through its waypoints and the ship's place along it, for helm, navigation and astrometrics.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    destination: z.string().max(32).optional(),
    waypoints: z.number().int().min(2).max(8).default(4),
    progress: z.number().default(35).meta({ description: "How far along the course the ship is, 0 to 100" }),
    stars: z.number().int().min(0).max(160).default(60),
    grid: z.boolean().default(true),
    tone: ToneSchema.default("primary"),
  }),
  example: { label: "SECTOR 001", destination: "STARBASE 74" },
  bindable: ["progress"],
});
