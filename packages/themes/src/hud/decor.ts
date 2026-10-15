import { defineDecor, ToneSchema } from "@interactive-displays/core";
import { z } from "zod";

export const reticle = defineDecor({
  kind: "hud.reticle",
  label: "Reticle",
  description: "Concentric rings with tick marks that turn slowly, like a targeting or scanning overlay.",
  props: z.strictObject({
    rings: z.number().int().min(1).max(4).default(3),
    spin: z.enum(["still", "slow", "fast"]).default("slow"),
    tone: ToneSchema.default("primary"),
  }),
  example: { rings: 3 },
});

export const corners = defineDecor({
  kind: "hud.corners",
  label: "Corner frame",
  description: "Angled corner lines that frame whatever sits behind them, like a lock-on box.",
  props: z.strictObject({
    tone: ToneSchema.default("secondary"),
  }),
  example: {},
});

export const scale = defineDecor({
  kind: "hud.scale",
  label: "Scale",
  description: "A ruler of fine tick marks with an optional label, the line between HUD sections.",
  props: z.strictObject({
    label: z.string().max(24).optional(),
    tone: ToneSchema.default("neutral"),
  }),
  example: { label: "SECTOR 7" },
});

export const arcs = defineDecor({
  kind: "hud.arcs",
  label: "Arc segments",
  description: "Broken ring segments turning at different speeds, a busy readout with no meaning.",
  props: z.strictObject({
    segments: z.number().int().min(2).max(6).default(4),
    tone: ToneSchema.default("accent"),
  }),
  example: { segments: 4 },
});
