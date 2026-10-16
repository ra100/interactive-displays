import { z } from "zod";
import { IdSchema } from "./ids.ts";
import { NodeSchema } from "./node.ts";

export const ProfileSchema = z.object({
  aspect: z.enum(["16:9", "16:10", "4:3", "21:9", "9:16"]).default("16:9"),
  // fluid re-flows to the display; contain letterboxes to the aspect ratio.
  fit: z.enum(["fluid", "contain"]).default("fluid"),
});

// Bumped when the meaning of a saved screen changes; migrate/ upgrades older documents on read.
export const SCREEN_SCHEMA_VERSION = 2;

export const ScreenSchema = z.object({
  schemaVersion: z.literal(SCREEN_SCHEMA_VERSION),
  id: IdSchema,
  name: z.string().min(1).max(120),
  // The ship section this screen belongs to, e.g. "engineering".
  section: IdSchema.optional(),
  tags: z.array(z.string().min(1).max(40)).max(50).default([]),
  profile: ProfileSchema.default({ aspect: "16:9", fit: "fluid" }),
  // The draft revision; every accepted batch of ops adds one.
  revision: z.number().int().min(0).default(0),
  // The revision displays show. Absent until the screen is first published.
  published: z.number().int().min(0).optional(),
  root: NodeSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type ScreenInput = z.input<typeof ScreenSchema>;
