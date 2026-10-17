import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

// Ship classes with line art drawn from a model (packages/themes/src/ships), and the systems every class
// marks on its drawings.
export const SHIP_CLASSES = ["norway"] as const;

export const SHIP_SYSTEMS = ["bridge", "deflector", "warp-core", "nacelles", "impulse", "phasers", "torpedoes", "shuttlebay"] as const;

export const ShipSystemSchema = z.enum(SHIP_SYSTEMS);

export type ShipSystem = z.infer<typeof ShipSystemSchema>;

// top looks down on the ship, side at its port side, front at its bow; turn spins it in three dimensions.
export const SHIP_VIEWS = ["top", "side", "front", "turn"] as const;

// What the drawing is for: line art only, weapons and shields, power from the core, or damage control.
export const SHIP_MODES = ["schematic", "tactical", "engineering", "damage"] as const;

const systems = z.array(ShipSystemSchema).max(SHIP_SYSTEMS.length).default([]);

export const shipSchematic = defineWidget({
  kind: "ship-schematic",
  label: "Ship schematic",
  category: "tactical",
  description:
    "The ship's line art from above, the side or the front, or turning in three dimensions, with its systems marked: weapons and shields for tactical, the warp core and its power flow for engineering, damaged and offline systems for damage control.",
  props: z.strictObject({
    label: z.string().max(40).default("NORWAY CLASS"),
    ship: z.enum(SHIP_CLASSES).default("norway"),
    view: z.enum(SHIP_VIEWS).default("top"),
    mode: z.enum(SHIP_MODES).default("schematic"),
    highlight: systems.meta({ description: `Systems to mark: ${SHIP_SYSTEMS.join(", ")}` }),
    damaged: systems.meta({ description: "Systems drawn as damaged, blinking" }),
    offline: systems.meta({ description: "Systems drawn dark" }),
    shields: z.number().default(100).meta({ description: "Shield strength, 0 to 100; tactical draws the bubble" }),
    armed: z.boolean().default(false).meta({ description: "Weapons hot: tactical lights the arrays and launchers" }),
    power: z.number().default(100).meta({ description: "Power from the core, 0 to 100; engineering speeds the flow with it" }),
    labels: z.boolean().default(true).meta({ description: "Name the marked systems" }),
    seconds: z.number().min(4).max(600).default(40).meta({ description: "Seconds for one turn of the turning view" }),
    tone: ToneSchema.default("info"),
  }),
  example: { view: "top", mode: "tactical", shields: 86, armed: true },
  bindable: ["shields", "armed", "power"],
});
