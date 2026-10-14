import { z } from "zod";
import { IdSchema } from "./ids.ts";
import { TONES, ToneSchema } from "./tone.ts";

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be #rrggbb");

export const ThemeTokensSchema = z.object({
  // Every tone must have a colour, so any screen renders in any theme.
  palette: z.record(ToneSchema, HexColorSchema),
  background: HexColorSchema,
  foreground: HexColorSchema,
  font: z.object({
    display: z.string().min(1),
    body: z.string().min(1),
  }),
  radius: z.enum(["none", "small", "pill"]),
});

// The data half of a theme pack. Server, generator and MCP read this; renderers live in the app.
export const ThemeManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60),
  tokens: ThemeTokensSchema,
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type ThemeManifest = z.infer<typeof ThemeManifestSchema>;

export const defineTheme = (manifest: z.input<typeof ThemeManifestSchema>): ThemeManifest =>
  ThemeManifestSchema.parse(manifest);

const RADIUS: Record<ThemeTokens["radius"], string> = {
  none: "0",
  small: "0.375em",
  pill: "999px",
};

// Tokens become CSS custom properties on the screen root; renderers only read the variables.
export const themeCssVariables = (tokens: ThemeTokens): Record<string, string> => ({
  ...Object.fromEntries(TONES.map((tone) => [`--tone-${tone}`, tokens.palette[tone]])),
  "--theme-bg": tokens.background,
  "--theme-fg": tokens.foreground,
  "--font-display": tokens.font.display,
  "--font-body": tokens.font.body,
  "--radius": RADIUS[tokens.radius],
});
