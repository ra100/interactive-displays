import { z } from "zod";
import type { AnyDecorDefinition } from "../catalog/defineDecor.ts";
import { ARCHETYPE_IDS, type ArchetypeId } from "./archetypes.ts";
import { IdSchema } from "./ids.ts";
import { type Effect, EffectSchema } from "./show.ts";
import { TONES, ToneSchema } from "./tone.ts";

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be #rrggbb");

const FontSchema = z.object({
  display: z.string().min(1),
  body: z.string().min(1),
});

const RadiusSchema = z.enum(["none", "small", "pill"]);

export const ThemeTokensSchema = z.object({
  // Every tone must have a colour, so any screen renders in any theme.
  palette: z.record(ToneSchema, HexColorSchema),
  background: HexColorSchema,
  foreground: HexColorSchema,
  font: FontSchema,
  radius: RadiusSchema,
});

// Overlays for variants and state effects: change only what differs.
export const ThemeTokenOverridesSchema = z.object({
  palette: z.partialRecord(ToneSchema, HexColorSchema).optional(),
  background: HexColorSchema.optional(),
  foreground: HexColorSchema.optional(),
  font: FontSchema.partial().optional(),
  radius: RadiusSchema.optional(),
});

// The data half of a theme pack. Server, generator and MCP read this; renderers live in the app.
export const ThemeManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(200).default(""),
  tokens: ThemeTokensSchema,
  variants: z
    .record(IdSchema, z.object({ name: z.string().min(1).max(60), tokens: ThemeTokenOverridesSchema }))
    .default({}),
  effects: z.partialRecord(EffectSchema, z.object({ tokens: ThemeTokenOverridesSchema })).default({}),
  // Archetypes this theme draws its own chrome for; others use the base frames.
  archetypes: z.array(z.enum(ARCHETYPE_IDS as [ArchetypeId, ...ArchetypeId[]])).default([]),
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type ThemeTokenOverrides = z.infer<typeof ThemeTokenOverridesSchema>;

export type ThemeManifest = z.infer<typeof ThemeManifestSchema> & {
  // Zod schemas, so not part of the JSON-serialisable manifest data.
  decor: readonly AnyDecorDefinition[];
};

export const defineTheme = (
  manifest: z.input<typeof ThemeManifestSchema> & { decor?: readonly AnyDecorDefinition[] },
): ThemeManifest => {
  const { decor = [], ...data } = manifest;
  const prefix = `${data.id}.`;
  const foreign = decor.find((definition) => !definition.kind.startsWith(prefix));
  if (foreign) throw new Error(`Decor "${foreign.kind}" must be named "${prefix}<name>"`);
  return { ...ThemeManifestSchema.parse(data), decor };
};

export const applyTokenOverrides = (tokens: ThemeTokens, overrides: ThemeTokenOverrides | undefined): ThemeTokens =>
  overrides
    ? {
        palette: { ...tokens.palette, ...overrides.palette },
        background: overrides.background ?? tokens.background,
        foreground: overrides.foreground ?? tokens.foreground,
        font: {
          display: overrides.font?.display ?? tokens.font.display,
          body: overrides.font?.body ?? tokens.font.body,
        },
        radius: overrides.radius ?? tokens.radius,
      }
    : tokens;

// Base tokens, then the show's variant, then the current state's effect.
export const resolveTokens = (theme: ThemeManifest, variant?: string, effect: Effect = "none"): ThemeTokens => {
  const withVariant = applyTokenOverrides(theme.tokens, variant ? theme.variants[variant]?.tokens : undefined);
  return applyTokenOverrides(withVariant, theme.effects[effect]?.tokens);
};

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
