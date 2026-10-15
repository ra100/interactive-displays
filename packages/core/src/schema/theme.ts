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

// Sounds are synthesised in the browser from a few tones, so a theme ships no audio files and nothing is
// licensed: a beep is a list of steps, each a frequency (optionally sliding to another) for some milliseconds.
export const SoundStepSchema = z.object({
  freq: z.number().min(20).max(8000),
  to: z.number().min(20).max(8000).optional(),
  ms: z.number().int().min(5).max(3000),
  wave: z.enum(["sine", "square", "triangle", "sawtooth"]).default("sine"),
  gain: z.number().min(0).max(1).default(0.2),
});

export const SoundSchema = z.object({
  steps: z.array(SoundStepSchema).min(1).max(16),
  repeat: z.number().int().min(1).max(8).default(1),
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
  // How generated screens use the palette: nav buttons cycle through `nav`, neighbouring panels take turns
  // through `panels`. A monochrome theme can list one tone.
  tones: z
    .object({ nav: z.array(ToneSchema).min(1).max(8), panels: z.array(ToneSchema).min(1).max(8) })
    .default({ nav: ["primary", "secondary", "accent", "info"], panels: ["primary", "info", "accent", "secondary"] }),
  // "press" plays on every control; states and actions name others, such as "alert". Missing ones fall back
  // to the base theme's.
  sounds: z.record(IdSchema, SoundSchema).default({}),
  // Other themes' decor this theme draws with one of its own pieces, so a re-skinned screen keeps its
  // ornament: "lcars.bar" → { kind: "crt.rule", props: { style: "double" } }. The foreign piece's tone carries
  // over when the stand-in has one. Unmapped foreign decor stays hidden.
  decorStandIns: z
    .record(z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/), z.object({ kind: z.string().min(1), props: z.record(z.string(), z.unknown()).default({}) }))
    .default({}),
});

export type ThemeTokens = z.infer<typeof ThemeTokensSchema>;
export type Sound = z.infer<typeof SoundSchema>;
export type SoundStep = z.infer<typeof SoundStepSchema>;
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
  const parsed = ThemeManifestSchema.parse(data);
  for (const [from, standIn] of Object.entries(parsed.decorStandIns)) {
    if (from.startsWith(prefix)) throw new Error(`Decor "${from}" is this theme's own and needs no stand-in`);
    const target = decor.find((definition) => definition.kind === standIn.kind);
    if (!target) throw new Error(`Stand-in for "${from}" names "${standIn.kind}", which is not this theme's decor`);
    if (!target.props.safeParse(standIn.props).success) throw new Error(`Stand-in props for "${from}" do not fit "${standIn.kind}"`);
  }
  return { ...parsed, decor };
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
