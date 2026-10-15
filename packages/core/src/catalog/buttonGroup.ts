import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const buttonGroup = defineWidget({
  kind: "button-group",
  label: "Button group",
  category: "control",
  description: "A set of options where one is chosen, such as a weapon selector; its value is the chosen number.",
  props: z.strictObject({
    items: z.array(z.string().min(1).max(24)).min(1).max(8),
    selected: z.number().int().min(0).max(7).default(0).meta({ description: "The chosen option, counting from 0" }),
    orientation: z.enum(["row", "column"]).default("row"),
    tone: ToneSchema.default("accent"),
  }),
  example: { items: ["PHASERS", "TORPEDOES", "TRACTOR"] },
  bindable: ["selected"],
  interactive: true,
});
