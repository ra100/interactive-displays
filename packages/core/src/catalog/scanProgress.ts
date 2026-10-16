import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const scanProgress = defineWidget({
  kind: "scan-progress",
  label: "Scan progress",
  category: "scan",
  description:
    "A scan under way: a label, a percentage and a segmented track, ending in a completion message. Without a live value it repeats on its own.",
  props: z.strictObject({
    label: z.string().min(1).max(40).default("SCANNING"),
    value: z.number().optional().meta({ description: "Percent done; repeats on its own when empty" }),
    done: z.string().max(24).default("COMPLETE").meta({ description: "Shown at 100%" }),
    seconds: z.number().min(2).max(120).default(12).meta({ description: "How long one scan takes on its own" }),
    tone: ToneSchema.default("info"),
  }),
  example: { label: "SENSOR SWEEP" },
  bindable: ["value"],
});
