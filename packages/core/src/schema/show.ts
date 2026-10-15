import { z } from "zod";
import { IdSchema } from "./ids.ts";

// What a state looks like is up to the theme; the show only names the effect.
export const EFFECTS = ["none", "warning", "alert", "damaged", "blackout"] as const;

export const EffectSchema = z.enum(EFFECTS);

export const StateDefSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(40),
  effect: EffectSchema.default("none"),
  // Text for alert banners, e.g. "RED ALERT".
  banner: z.string().min(1).max(40).optional(),
});

export const DisplayDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60).optional(),
  screen: IdSchema.optional(),
});

export const ShowSettingsSchema = z.object({
  // Rehearsal mode: every edit goes on air at once instead of waiting for Publish.
  liveEdit: z.boolean().default(false),
});

export const DEFAULT_STATES: StateDef[] = [{ id: "normal", label: "Normal", effect: "none" }];

const uniqueIds = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;

export const ShowSchema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  name: z.string().min(1).max(120),
  theme: z.object({ id: IdSchema, variant: IdSchema.optional() }),
  // Show-wide modes; the first one is the state a fresh show starts in.
  states: z
    .array(StateDefSchema)
    .min(1)
    .max(20)
    .refine(uniqueIds, "State ids must be unique")
    .default(DEFAULT_STATES),
  // Shown on displays that have no screen of their own.
  defaultScreen: IdSchema.optional(),
  displays: z.array(DisplayDefSchema).max(100).refine(uniqueIds, "Display ids must be unique").default([]),
  settings: ShowSettingsSchema.default({ liveEdit: false }),
});

export type Effect = z.infer<typeof EffectSchema>;
export type StateDef = z.infer<typeof StateDefSchema>;
export type DisplayDef = z.infer<typeof DisplayDefSchema>;
export type ShowSettings = z.infer<typeof ShowSettingsSchema>;
export type Show = z.infer<typeof ShowSchema>;
export type ShowInput = z.input<typeof ShowSchema>;

export const resolveScreenId = (show: Show, displayId: string): string | undefined =>
  show.displays.find((display) => display.id === displayId)?.screen ?? show.defaultScreen;

export const findState = (show: Show, stateId: string): StateDef | undefined =>
  show.states.find((state) => state.id === stateId);
