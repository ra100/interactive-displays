import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

const facing = z.number().default(100);

export const shieldStatus = defineWidget({
  kind: "shield-status",
  label: "Shield status",
  category: "tactical",
  description:
    "The ship seen from above inside its shield, one arc per facing (forward, aft, port, starboard) thinning and turning amber, then red, as it weakens.",
  props: z.strictObject({
    label: z.string().max(40).default("SHIELDS"),
    forward: facing.meta({ description: "Forward shield, 0 to 100" }),
    aft: facing.meta({ description: "Aft shield, 0 to 100" }),
    port: facing.meta({ description: "Port shield, 0 to 100" }),
    starboard: facing.meta({ description: "Starboard shield, 0 to 100" }),
    warningBelow: z.number().default(50),
    dangerBelow: z.number().default(25),
    tone: ToneSchema.default("info"),
  }),
  example: { forward: 92, aft: 78, port: 44, starboard: 100 },
  bindable: ["forward", "aft", "port", "starboard"],
});
