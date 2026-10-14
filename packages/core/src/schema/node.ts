import { z } from "zod";
import { IdSchema } from "./ids.ts";

const nodeBase = {
  id: IdSchema,
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

export const StackLayoutSchema = z.object({
  kind: z.literal("stack"),
  direction: z.enum(["row", "column"]),
  gap: z.enum(["none", "small", "medium", "large"]).default("medium"),
  align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
});

export const LayoutSchema = z.discriminatedUnion("kind", [StackLayoutSchema]);

export const WidgetNodeSchema = z.object({
  ...nodeBase,
  type: z.literal("widget"),
  kind: z.string().min(1).max(64),
  // Validated against the catalog definition for `kind` by validateScreen.
  props: z.record(z.string(), z.unknown()).default({}),
});

export const ChildSchema = z.object({
  weight: z.number().positive().max(100).optional(),
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
  [typeof ContainerNodeSchema, typeof WidgetNodeSchema]
> = z.discriminatedUnion("type", [ContainerNodeSchema, WidgetNodeSchema]);

export type Layout = z.infer<typeof LayoutSchema>;
export type WidgetNode = z.infer<typeof WidgetNodeSchema>;
export type ContainerNode = z.infer<typeof ContainerNodeSchema>;
export type ChildEntry = z.infer<typeof ChildSchema>;
export type Node = z.infer<typeof NodeSchema>;
