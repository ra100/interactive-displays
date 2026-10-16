import { z } from "zod";
import { ActionsSchema } from "./action.ts";
import { SLOTS } from "./archetypes.ts";
import { IdSchema } from "./ids.ts";
import { BindingsSchema } from "./signal.ts";

export const SpaceSchema = z.enum(["none", "small", "medium", "large"]);

// Per-state overrides: in red alert this gauge turns danger, that panel hides.
export const WhenSchema = z
  .array(
    z.object({
      state: IdSchema,
      props: z.record(z.string(), z.unknown()).optional(),
      hidden: z.boolean().optional(),
    }),
  )
  .max(10);

// How a part changes when the display is turned the other way from the screen's design: a landscape screen on a
// portrait display, or the reverse. `auto` rearranges it (rows become columns, grids turn), `keep` leaves it as
// designed, `row` and `column` set a stack's or grid's direction outright; `hidden` drops it.
export const TURN_ARRANGEMENTS = ["auto", "keep", "row", "column"] as const;

export const TurnedSchema = z.object({
  arrange: z.enum(TURN_ARRANGEMENTS).optional(),
  hidden: z.boolean().optional(),
});

const nodeBase = {
  id: IdSchema,
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  when: WhenSchema.optional(),
  // Draws this part and everything in it larger or smaller than the rest of the screen.
  scale: z.number().min(0.25).max(4).optional(),
  turned: TurnedSchema.optional(),
};

// Grid tracks: fractions of the free space ("2fr") or "auto".
export const TrackSchema = z.string().regex(/^(\d{1,2}(\.\d{1,2})?fr|auto)$/, 'Track must be like "1fr" or "auto"');

export const FrameLayoutSchema = z.object({
  kind: z.literal("frame"),
  archetype: IdSchema,
});

export const StackLayoutSchema = z.object({
  kind: z.literal("stack"),
  direction: z.enum(["row", "column"]),
  gap: SpaceSchema.default("medium"),
});

export const GridLayoutSchema = z.object({
  kind: z.literal("grid"),
  columns: z.array(TrackSchema).min(1).max(12),
  rows: z.array(TrackSchema).min(1).max(12),
  gap: SpaceSchema.default("medium"),
});

// Free placement for hand-made art; children carry normalised rects.
export const CanvasLayoutSchema = z.object({
  kind: z.literal("canvas"),
});

export const LayoutSchema = z.discriminatedUnion("kind", [
  FrameLayoutSchema,
  StackLayoutSchema,
  GridLayoutSchema,
  CanvasLayoutSchema,
]);

export const GridAreaSchema = z.object({
  col: z.number().int().min(1).max(12),
  row: z.number().int().min(1).max(12),
  colSpan: z.number().int().min(1).max(12).optional(),
  rowSpan: z.number().int().min(1).max(12).optional(),
});

const unit = z.number().min(0).max(1);

export const NormRectSchema = z
  .object({ x: unit, y: unit, w: unit.positive(), h: unit.positive() })
  .refine((rect) => rect.x + rect.w <= 1.0001 && rect.y + rect.h <= 1.0001, "Rect must stay inside its canvas");

export const SlotSchema = z.enum(SLOTS);

export const WidgetNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("widget"),
  kind: z.string().min(1).max(64),
  // Validated against the catalog definition for `kind` by validateScreen.
  props: z.record(z.string(), z.unknown()).default({}),
  // Props that follow a live value instead of their fixed one, e.g. { value: { signal: "warp.output" } }.
  bind: BindingsSchema.optional(),
  // What a control does when an actor uses it.
  actions: ActionsSchema.optional(),
});

// Theme-specific ornament without meaning, such as an LCARS elbow. Kinds are "<theme>.<name>".
export const DecorNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("decor"),
  kind: z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/, 'Decor kind must be "<theme>.<name>"'),
  props: z.record(z.string(), z.unknown()).default({}),
});

export const ChildSchema = z.object({
  slot: SlotSchema.optional(),
  weight: z.number().positive().max(100).optional(),
  area: GridAreaSchema.optional(),
  rect: NormRectSchema.optional(),
  get node(): typeof NodeSchema {
    return NodeSchema;
  },
});

export const ContainerNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("container"),
  layout: LayoutSchema,
  get children(): z.ZodArray<typeof ChildSchema> {
    return z.array(ChildSchema).max(200);
  },
});

export const NodeSchema: z.ZodDiscriminatedUnion<
  [typeof ContainerNodeSchema, typeof WidgetNodeSchema, typeof DecorNodeSchema]
> = z.discriminatedUnion("type", [ContainerNodeSchema, WidgetNodeSchema, DecorNodeSchema]);

export type Space = z.infer<typeof SpaceSchema>;
export type When = z.infer<typeof WhenSchema>;
export type Turned = z.infer<typeof TurnedSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type GridArea = z.infer<typeof GridAreaSchema>;
export type NormRect = z.infer<typeof NormRectSchema>;
export type WidgetNode = z.infer<typeof WidgetNodeSchema>;
export type DecorNode = z.infer<typeof DecorNodeSchema>;
export type ContainerNode = z.infer<typeof ContainerNodeSchema>;
export type ChildEntry = z.infer<typeof ChildSchema>;
export type ChildEntryInput = z.input<typeof ChildSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type NodeInput = z.input<typeof NodeSchema>;
