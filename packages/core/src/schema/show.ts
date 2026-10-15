import { z } from "zod";
import { IdSchema } from "./ids.ts";
import { type SignalDef, SignalDefSchema } from "./signal.ts";

// What a state looks like is up to the theme; the show only names the effect.
export const EFFECTS = ["none", "warning", "alert", "damaged", "blackout"] as const;

export const EffectSchema = z.enum(EFFECTS);

export const StateDefSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(40),
  effect: EffectSchema.default("none"),
  // Text for alert banners, e.g. "RED ALERT".
  banner: z.string().min(1).max(40).optional(),
  // A theme sound played on every display when the show enters this state, e.g. "alert".
  sound: IdSchema.optional(),
});

// How big everything on a display is drawn: 1 sizes parts to the display, smaller values fit more on a large
// screen (an 85" 4K panel seen from a few metres needs far smaller type than a tablet).
export const UiScaleSchema = z.number().min(0.25).max(2);

// Shows start smaller than 1:1 because sets use large 4K panels.
export const DEFAULT_UI_SCALE = 0.7;

export const DisplayDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60).optional(),
  screen: IdSchema.optional(),
  // Overrides the show's scale for this one display, e.g. a smaller panel in a corridor.
  scale: UiScaleSchema.optional(),
});

export const ShowSettingsSchema = z.object({
  // Rehearsal mode: every edit goes on air at once instead of waiting for Publish.
  liveEdit: z.boolean().default(false),
  // Display controls may change the show state and shared signals. Off locks them during a take.
  displayGlobalActions: z.boolean().default(true),
  // Displays play theme sounds (button presses, state changes). Off by default: sets record their own sound.
  sounds: z.boolean().default(false),
  // AI through MCP may publish screens (they go on air on every display showing them).
  aiPublish: z.boolean().default(false),
  // AI through MCP may change the show state and shared values, and assign screens to displays.
  aiLiveControl: z.boolean().default(false),
});

export const DEFAULT_SETTINGS: ShowSettings = {
  liveEdit: false,
  displayGlobalActions: true,
  sounds: false,
  aiPublish: false,
  aiLiveControl: false,
};

export const DEFAULT_STATES: StateDef[] = [{ id: "normal", label: "Normal", effect: "none" }];

const uniqueIds = (items: readonly { id: string }[]) => new Set(items.map((item) => item.id)).size === items.length;

// Live values that screens bind to.
export const SignalListSchema = z.array(SignalDefSchema).max(200).refine(uniqueIds, "Signal ids must be unique");

export const ShowSchema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  name: z.string().min(1).max(120),
  theme: z.object({ id: IdSchema, variant: IdSchema.optional() }),
  scale: UiScaleSchema.default(DEFAULT_UI_SCALE),
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
  signals: SignalListSchema.default([]),
  settings: ShowSettingsSchema.default(DEFAULT_SETTINGS),
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

export const findSignal = (show: Pick<Show, "signals">, signalId: string): SignalDef | undefined =>
  show.signals.find((signal) => signal.id === signalId);

// The scale a display draws at: its own, or the show's.
export const displayScale = (show: Show, displayId: string): number =>
  show.displays.find((display) => display.id === displayId)?.scale ?? show.scale;
