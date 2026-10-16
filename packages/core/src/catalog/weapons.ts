import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const weapons = defineWidget({
  kind: "weapons",
  label: "Weapon banks",
  category: "tactical",
  description:
    "Weapon banks with their charge and readiness, and launcher tubes with the ordnance left: the weapons half of a tactical station.",
  props: z.strictObject({
    label: z.string().max(40).default("WEAPONS"),
    banks: z.array(z.string().min(1).max(24)).min(1).max(8).default(["FORE ARRAY", "AFT ARRAY", "PORT ARRAY", "STBD ARRAY"]),
    charge: z.number().default(100).meta({ description: "Bank charge, 0 to 100; each bank wanders a little around it" }),
    armed: z.boolean().default(false).meta({ description: "Weapons hot: banks read ARMED, tubes light" }),
    tubes: z.number().int().min(0).max(6).default(2).meta({ description: "Launcher tubes; 0 hides them" }),
    ordnance: z.number().optional().meta({ description: "Rounds left, shown beside the tubes" }),
    ordnanceLabel: z.string().max(24).default("TORPEDOES"),
    tone: ToneSchema.default("danger"),
  }),
  example: { armed: true, ordnance: 247 },
  bindable: ["charge", "armed", "ordnance"],
});
