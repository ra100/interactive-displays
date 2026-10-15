import { type GenerationBase, generationBase as baseFor, type Show } from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";

// The generator's inputs from the show the builder is editing: its theme's layouts and tones, its states,
// signals and screens.
export const generationBase = (show: Show, screenIds: readonly string[]): GenerationBase =>
  baseFor(show, getThemeManifest(show.theme.id), screenIds);
