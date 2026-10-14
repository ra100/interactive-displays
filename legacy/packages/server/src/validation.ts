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
export const ElementTypeSchema = z.enum(["elbow", "bar", "frame", "button", "text", "video"]);

// Elbow direction
export const ElbowDirectionSchema = z.enum(["TL", "TR", "BL", "BR"]);

// Bar orientation
export const BarOrientationSchema = z.enum(["horizontal", "vertical"]);

// Video fit
export const VideoFitSchema = z.enum(["contain", "cover", "fill"]);

// Corner style (for buttons)
export const CornerStyleSchema = z.enum(["round", "square"]);

// Video URL validation - only allow safe protocols (defined early for LayoutElementSchema)
export const VideoUrlSchema = z
  .string()
  .max(2048)
  .refine(
    (url) => {
      if (!url) return true; // Empty is valid (shows placeholder)
      try {
        const parsed = new URL(url);
        return ["http:", "https:", "blob:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    "Video URL must use http, https, or blob protocol"
  );

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
  // Elbow props
  direction: ElbowDirectionSchema.optional(),
  verticalWidth: z.number().int().min(1).max(12).optional(),
  horizontalWidth: z.number().int().min(1).max(12).optional(),
  // Bar props
  orientation: BarOrientationSchema.optional(),
  // Button/Text props
  label: z.string().max(500).optional(),
  leftCorner: CornerStyleSchema.optional(),
  rightCorner: CornerStyleSchema.optional(),
  // Video props
  src: VideoUrlSchema.optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  fit: VideoFitSchema.optional(),
});

// Full layout
export const LayoutSchema = z.object({
  id: LayoutIdSchema.optional(), // Optional on create, will be generated
  name: z.string().min(1).max(200),
  elements: z.array(LayoutElementSchema).max(500),
});

// Video command types
export const VideoCommandTypeSchema = z.enum(["play", "pause", "seek", "load"]);

// Video command validation
export const VideoCommandSchema = z.object({
  elementId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Element ID must be alphanumeric with hyphens/underscores"),
  command: VideoCommandTypeSchema,
  time: z.number().min(0).optional(),
  src: VideoUrlSchema.optional(),
});

// Video state validation
export const VideoStateSchema = z.enum(["playing", "paused", "ended"]);

export const VideoStateUpdateSchema = z.object({
  elementId: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, "Element ID must be alphanumeric with hyphens/underscores"),
  state: VideoStateSchema,
  currentTime: z.number().min(0),
});

// Type exports for use in other files
export type ValidatedGlobalState = z.infer<typeof GlobalStateSchema>;
export type ValidatedLayout = z.infer<typeof LayoutSchema>;
export type ValidatedLayoutElement = z.infer<typeof LayoutElementSchema>;
export type ValidatedVideoCommand = z.infer<typeof VideoCommandSchema>;
export type ValidatedVideoStateUpdate = z.infer<typeof VideoStateUpdateSchema>;

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

export function validateVideoCommand(command: unknown): ValidatedVideoCommand {
  return VideoCommandSchema.parse(command);
}

export function validateVideoStateUpdate(state: unknown): ValidatedVideoStateUpdate {
  return VideoStateUpdateSchema.parse(state);
}
