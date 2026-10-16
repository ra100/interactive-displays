import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const WAVE_SHAPES = ["sine", "pulse", "noise", "heartbeat"] as const;
export const SPEEDS = ["slow", "normal", "fast"] as const;

export const waveform = defineWidget({
  kind: "waveform",
  label: "Waveform",
  category: "scan",
  description:
    "Traces running across a scope grid: subspace carriers, sensor returns, a heartbeat on a biobed. The level sets how tall the traces swing.",
  props: z.strictObject({
    label: z.string().max(40).optional(),
    shape: z.enum(WAVE_SHAPES).default("sine"),
    traces: z.number().int().min(1).max(4).default(2),
    level: z.number().default(70).meta({ description: "How tall the traces swing, 0 to 100" }),
    speed: z.enum(SPEEDS).default("normal"),
    grid: z.boolean().default(true),
    tone: ToneSchema.default("info"),
  }),
  example: { label: "SUBSPACE CARRIER", shape: "sine", traces: 2 },
  bindable: ["level"],
});
