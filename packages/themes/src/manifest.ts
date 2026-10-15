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
