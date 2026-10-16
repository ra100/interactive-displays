import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const targetLock = defineWidget({
  kind: "target-lock",
  label: "Target lock",
  category: "tactical",
  description:
    "A targeting scanner: a reticle hunting for its target, then closing on it when locked, with the target's bearing, mark and range.",
  props: z.strictObject({
    label: z.string().max(40).default("TARGETING"),
    target: z.string().max(32).optional().meta({ description: "What is in the sights" }),
    locked: z.boolean().default(false),
    bearing: z.number().default(127),
    mark: z.number().default(4),
    range: z.number().optional(),
    unit: z.string().max(8).default("KM"),
    tone: ToneSchema.default("danger"),
  }),
  example: { target: "UNKNOWN VESSEL", locked: true, bearing: 127, mark: 4, range: 42000 },
  bindable: ["locked", "bearing", "mark", "range"],
});
