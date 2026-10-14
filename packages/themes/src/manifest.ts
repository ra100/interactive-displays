import type { AnyDecorDefinition, DecorCatalog, ThemeManifest } from "@interactive-displays/core";
import { base } from "./base/manifest.ts";
import { lcars } from "./lcars/manifest.ts";

// Pure data entry point: safe to import from the server, generator and MCP.
export const themeManifests: ReadonlyMap<string, ThemeManifest> = new Map([
  [base.id, base],
  [lcars.id, lcars],
]);

export const getThemeManifest = (id: string): ThemeManifest => themeManifests.get(id) ?? base;

// Every theme's decor, for validating decor props in any screen.
export const decorCatalog: DecorCatalog = new Map(
  [...themeManifests.values()].flatMap((theme) =>
    theme.decor.map((definition): [string, AnyDecorDefinition] => [definition.kind, definition]),
  ),
);
