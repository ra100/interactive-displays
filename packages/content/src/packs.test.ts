import {
  ARCHETYPE_IDS,
  applyOps,
  catalog,
  DENSITIES,
  findNode,
  type GenerateOptions,
  generateScreen,
  generateSuite,
  lintScreen,
  type ContentPack,
  type Node,
  regenerateOps,
  type Screen,
  ShowSchema,
  validateScreen,
  walkNodes,
} from "@interactive-displays/core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import demo from "../../server/seed/shows/demo/show.json" with { type: "json" };
import { findRecipe, packs } from "./index.ts";

// The demo show the server seeds, so generated actions and bindings are checked against real states and signals.
const show = ShowSchema.parse(demo);
const showContext = { states: show.states, signals: show.signals, screens: ["bridge"] };
const theme = {
  archetypes: ARCHETYPE_IDS,
  tones: { nav: ["primary", "secondary", "accent", "info", "neutral"], panels: ["primary", "info", "accent", "secondary", "neutral"] },
} as const;

const optionsIn = (packId: string) => (recipe: string, extra: Partial<GenerateOptions> = {}): GenerateOptions => {
  const found = findRecipe(`${packId}/${recipe}`);
  if (!found) throw new Error(`No recipe ${recipe}`);
  return { ...found, theme: { archetypes: [...theme.archetypes], tones: { nav: [...theme.tones.nav], panels: [...theme.tones.panels] } }, show: showContext, seed: 1, id: "screen", ...extra };
};

const problems = (screen: Screen) =>
  lintScreen(screen, { show, screens: new Set(["bridge", screen.id]) }).filter((issue) => issue.level === "warning");

const arbitraryIn = (pack: ContentPack) =>
  fc.record({
    recipe: fc.constantFrom(...pack.recipes.map((recipe) => recipe.id)),
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    density: fc.constantFrom(...DENSITIES),
    aspect: fc.constantFrom("16:9" as const, "4:3" as const, "9:16" as const, "21:9" as const),
    archetype: fc.constantFrom(undefined, ...ARCHETYPE_IDS),
  });

const widgets = (root: Node) => {
  const found: Node[] = [];
  walkNodes(root, (node) => {
    if (node.type === "widget") found.push(node);
  });
  return found;
};

describe("the packs", () => {
  it("has the starship pack for LCARS and the freighter pack for the terminal", () => {
    expect(packs.map((pack) => [pack.id, pack.theme])).toEqual([
      ["trek", "lcars"],
      ["freighter", "crt"],
    ]);
  });
});

describe.each(packs)("the $id pack", (pack) => {
  const options = optionsIn(pack.id);
  const arbitrary = arbitraryIn(pack);

  it("has at least six sections, each with several systems", () => {
    expect(pack.recipes.length).toBeGreaterThanOrEqual(6);
    for (const recipe of pack.recipes) expect(recipe.systems.length).toBeGreaterThanOrEqual(3);
  });

  it("only links readings to signals the demo show has", () => {
    const signals = new Set(show.signals.map((signal) => signal.id));
    for (const recipe of pack.recipes)
      for (const system of recipe.systems) for (const metric of system.metrics) if (metric.signal) expect(signals).toContain(metric.signal);
  });

  it("generates valid, lint-clean screens for any section, seed, density and shape", () => {
    fc.assert(
      fc.property(arbitrary, ({ recipe, seed, density, aspect, archetype }) => {
        const screen = generateScreen(options(recipe, { seed, density, profile: { aspect, fit: "fluid" }, ...(archetype ? { archetype } : {}) }));
        expect(validateScreen(screen, catalog).ok).toBe(true);
        expect(problems(screen)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it("generates the same screen from the same seed", () => {
    fc.assert(
      fc.property(arbitrary, ({ recipe, seed, density }) => {
        expect(generateScreen(options(recipe, { seed, density }))).toEqual(generateScreen(options(recipe, { seed, density })));
      }),
      { numRuns: 50 },
    );
  });

  it("keeps panels small enough to touch", () => {
    fc.assert(
      fc.property(arbitrary, ({ recipe, seed, density, aspect }) => {
        const screen = generateScreen(options(recipe, { seed, density, profile: { aspect, fit: "fluid" } }));
        walkNodes(screen.root, (node) => {
          if (node.type !== "container" || node.layout.kind !== "stack") return;
          const buttons = node.children.filter((child) => child.node.type === "widget" && child.node.kind === "button");
          expect(buttons.length).toBeLessThanOrEqual(8);
        });
      }),
      { numRuns: 100 },
    );
  });

  it("keeps locked parts through any regeneration", () => {
    fc.assert(
      fc.property(arbitrary, fc.integer({ min: 0, max: 0xffffffff }), fc.nat(), ({ recipe, seed, density }, nextSeed, pick) => {
        const screen = generateScreen(options(recipe, { seed, density }));
        const candidates = widgets(screen.root);
        const target = candidates[pick % candidates.length];
        if (!target) return;
        const locked = applyOps(screen, [{ op: "set", id: target.id, locked: true }], { catalog });
        if (!locked.ok) throw new Error(JSON.stringify(locked.issues));
        const result = applyOps(locked.screen, regenerateOps(locked.screen, { ...options(recipe), seed: nextSeed }), { catalog, respectLocks: true });
        if (!result.ok) throw new Error(JSON.stringify(result.issues));
        expect(findNode(result.screen.root, target.id)?.node).toEqual(findNode(locked.screen.root, target.id)?.node);
        expect(problems(result.screen)).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it("generates a linked suite for every section", () => {
    for (const recipe of pack.recipes) {
      const suite = generateSuite({ ...options(recipe.id), id: recipe.id });
      expect(suite).toHaveLength(recipe.systems.length + 1);
      const screens = new Set(["bridge", ...suite.map((screen) => screen.id)]);
      for (const screen of suite) {
        expect(validateScreen(screen, catalog).ok).toBe(true);
        expect(lintScreen(screen, { show, screens }).filter((issue) => issue.level === "warning")).toEqual([]);
      }
    }
  });
});
