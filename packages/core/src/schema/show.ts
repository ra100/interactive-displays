import { z } from "zod";
import { IdSchema } from "./ids.ts";

export const DisplayDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60).optional(),
  screen: IdSchema.optional(),
});

export const ShowSchema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  name: z.string().min(1).max(120),
  theme: z.object({ id: IdSchema }),
  // Shown on displays that have no screen of their own.
  defaultScreen: IdSchema.optional(),
  displays: z.array(DisplayDefSchema).max(100).default([]),
});

export type DisplayDef = z.infer<typeof DisplayDefSchema>;
export type Show = z.infer<typeof ShowSchema>;

export const resolveScreenId = (show: Show, displayId: string): string | undefined =>
  show.displays.find((display) => display.id === displayId)?.screen ?? show.defaultScreen;
