import { z } from "zod";

// Layout ID: alphanumeric with hyphens and underscores only
export const LayoutIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Layout ID must be alphanumeric with hyphens/underscores only");

// Screen ID: alphanumeric with hyphens, underscores, and spaces
export const ScreenIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_\- ]+$/, "Screen ID must be alphanumeric");

// Global state enum
export const GlobalStateSchema = z.enum(["normal", "alert", "active", "damaged"]);

// Element type enum
export const ElementTypeSchema = z.enum(["elbow", "bar", "frame", "button", "text"]);

// Elbow direction
export const ElbowDirectionSchema = z.enum(["TL", "TR", "BL", "BR"]);

// Bar orientation
export const BarOrientationSchema = z.enum(["horizontal", "vertical"]);

// Hex color validation
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (#RRGGBB)");

// Layout element
export const LayoutElementSchema = z.object({
  id: z.string().min(1).max(100),
  type: ElementTypeSchema,
  col: z.number().int().min(0).max(11),
  row: z.number().int().min(0).max(100),
  colSpan: z.number().int().min(1).max(12),
  rowSpan: z.number().int().min(1).max(100),
  color: HexColorSchema,
  direction: ElbowDirectionSchema.optional(),
  orientation: BarOrientationSchema.optional(),
  label: z.string().max(500).optional(),
});

// Full layout
export const LayoutSchema = z.object({
  id: LayoutIdSchema.optional(), // Optional on create, will be generated
  name: z.string().min(1).max(200),
  elements: z.array(LayoutElementSchema).max(500),
});

// Type exports for use in other files
export type ValidatedGlobalState = z.infer<typeof GlobalStateSchema>;
export type ValidatedLayout = z.infer<typeof LayoutSchema>;
export type ValidatedLayoutElement = z.infer<typeof LayoutElementSchema>;

// Validation helper that returns result or throws
export function validateLayoutId(id: unknown): string {
  return LayoutIdSchema.parse(id);
}

export function validateScreenId(id: unknown): string {
  return ScreenIdSchema.parse(id);
}

export function validateGlobalState(state: unknown): ValidatedGlobalState {
  return GlobalStateSchema.parse(state);
}

export function validateLayout(layout: unknown): ValidatedLayout {
  return LayoutSchema.parse(layout);
}
