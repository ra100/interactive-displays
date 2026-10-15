import { z } from "zod";
import { defineWidget } from "./defineWidget.ts";

export const placeholder = defineWidget({
  kind: "placeholder",
  label: "Placeholder",
  category: "meta",
  description:
    "A note saying what belongs here, such as 'antimatter containment status'; Regenerate or AI replaces it with matching parts.",
  props: z.strictObject({
    intent: z.string().min(1).max(120).meta({ description: "What should go here, in a few words" }),
    size: z.enum(["small", "large"]).default("small").meta({ description: "How much it should hold" }),
  }),
  example: { intent: "Antimatter containment status" },
});
