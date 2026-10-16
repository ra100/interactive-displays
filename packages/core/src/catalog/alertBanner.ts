import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const alertBanner = defineWidget({
  kind: "alert-banner",
  label: "Alert banner",
  category: "alert",
  description: "Shows the current show state's banner, such as RED ALERT, and stays empty in calm states.",
  props: z.strictObject({
    text: z.string().max(40).optional().meta({ description: "Replaces the state's banner text" }),
    tone: ToneSchema.default("danger"),
  }),
  example: { text: "RED ALERT" },
});
