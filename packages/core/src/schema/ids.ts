import { z } from "zod";

// Ids end up in file names and URLs, so they are lowercase, short and path-safe.
export const IdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Id must be lowercase letters, digits, '-' or '_'");

export type Id = z.infer<typeof IdSchema>;
