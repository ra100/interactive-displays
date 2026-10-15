import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const button = defineWidget({
  kind: "button",
  label: "Button",
  category: "control",
  description: "A touch target an actor can press; its actions run on every press.",
  props: z.strictObject({
    label: z.string().min(1).max(40),
    tone: ToneSchema.default("accent"),
  }),
  example: { label: "ENGAGE" },
  interactive: true,
});
