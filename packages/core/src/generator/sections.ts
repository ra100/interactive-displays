import type { Op } from "../ops/ops.ts";
import type { ContentPack, Recipe } from "../schema/content.ts";
import type { Screen } from "../schema/screen.ts";
import type { Show } from "../schema/show.ts";
import type { ThemeManifest } from "../schema/theme.ts";
import { findNode } from "../tree/tree.ts";
import { type GenerateOptions, regenerateOps, rerollable, rerollOps, type SuiteLink } from "./generate.ts";

// The generator's inputs that come from the show rather than the request: the theme's layouts and tones, the
// show's states, signals and screens, so generated buttons and live values only use what exists. The builder, the
// server and MCP all start here.
export type GenerationBase = Pick<GenerateOptions, "theme" | "show">;

export const generationBase = (show: Show, theme: Pick<ThemeManifest, "archetypes" | "tones">, screenIds: readonly string[]): GenerationBase => ({
  theme: { archetypes: theme.archetypes, tones: theme.tones },
  show: { states: show.states, signals: show.signals, screens: [...screenIds] },
});

export interface Section {
  // "pack/recipe", such as "trek/engineering".
  key: string;
  pack: ContentPack;
  recipe: Recipe;
}

export const sectionsOf = (packs: readonly ContentPack[]): Section[] =>
  packs.flatMap((pack) => pack.recipes.map((recipe) => ({ key: `${pack.id}/${recipe.id}`, pack, recipe })));

// A section by its key, or by its recipe id alone when that is unambiguous enough ("engineering").
export const findSection = (packs: readonly ContentPack[], key: string): Section | undefined => {
  const sections = sectionsOf(packs);
  return sections.find((each) => each.key === key) ?? sections.find((each) => each.recipe.id === key);
};

// The section a screen was generated from, or the one its section is named after.
export const sectionOfScreen = (packs: readonly ContentPack[], screen: Screen): Section | undefined => {
  const key = screen.generator?.recipe;
  const made = key ? sectionsOf(packs).find((each) => each.key === key) : undefined;
  return made ?? (screen.section ? sectionsOf(packs).find((each) => each.recipe.id === screen.section) : undefined);
};

// A screen of a suite keeps its nav wired to the suite's other screens when it is regenerated.
const suiteLinkFor = (screen: Screen, section: Section, base: GenerationBase): SuiteLink | undefined => {
  const suite = screen.generator?.suite;
  if (!suite) return undefined;
  const screens: Record<string, string> = { [suite]: suite };
  for (const system of section.recipe.systems) {
    const id = `${suite}-${system.id}`;
    if (base.show.screens?.includes(id)) screens[system.id] = id;
  }
  return { suite, screens, ...(screen.generator?.system ? { system: screen.generator.system } : {}) };
};

// Ops that give everything that is not locked new content with a new seed, keeping the layout. Undefined when the
// screen has no known section.
export const regenerateScreenOps = (screen: Screen, packs: readonly ContentPack[], base: GenerationBase, seed: number): Op[] | undefined => {
  const section = sectionOfScreen(packs, screen);
  if (!section) return undefined;
  const suite = suiteLinkFor(screen, section, base);
  return regenerateOps(screen, { ...base, pack: section.pack, recipe: section.recipe, seed, ...(suite ? { suite } : {}) });
};

export const canReroll = (screen: Screen, packs: readonly ContentPack[], nodeId: string): boolean =>
  Boolean(sectionOfScreen(packs, screen)) && rerollable(screen, nodeId);

// Ops that swap one panel for a fresh one in the same place. Undefined when that node is not a panel that can be
// rerolled (unknown section, not a panel, or something locked inside).
export const rerollScreenOps = (
  screen: Screen,
  packs: readonly ContentPack[],
  base: GenerationBase,
  nodeId: string,
  seed: number,
): Op[] | undefined => {
  const section = sectionOfScreen(packs, screen);
  if (!section || !findNode(screen.root, nodeId)) return undefined;
  const ops = rerollOps(screen, nodeId, { ...base, pack: section.pack, recipe: section.recipe, seed, density: screen.generator?.density ?? "normal" });
  return ops.length > 0 ? ops : undefined;
};
