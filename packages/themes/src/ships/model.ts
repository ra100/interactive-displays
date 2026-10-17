import { SHIP_CLASSES, ShipSystemSchema } from "@interactive-displays/core";
import { z } from "zod";
import norway from "./norway.json" with { type: "json" };

// Ship line art traced from a 3D model by tools/ships (Blender's Freestyle for the drawings, depth maps for the
// solid). Everything is in metres in the ship's frame, centred on its bounding box: x runs aft, y to port, z up.
// A view is that frame projected onto the page (y down): top (x, y), side (x, -z), front (y, -z).

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

// SVG path data in page metres.
const PathSchema = z.string();

const ViewArtSchema = z.strictObject({
  // The outline's bounding box: x, y, width, height.
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  outline: PathSchema,
  lines: PathSchema,
  detail: PathSchema,
  windows: PathSchema,
  decks: PathSchema,
});

const PartViewSchema = z.strictObject({
  path: PathSchema,
  // Where a label's leader lands: the point deepest inside the part as drawn.
  anchor: z.tuple([z.number(), z.number()]),
  // Behind the hull in this view; drawn see-through.
  hidden: z.literal(true).optional(),
});

const ShipModelSchema = z.strictObject({
  id: z.enum(SHIP_CLASSES),
  name: z.string(),
  size: z.strictObject({ length: z.number(), beam: z.number(), height: z.number() }),
  decks: z.number().int().positive(),
  views: z.strictObject({ top: ViewArtSchema, side: ViewArtSchema, front: ViewArtSchema }),
  parts: z.array(
    z.strictObject({
      id: z.string(),
      system: ShipSystemSchema,
      label: z.string(),
      centre: Vec3Schema,
      views: z.strictObject({ top: PartViewSchema, side: PartViewSchema, front: PartViewSchema }),
    }),
  ),
  // Power runs from the core along these, as polylines.
  conduits: z.array(z.strictObject({ id: z.string(), system: ShipSystemSchema, points: z.array(Vec3Schema).min(2) })),
  // The lines plan (stations, waterlines, buttocks) as closed loops: the first point, then steps from it.
  sections: z.array(z.string()),
});

export type ShipModel = z.infer<typeof ShipModelSchema>;
export type ShipPart = ShipModel["parts"][number];
export type FlatView = keyof ShipModel["views"];

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)/g;

// A section loop as x, y, z triples.
export const decodeLoop = (text: string): Float32Array => {
  const values = (text.match(NUMBER) ?? []).map(Number);
  const points = new Float32Array(values.length - (values.length % 3));
  for (let index = 0; index < points.length; index += 1) {
    const step = values[index] ?? 0;
    points[index] = index < 3 ? step : (points[index - 3] ?? 0) + step;
  }
  return points;
};

export interface Ship extends ShipModel {
  loops: readonly Float32Array[];
}

const load = (data: unknown): Ship => {
  const model = ShipModelSchema.parse(data);
  return { ...model, loops: model.sections.map(decodeLoop) };
};

export const ships: Readonly<Record<(typeof SHIP_CLASSES)[number], Ship>> = { norway: load(norway) };
