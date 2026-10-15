import { z } from "zod";
import { AssetNameSchema } from "../schema/asset.ts";
import { defineWidget } from "./defineWidget.ts";

export const video = defineWidget({
  kind: "video",
  label: "Video",
  category: "media",
  description: "A video from the show's assets; the operator and display buttons can play, pause and restart it.",
  props: z.strictObject({
    asset: AssetNameSchema.meta({ title: "Video", description: "A video uploaded to the show", "x-editor": "asset:video" }),
    autoplay: z.boolean().default(true),
    loop: z.boolean().default(true),
    muted: z.boolean().default(true).meta({ description: "Browsers only start videos on their own when muted" }),
    fit: z.enum(["contain", "cover"]).default("cover"),
  }),
  example: { asset: "viewscreen.mp4" },
});
