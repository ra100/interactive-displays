import { z } from "zod";

// Colour roles. Documents store a role; the theme decides the actual colour.
export const TONES = [
  "primary",
  "secondary",
  "accent",
  "info",
  "neutral",
  "success",
  "warning",
  "danger",
] as const;

export const ToneSchema = z.enum(TONES);

export type Tone = z.infer<typeof ToneSchema>;
