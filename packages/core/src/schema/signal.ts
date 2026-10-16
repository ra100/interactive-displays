import { z } from "zod";

// Signals are the live values on a screen: a warp core output that wanders, a shield level the operator sets,
// the ship's clock. Ids may be dotted to group them ("warp.output").
export const SignalIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*(\.[a-z0-9][a-z0-9_-]*)*$/, "Signal id must be lowercase words joined by '.', like warp.output");

export const SignalValueSchema = z.union([z.number(), z.string().max(80)]);

const BELOW = { message: "min must be below max", path: ["max"] };
const ordered = (source: { min: number; max: number }) => source.min < source.max;

export const StaticSourceSchema = z.object({ kind: z.literal("static"), value: SignalValueSchema });

// Wanders smoothly between min and max; volatility 0 barely moves, 1 is restless.
export const WalkSourceSchema = z
  .object({
    kind: z.literal("walk"),
    min: z.number(),
    max: z.number(),
    volatility: z.number().min(0).max(1).default(0.3),
  })
  .refine(ordered, BELOW);

// Swings between min and max and back once per period.
export const WaveSourceSchema = z
  .object({
    kind: z.literal("wave"),
    min: z.number(),
    max: z.number(),
    periodMs: z.number().int().min(200).max(3_600_000).default(4000),
  })
  .refine(ordered, BELOW);

export const CLOCK_FORMATS = ["time", "date", "stardate"] as const;

export const ClockSourceSchema = z.object({ kind: z.literal("clock"), format: z.enum(CLOCK_FORMATS).default("time") });

// Only the operator console and display controls change it; the slider runs from min to max.
export const ManualSourceSchema = z
  .object({
    kind: z.literal("manual"),
    initial: z.number().default(0),
    min: z.number().default(0),
    max: z.number().default(100),
    step: z.number().positive().default(1),
  })
  .refine(ordered, BELOW);

export const SourceSchema = z.discriminatedUnion("kind", [
  StaticSourceSchema,
  WalkSourceSchema,
  WaveSourceSchema,
  ClockSourceSchema,
  ManualSourceSchema,
]);

// Sources that animate by themselves and can run anywhere from a seed: inline "ambient" bindings use these.
export const AmbientSourceSchema = z.discriminatedUnion("kind", [WalkSourceSchema, WaveSourceSchema]);

// Per-state changes to a source, e.g. red alert: { min: 40, max: 120 }. Merged over the source as is.
const SourceOverrideSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  volatility: z.number().min(0).max(1).optional(),
  periodMs: z.number().int().min(200).max(3_600_000).optional(),
  value: SignalValueSchema.optional(),
});

export const SignalDefSchema = z.object({
  id: SignalIdSchema,
  label: z.string().min(1).max(60),
  unit: z.string().max(12).optional(),
  // shared: the server owns the value and every display shows the same one; operators and display controls
  // can change it. ambient: each display computes it, costing no network.
  scope: z.enum(["shared", "ambient"]).default("ambient"),
  source: SourceSchema,
  byState: z.record(z.string(), SourceOverrideSchema).optional(),
});

// A prop that follows a live value: a show signal by id, or an inline ambient source seeded by the node id.
export const BindingSchema = z.union([
  z.strictObject({ signal: SignalIdSchema }),
  z.strictObject({ ambient: AmbientSourceSchema }),
]);

export const BindingsSchema = z.record(z.string().min(1).max(64), BindingSchema);

export type SignalValue = z.infer<typeof SignalValueSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type SourceInput = z.input<typeof SourceSchema>;
export type AmbientSource = z.infer<typeof AmbientSourceSchema>;
export type SourceOverride = z.infer<typeof SourceOverrideSchema>;
export type SignalDef = z.infer<typeof SignalDefSchema>;
export type SignalDefInput = z.input<typeof SignalDefSchema>;
export type Binding = z.infer<typeof BindingSchema>;
export type Bindings = z.infer<typeof BindingsSchema>;
