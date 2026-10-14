import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const text = defineWidget({
  kind: "text",
  label: "Text",
  category: "text",
  description: "A paragraph or short line of body text.",
  props: z.strictObject({
    text: z.string().max(500),
    size: z.enum(["small", "medium", "large"]).default("medium"),
    tone: ToneSchema.default("secondary"),
  }),
});
