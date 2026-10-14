import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const title = defineWidget({
  kind: "title",
  label: "Title",
  category: "text",
  description: "The heading of a screen or section, with an optional reference code.",
  props: z.strictObject({
    text: z.string().min(1).max(80),
    code: z.string().max(24).optional(),
    tone: ToneSchema.default("primary"),
  }),
  example: { text: "MAIN ENGINEERING", code: "04-1977" },
});
