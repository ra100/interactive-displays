import { z } from "zod";
import { ActionsSchema } from "../schema/action.ts";
import { IdSchema } from "../schema/ids.ts";
import {
  ChildSchema,
  GridAreaSchema,
  LayoutSchema,
  NodeSchema,
  NormRectSchema,
  SlotSchema,
  WhenSchema,
} from "../schema/node.ts";
import { GeneratorInfoSchema, ProfileSchema } from "../schema/screen.ts";
import { BindingsSchema } from "../schema/signal.ts";

// Every change to a screen is an operation. Editor, generator, operator API and AI all speak this language,
// so one code path validates, persists, broadcasts and undoes changes for all of them.
// `null` in an optional field means "remove it".
export const OpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("insert"),
    parent: IdSchema,
    index: z.number().int().min(0).optional(),
    child: ChildSchema,
  }),
  z.object({ op: z.literal("remove"), id: IdSchema }),
  z.object({
    op: z.literal("move"),
    id: IdSchema,
    parent: IdSchema,
    index: z.number().int().min(0).optional(),
  }),
  // Shallow merge into props.
  z.object({ op: z.literal("update"), id: IdSchema, props: z.record(z.string(), z.unknown()) }),
  z.object({
    op: z.literal("set"),
    id: IdSchema,
    locked: z.boolean().nullable().optional(),
    hidden: z.boolean().nullable().optional(),
    when: WhenSchema.nullable().optional(),
    scale: z.number().min(0.25).max(4).nullable().optional(),
    // Widgets only: live values and what a control does.
    bind: BindingsSchema.nullable().optional(),
    actions: ActionsSchema.nullable().optional(),
  }),
  // Where a node sits in its parent.
  z.object({
    op: z.literal("place"),
    id: IdSchema,
    slot: SlotSchema.nullable().optional(),
    weight: z.number().positive().max(100).nullable().optional(),
    area: GridAreaSchema.nullable().optional(),
    rect: NormRectSchema.nullable().optional(),
  }),
  z.object({ op: z.literal("layout"), id: IdSchema, layout: LayoutSchema }),
  z.object({ op: z.literal("replace"), id: IdSchema, node: NodeSchema }),
  z.object({
    op: z.literal("meta"),
    name: z.string().min(1).max(120).optional(),
    section: IdSchema.nullable().optional(),
    tags: z.array(z.string().min(1).max(40)).max(50).optional(),
    profile: ProfileSchema.optional(),
    generator: GeneratorInfoSchema.nullable().optional(),
  }),
]);

export type Op = z.infer<typeof OpSchema>;
export type OpInput = z.input<typeof OpSchema>;

export const OpListSchema = z.array(OpSchema).min(1).max(500);
