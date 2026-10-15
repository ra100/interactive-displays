import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const toggle = defineWidget({
  kind: "toggle",
  label: "Toggle",
  category: "control",
  description: "An on/off switch, such as shields up; its value is 1 when on and 0 when off.",
  props: z.strictObject({
    label: z.string().min(1).max(40),
    on: z.boolean().default(false),
    tone: ToneSchema.default("success"),
  }),
  example: { label: "SHIELDS" },
  bindable: ["on"],
  interactive: true,
});
