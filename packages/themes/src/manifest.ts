import type { AnyDecorDefinition, DecorCatalog, Sound, ThemeManifest } from "@interactive-displays/core";
import { base } from "./base/manifest.ts";
import { crt } from "./crt/manifest.ts";
import { lcars } from "./lcars/manifest.ts";

// Pure data entry point: safe to import from the server, generator and MCP.
export const themeManifests: ReadonlyMap<string, ThemeManifest> = new Map([
  [base.id, base],
  [lcars.id, lcars],
  [crt.id, crt],
]);

export const getThemeManifest = (id: string): ThemeManifest => themeManifests.get(id) ?? base;

// A theme's sound, falling back to the base theme's sound of the same name.
export const getThemeSound = (themeId: string, soundId: string): Sound | undefined => {
  const sounds = getThemeManifest(themeId).sounds;
  return (Object.hasOwn(sounds, soundId) ? sounds[soundId] : undefined) ?? (Object.hasOwn(base.sounds, soundId) ? base.sounds[soundId] : undefined);
};

// Every sound id a theme can play, its own and the base theme's.
export const themeSoundIds = (themeId: string): string[] =>
  [...new Set([...Object.keys(getThemeManifest(themeId).sounds), ...Object.keys(base.sounds)])].sort();

// Every theme's decor, for validating decor props in any screen.
export const decorCatalog: DecorCatalog = new Map(
  [...themeManifests.values()].flatMap((theme) =>
    theme.decor.map((definition): [string, AnyDecorDefinition] => [definition.kind, definition]),
  ),
);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// The decor a theme draws for a node: its own piece as it is, another theme's piece through the stand-in the
// theme names for it (keeping the piece's tone when the stand-in takes one), or nothing.
export const decorFor = (themeId: string, kind: string, props: unknown): { kind: string; props: unknown } | undefined => {
  if (kind.startsWith(`${themeId}.`)) return { kind, props };
  const theme = themeManifests.get(themeId);
  const standIn = theme && Object.hasOwn(theme.decorStandIns, kind) ? theme.decorStandIns[kind] : undefined;
  if (!standIn) return undefined;
  const tone = isRecord(props) ? props["tone"] : undefined;
  const toned = { ...standIn.props, tone };
  return { kind: standIn.kind, props: tone !== undefined && decorCatalog.get(standIn.kind)?.props.safeParse(toned).success ? toned : standIn.props };
};
