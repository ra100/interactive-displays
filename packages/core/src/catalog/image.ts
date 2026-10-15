import { z } from "zod";
import { AssetNameSchema } from "../schema/asset.ts";
import { defineWidget } from "./defineWidget.ts";

export const image = defineWidget({
  kind: "image",
  label: "Image",
  category: "media",
  description: "A picture, diagram or schematic from the show's assets.",
  props: z.strictObject({
    asset: AssetNameSchema.meta({ title: "Image", description: "A file uploaded to the show", "x-editor": "asset:image" }),
    // contain shows the whole image; cover fills the space and crops the edges.
    fit: z.enum(["contain", "cover"]).default("contain"),
    alt: z.string().max(120).optional(),
  }),
  example: { asset: "schematic.svg", alt: "Ship schematic" },
});
