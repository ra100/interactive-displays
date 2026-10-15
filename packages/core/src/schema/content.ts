import { z } from "zod";
import { ActionsSchema } from "./action.ts";
import { ARCHETYPE_IDS, type ArchetypeId } from "./archetypes.ts";
import { IdSchema } from "./ids.ts";
import { SpaceSchema } from "./node.ts";
import { SignalIdSchema } from "./signal.ts";

// Content packs hold the words: what a section of the ship is about, which readings and buttons make sense
// there, and reusable blocks of widgets. They are data, so new sections are a data change and AI can write them.

// Short enough to fit a panel heading or a button (nav buttons have their own, tighter limit).
const LabelSchema = z.string().min(1).max(24);
const NavLabelSchema = z.string().min(1).max(18);

const RangeSchema = z
  .tuple([z.number(), z.number()])
  .refine(([low, high]) => low < high, "The first number must be below the second");

// How a reading is shown; the generator picks one a block allows and the metric prefers.
export const METRIC_WIDGETS = ["gauge", "readout", "sparkline"] as const;

export const MetricWidgetSchema = z.enum(METRIC_WIDGETS);

// A reading of a system, such as warp core output in percent, with where it rests and where it goes in an alert.
export const MetricSchema = z.object({
  id: IdSchema,
  label: LabelSchema,
  unit: z.string().max(8).optional(),
  range: RangeSchema,
  // Where the reading goes in alert and damaged states; red alert makes these gauges swing.
  alertRange: RangeSchema.optional(),
  precision: z.number().int().min(0).max(4).optional(),
  // walk wanders, wave swings back and forth.
  motion: z.enum(["walk", "wave"]).default("walk"),
  prefer: z.array(MetricWidgetSchema).max(3).default([]),
  // Follow this show signal instead of moving on its own, when the show has it.
  signal: SignalIdSchema.optional(),
});

export const RecipeActionSchema = z.object({
  label: LabelSchema,
  danger: z.boolean().default(false),
  // What the button does. Show states, signals and screens the show lacks are left out when generating.
  actions: ActionsSchema.optional(),
});

export const SystemSchema = z.object({
  id: IdSchema,
  label: LabelSchema,
  // For nav buttons, when the label is too long.
  short: NavLabelSchema.optional(),
  metrics: z.array(MetricSchema).min(1).max(8),
  actions: z.array(RecipeActionSchema).max(6).default([]),
  // Lines of technobabble about this system.
  notes: z.array(z.string().min(1).max(200)).max(6).default([]),
});

const weights = Object.fromEntries(ARCHETYPE_IDS.map((id) => [id, z.number().min(0).max(10).optional()])) as Record<
  ArchetypeId,
  z.ZodOptional<z.ZodNumber>
>;

export const RecipeSchema = z
  .object({
    id: IdSchema,
    label: z.string().min(1).max(40),
    description: z.string().max(200).default(""),
    // Two to four capitals for codes such as "ENG 04-7731".
    code: z.string().regex(/^[A-Z]{2,4}$/, "Code must be 2 to 4 capital letters"),
    // How often each layout is picked; layouts left out are never picked.
    archetypes: z.object(weights).refine((value) => Object.values(value).some((weight) => (weight ?? 0) > 0), {
      message: "Give at least one layout a weight above 0",
    }),
    titles: z.array(z.string().min(1).max(40)).min(1).max(8),
    systems: z.array(SystemSchema).min(2).max(10),
    nav: z.array(NavLabelSchema).min(3).max(10),
    status: z.array(z.string().min(1).max(80)).min(1).max(8),
    blocks: z
      .object({ prefer: z.array(IdSchema).max(10).default([]), avoid: z.array(IdSchema).max(10).default([]) })
      .default({ prefer: [], avoid: [] }),
    alert: z
      .object({
        banner: z.boolean().default(true),
        // Readings that turn danger in an alert.
        emphasise: z.array(IdSchema).max(8).default([]),
        status: z.array(z.string().min(1).max(80)).max(8).default([]),
      })
      .default({ banner: true, emphasise: [], status: [] }),
    // Words a placeholder's intent can match, besides the systems' and readings' labels.
    tags: z.array(z.string().min(1).max(24)).max(20).default([]),
  })
  .superRefine((recipe, context) => {
    const systems = new Set<string>();
    const metrics = new Set<string>();
    for (const [index, system] of recipe.systems.entries()) {
      if (systems.has(system.id)) context.addIssue({ code: "custom", path: ["systems", index, "id"], message: `Duplicate system "${system.id}"` });
      systems.add(system.id);
      for (const metric of system.metrics) metrics.add(metric.id);
    }
    for (const [index, id] of recipe.alert.emphasise.entries()) {
      if (!metrics.has(id)) context.addIssue({ code: "custom", path: ["alert", "emphasise", index], message: `No reading "${id}"` });
    }
  });

// A block's layout: a small language of parts the generator turns into widgets for one system.
const weight = z.number().positive().max(10).optional();

// The system's name and a code.
const HeadingPartSchema = z.object({ part: z.literal("heading"), weight });

// The system's next reading, shown as one of `show`.
const MetricPartSchema = z.object({ part: z.literal("metric"), show: z.array(MetricWidgetSchema).min(1), weight });

// Up to `max` of the system's next readings, side by side or stacked.
const MetricsPartSchema = z.object({
  part: z.literal("metrics"),
  show: z.array(MetricWidgetSchema).min(1),
  max: z.number().int().min(1).max(6),
  direction: z.enum(["row", "column"]).default("column"),
  weight,
});

// A status light per reading; emphasised ones flash in an alert.
const LightsPartSchema = z.object({ part: z.literal("lights"), max: z.number().int().min(1).max(8), weight });

// The system's buttons.
const ActionsPartSchema = z.object({
  part: z.literal("actions"),
  max: z.number().int().min(1).max(6),
  direction: z.enum(["row", "column"]).default("column"),
  weight,
});

// Something that looks busy without meaning anything.
const AmbientPartSchema = z.object({
  part: z.literal("ambient"),
  show: z.array(z.enum(["data-cascade", "status-matrix", "bar-graph"])).min(1),
  weight,
});

const NotesPartSchema = z.object({ part: z.literal("notes"), weight });

const LogPartSchema = z.object({ part: z.literal("log"), rows: z.number().int().min(2).max(10), weight });

const ClockPartSchema = z.object({ part: z.literal("clock"), weight });

const StackPartSchema = z.object({
  part: z.literal("stack"),
  direction: z.enum(["row", "column"]),
  gap: SpaceSchema.optional(),
  weight,
  get children(): z.ZodArray<typeof PartSchema> {
    return z.array(PartSchema).min(1).max(8);
  },
});

export const PartSchema: z.ZodDiscriminatedUnion<
  [
    typeof HeadingPartSchema,
    typeof MetricPartSchema,
    typeof MetricsPartSchema,
    typeof LightsPartSchema,
    typeof ActionsPartSchema,
    typeof AmbientPartSchema,
    typeof NotesPartSchema,
    typeof LogPartSchema,
    typeof ClockPartSchema,
    typeof StackPartSchema,
  ]
> = z.discriminatedUnion("part", [
  HeadingPartSchema,
  MetricPartSchema,
  MetricsPartSchema,
  LightsPartSchema,
  ActionsPartSchema,
  AmbientPartSchema,
  NotesPartSchema,
  LogPartSchema,
  ClockPartSchema,
  StackPartSchema,
]);

export const BLOCK_SIZES = ["small", "medium", "large"] as const;

// A reusable composition, such as a gauge panel: a heading, a gauge and two readouts.
export const BlockSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(40),
  description: z.string().max(200).default(""),
  fits: z.array(z.enum(["main", "aside"])).min(1),
  size: z.enum(BLOCK_SIZES),
  // What a system must have for the block to make sense.
  needs: z
    .object({ metrics: z.number().int().min(0).max(8).default(0), actions: z.number().int().min(0).max(6).default(0) })
    .default({ metrics: 0, actions: 0 }),
  // Words a placeholder's intent can match, such as "trend" or "controls".
  tags: z.array(z.string().min(1).max(24)).max(12).default([]),
  layout: PartSchema,
});

export const VocabSchema = z.object({
  // "#" is a digit and "@" a capital letter: "##-####" gives "04-7731".
  codeFormats: z.array(z.string().min(1).max(12).regex(/^[#@ \-./:]+$/)).min(1).max(10),
  statuses: z.array(z.string().min(1).max(16)).min(1).max(20),
  alertStatuses: z.array(z.string().min(1).max(16)).min(1).max(20),
  // Technobabble: "{system}" and "{word}" are filled in.
  phrases: z.array(z.string().min(1).max(160)).min(1).max(40),
  words: z.array(z.string().min(1).max(30)).min(1).max(60),
  logColumns: z.array(z.string().min(1).max(16)).min(2).max(4),
});

export const ContentPackSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(60),
    description: z.string().max(200).default(""),
    vocab: VocabSchema,
    blocks: z.array(BlockSchema).min(1).max(60),
    recipes: z.array(RecipeSchema).min(1).max(60),
  })
  .superRefine((pack, context) => {
    const blocks = new Set(pack.blocks.map((block) => block.id));
    const seen = new Set<string>();
    for (const [index, recipe] of pack.recipes.entries()) {
      if (seen.has(recipe.id)) context.addIssue({ code: "custom", path: ["recipes", index, "id"], message: `Duplicate recipe "${recipe.id}"` });
      seen.add(recipe.id);
      for (const id of [...recipe.blocks.prefer, ...recipe.blocks.avoid]) {
        if (!blocks.has(id)) context.addIssue({ code: "custom", path: ["recipes", index, "blocks"], message: `No block "${id}"` });
      }
    }
    if (blocks.size !== pack.blocks.length) context.addIssue({ code: "custom", path: ["blocks"], message: "Block ids must be unique" });
  });

// Recipes and blocks a show adds to a pack (written by people or AI), saved with the show. A recipe or block with the
// id of a built-in one replaces it.
export const ContentOverlaySchema = z.object({
  recipes: z.array(RecipeSchema).max(60).default([]),
  blocks: z.array(BlockSchema).max(60).default([]),
});

export const EMPTY_OVERLAY: ContentOverlay = { recipes: [], blocks: [] };

const byId = <T extends { id: string }>(base: readonly T[], extra: readonly T[]): T[] => [
  ...base.filter((item) => !extra.some((each) => each.id === item.id)),
  ...extra,
];

// A pack with a show's additions, checked as a whole (so a saved recipe cannot prefer a block that does not exist).
export const mergePack = (pack: ContentPack, overlay: ContentOverlay) =>
  ContentPackSchema.safeParse({ ...pack, recipes: byId(pack.recipes, overlay.recipes), blocks: byId(pack.blocks, overlay.blocks) });

export type ContentOverlay = z.infer<typeof ContentOverlaySchema>;
export type Metric = z.infer<typeof MetricSchema>;
export type MetricWidget = z.infer<typeof MetricWidgetSchema>;
export type RecipeAction = z.infer<typeof RecipeActionSchema>;
export type System = z.infer<typeof SystemSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type BlockSize = Block["size"];
export type Vocab = z.infer<typeof VocabSchema>;
export type ContentPack = z.infer<typeof ContentPackSchema>;
export type ContentPackInput = z.input<typeof ContentPackSchema>;
