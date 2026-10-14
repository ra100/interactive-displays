import type { ThemeManifest } from "@interactive-displays/core";
import { base } from "./base/manifest.ts";

// Pure data entry point: safe to import from the server, generator and MCP.
export const themeManifests: ReadonlyMap<string, ThemeManifest> = new Map([[base.id, base]]);

export const getThemeManifest = (id: string): ThemeManifest => themeManifests.get(id) ?? base;
