import { packs as builtInPacks } from "@interactive-displays/content";
import {
  applyOps,
  type ArchetypeId,
  catalog,
  BlockSchema,
  type ContentOverlay,
  type ContentPack,
  type Density,
  EMPTY_OVERLAY,
  findSection,
  generateScreen,
  generateSuite,
  generationBase,
  mergePack,
  type Profile,
  randomSeed,
  RecipeSchema,
  regenerateScreenOps,
  rerollScreenOps,
  type Op,
  type Screen,
  sectionsOf,
  slugify,
  uniqueId,
  type ValidationIssue,
} from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";
import type { CommandResult, Failure, ShowService } from "./showService.ts";
import { loadContent, saveContent } from "./storage/repository.ts";

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

export interface GenerateRequest {
  // "trek/engineering", or just "engineering".
  section: string;
  id?: string;
  name?: string;
  seed?: number;
  density?: Density;
  aspect?: Profile["aspect"];
  archetype?: ArchetypeId;
  // Also one screen per system, linked by their nav buttons.
  suite?: boolean;
}

export interface RegenerateRequest {
  baseRevision: number;
  seed?: number;
  // Reroll just these panels; without them everything that is not locked is regenerated.
  nodes?: string[];
}

const NO_SHOW: Failure = { ok: false, status: 503, message: "The server has no active show; check its log" };

const issuesOf = (error: z.ZodError): ValidationIssue[] =>
  error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));

// Generation in the command layer: content packs (built in, plus what the show adds), generating screens and
// regenerating them. MCP uses it; the builder generates in the browser from the same packs (GET /api/content).
export const createGeneration = async ({ service, dataDir, log }: { service: ShowService; dataDir: string; log: Log }) => {
  const showId = service.loaded()?.show.id;
  const overlays = showId ? await loadContent(dataDir, showId, log) : new Map<string, ContentOverlay>();

  const packs = (): ContentPack[] =>
    builtInPacks.map((pack) => {
      const overlay = overlays.get(pack.id);
      if (!overlay) return pack;
      const merged = mergePack(pack, overlay);
      if (merged.success) return merged.data;
      log.warn({ pack: pack.id, issues: merged.error.issues }, "Ignoring the show's additions to a content pack");
      return pack;
    });

  const base = () => {
    const loaded = service.loaded();
    if (!loaded) return undefined;
    return generationBase(loaded.show, getThemeManifest(loaded.show.theme.id), [...loaded.screens.keys()]);
  };

  // Saves a recipe or block into the show's additions to a pack, if the pack still holds together with it.
  const saveItem = async <T extends { id: string }>(
    packId: string,
    key: "recipes" | "blocks",
    item: T,
  ): Promise<CommandResult<T>> => {
    const loaded = service.loaded();
    if (!loaded) return NO_SHOW;
    const pack = builtInPacks.find((each) => each.id === packId);
    if (!pack) return { ok: false, status: 404, message: `There is no content pack "${packId}"` };
    const current = overlays.get(packId) ?? EMPTY_OVERLAY;
    const list = current[key] as unknown as T[];
    const next = { ...current, [key]: [...list.filter((each) => each.id !== item.id), item] } as ContentOverlay;
    const merged = mergePack(pack, next);
    if (!merged.success) return { ok: false, status: 422, message: "The pack would not be valid", issues: issuesOf(merged.error) };
    await saveContent(dataDir, loaded.show.id, packId, next);
    overlays.set(packId, next);
    log.info({ pack: packId, [key]: item.id }, "Saved content");
    return { ok: true, value: item };
  };

  return {
    packs,

    saveRecipe: (packId: string, input: unknown) => {
      const recipe = RecipeSchema.safeParse(input);
      if (!recipe.success) return Promise.resolve<Failure>({ ok: false, status: 400, message: "Recipe is not valid", issues: issuesOf(recipe.error) });
      return saveItem(packId, "recipes", recipe.data);
    },

    saveBlock: (packId: string, input: unknown) => {
      const block = BlockSchema.safeParse(input);
      if (!block.success) return Promise.resolve<Failure>({ ok: false, status: 400, message: "Block is not valid", issues: issuesOf(block.error) });
      return saveItem(packId, "blocks", block.data);
    },

    // Creates drafts: one screen, or a suite (the overview first).
    generate: async (request: GenerateRequest): Promise<CommandResult<Screen[]>> => {
      const loaded = service.loaded();
      const inputs = base();
      if (!loaded || !inputs) return NO_SHOW;
      const section = findSection(packs(), request.section);
      if (!section) {
        return { ok: false, status: 404, message: `There is no section "${request.section}"; try ${sectionsOf(packs()).map((each) => each.key).join(", ")}` };
      }
      const taken = new Set(loaded.screens.keys());
      const id = request.id ?? uniqueId(slugify(request.name ?? section.recipe.label), taken);
      if (taken.has(id)) return { ok: false, status: 409, message: `Screen "${id}" already exists` };
      const options = {
        ...inputs,
        pack: section.pack,
        recipe: section.recipe,
        seed: request.seed ?? randomSeed(),
        id,
        density: request.density ?? "normal",
        profile: { aspect: request.aspect ?? "16:9", fit: "fluid" as const, rearrange: true },
        ...(request.name ? { name: request.name } : {}),
        ...(request.archetype ? { archetype: request.archetype } : {}),
      };
      let screens: Screen[];
      try {
        screens = request.suite ? generateSuite({ ...options, takenIds: taken }) : [generateScreen(options)];
      } catch (error) {
        return { ok: false, status: 422, message: error instanceof Error ? error.message : String(error) };
      }
      const created: Screen[] = [];
      for (const screen of screens) {
        const result = await service.createScreen(screen);
        if (!result.ok) return result;
        created.push(result.value);
      }
      return { ok: true, value: created };
    },

    // Applies regenerate or reroll ops with locks respected, so a locked part can never change.
    regenerate: async (screenId: string, request: RegenerateRequest): Promise<CommandResult<Screen>> => {
      const loaded = service.loaded();
      const inputs = base();
      if (!loaded || !inputs) return NO_SHOW;
      const screen = loaded.screens.get(screenId);
      if (!screen) return { ok: false, status: 404, message: `Screen "${screenId}" does not exist` };
      if (screen.revision !== request.baseRevision) {
        return { ok: false, status: 409, message: "The screen changed; fetch it again", revision: screen.revision };
      }
      const seed = request.seed ?? randomSeed();
      let ops: Op[] | undefined;
      if (request.nodes && request.nodes.length > 0) {
        // One panel at a time on a working copy, so later panels' new ids never clash with earlier ones.
        ops = [];
        let working = screen;
        for (const [index, nodeId] of request.nodes.entries()) {
          const more = rerollScreenOps(working, packs(), inputs, nodeId, (seed + index) >>> 0);
          if (!more) return { ok: false, status: 422, message: `"${nodeId}" is not a panel that can be rerolled (a main or aside panel with nothing locked inside)` };
          const applied = applyOps(working, more, { catalog });
          if (!applied.ok) return { ok: false, status: 422, message: "Could not reroll", issues: applied.issues };
          working = applied.screen;
          ops.push(...more);
        }
      } else {
        ops = regenerateScreenOps(screen, packs(), inputs, seed);
      }
      if (!ops) return { ok: false, status: 422, message: `Screen "${screenId}" has no known section; set its section to one of the recipes` };
      return service.applyOps(screenId, request.baseRevision, ops, { respectLocks: true });
    },
  };
};

export type Generation = Awaited<ReturnType<typeof createGeneration>>;
