import { findRecipe, packs } from "@interactive-displays/content";
import {
  type ContentPack,
  type GenerateOptions,
  type Recipe,
  regenerateOps,
  rerollable,
  rerollOps,
  type Screen,
  type Show,
} from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";

// What the builder hands the generator about the show: the theme's layouts and tones, the show's states,
// signals and screens, so generated buttons and live values only use what exists.
export type GenerationBase = Pick<GenerateOptions, "theme" | "show">;

export const generationBase = (show: Show, screenIds: readonly string[]): GenerationBase => {
  const theme = getThemeManifest(show.theme.id);
  return {
    theme: { archetypes: theme.archetypes, tones: theme.tones },
    show: { states: show.states, signals: show.signals, screens: [...screenIds] },
  };
};

export interface Section {
  key: string;
  pack: ContentPack;
  recipe: Recipe;
}

// Every section of every content pack, as "pack/recipe" keys.
export const sections: readonly Section[] = packs.flatMap((pack) =>
  pack.recipes.map((recipe) => ({ key: `${pack.id}/${recipe.id}`, pack, recipe })),
);

// The recipe a screen was generated from, or the one its section is named after.
export const sectionOf = (screen: Screen): Section | undefined => {
  const key = screen.generator?.recipe;
  const found = key ? findRecipe(key) : undefined;
  if (found && key) return { key, ...found };
  return sections.find((each) => each.recipe.id === screen.section);
};

// Ops that regenerate everything that is not locked, with a fresh seed.
export const regenerate = (screen: Screen, base: GenerationBase, seed: number) => {
  const section = sectionOf(screen);
  if (!section) return undefined;
  return regenerateOps(screen, {
    ...base,
    pack: section.pack,
    recipe: section.recipe,
    seed,
    ...(screen.generator?.suite ? { suite: suiteLink(screen, base) } : {}),
  });
};

// A screen of a suite keeps its nav wired to the suite's other screens when it is regenerated.
const suiteLink = (screen: Screen, base: GenerationBase) => {
  const suite = screen.generator?.suite ?? screen.id;
  const section = sectionOf(screen);
  const screens: Record<string, string> = { [suite]: suite };
  for (const system of section?.recipe.systems ?? []) {
    const id = `${suite}-${system.id}`;
    if (base.show.screens?.includes(id)) screens[system.id] = id;
  }
  return { suite, screens, ...(screen.generator?.system ? { system: screen.generator.system } : {}) };
};

export const canReroll = (screen: Screen, nodeId: string): boolean => Boolean(sectionOf(screen)) && rerollable(screen, nodeId);

// Ops that swap one panel for a fresh one in the same place.
export const reroll = (screen: Screen, nodeId: string, base: GenerationBase, seed: number) => {
  const section = sectionOf(screen);
  if (!section) return undefined;
  const ops = rerollOps(screen, nodeId, { ...base, pack: section.pack, recipe: section.recipe, seed, density: screen.generator?.density ?? "normal" });
  return ops.length > 0 ? ops : undefined;
};
