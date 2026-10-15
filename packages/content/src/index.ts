import { type ContentPack, ContentPackSchema, type Recipe } from "@interactive-displays/core";
import { trek } from "./trek/pack.ts";

// Every content pack, checked against the schema once when this module loads.
export const packs: readonly ContentPack[] = [ContentPackSchema.parse(trek)];

// "trek/engineering" → the pack and the recipe, or undefined.
export const findRecipe = (key: string): { pack: ContentPack; recipe: Recipe } | undefined => {
  const [packId, recipeId] = key.split("/");
  const pack = packs.find((each) => each.id === packId);
  const recipe = pack?.recipes.find((each) => each.id === recipeId);
  return pack && recipe ? { pack, recipe } : undefined;
};
