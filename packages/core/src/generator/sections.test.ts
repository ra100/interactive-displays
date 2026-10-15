import { describe, expect, it } from "vitest";
import { ContentPackSchema, mergePack } from "../schema/content.ts";
import { ShowSchema } from "../schema/show.ts";
import { walkNodes } from "../tree/tree.ts";
import { generateScreen } from "./generate.ts";
import { canReroll, findSection, generationBase, regenerateScreenOps, rerollScreenOps, sectionOfScreen } from "./sections.ts";

const pack = ContentPackSchema.parse({
  id: "test",
  name: "Test",
  vocab: { codeFormats: ["##-##"], statuses: ["OK"], alertStatuses: ["BAD"], phrases: ["{system} {word}"], words: ["plasma"], logColumns: ["A", "B"] },
  blocks: [
    {
      id: "panel",
      label: "Panel",
      fits: ["main", "aside"],
      size: "medium",
      layout: { part: "stack", direction: "column", children: [{ part: "heading" }, { part: "metric", show: ["gauge", "readout"] }] },
    },
  ],
  recipes: [
    {
      id: "engineering",
      label: "Engineering",
      code: "ENG",
      archetypes: { sidebar: 1 },
      titles: ["ENGINEERING"],
      nav: ["A", "B", "C"],
      status: ["OK"],
      systems: [
        { id: "warp", label: "WARP", metrics: [{ id: "out", label: "OUT", range: [1, 2] }] },
        { id: "eps", label: "EPS", metrics: [{ id: "load", label: "LOAD", range: [1, 2] }] },
      ],
    },
  ],
});

const show = ShowSchema.parse({ schemaVersion: 1, id: "s", name: "S", theme: { id: "base" } });
const base = generationBase(show, { archetypes: ["sidebar"], tones: { nav: ["primary"], panels: ["primary", "info"] } }, ["bridge"]);
const section = findSection([pack], "test/engineering");
if (!section) throw new Error("no section");
const screen = generateScreen({ ...base, pack: section.pack, recipe: section.recipe, seed: 1, id: "eng" });

describe("sections", () => {
  it("finds a section by key or recipe id, and a screen's section", () => {
    expect(findSection([pack], "engineering")?.key).toBe("test/engineering");
    expect(findSection([pack], "test/nope")).toBeUndefined();
    expect(sectionOfScreen([pack], screen)?.key).toBe("test/engineering");
    const { generator: _made, section: _section, ...plain } = screen;
    expect(sectionOfScreen([pack], { ...plain, section: "engineering" })?.key).toBe("test/engineering");
    expect(sectionOfScreen([pack], plain)).toBeUndefined();
  });

  it("regenerates with a new seed and rerolls only panels", () => {
    expect(regenerateScreenOps(screen, [pack], base, 9)?.at(-1)).toEqual({ op: "meta", generator: { recipe: "test/engineering", seed: 9, density: "normal" } });
    const panels: string[] = [];
    walkNodes(screen.root, (node, ancestors) => {
      if (node.type === "container" && ancestors.length === 2) panels.push(node.id);
    });
    const [panel] = panels;
    if (!panel) throw new Error("no panel");
    expect(canReroll(screen, [pack], panel)).toBe(true);
    expect(rerollScreenOps(screen, [pack], base, panel, 3)?.[0]).toMatchObject({ op: "replace", id: panel });
    expect(rerollScreenOps(screen, [pack], base, "root", 3)).toBeUndefined();
    expect(rerollScreenOps(screen, [pack], base, "missing", 3)).toBeUndefined();
  });

  it("merges a show's recipes and blocks into a pack, replacing ones with the same id", () => {
    const recipe = { ...section.recipe, label: "Main engineering" };
    const merged = mergePack(pack, { recipes: [recipe, { ...recipe, id: "cargo", label: "Cargo" }], blocks: [] });
    expect(merged.success && merged.data.recipes.map((each) => each.label)).toEqual(["Main engineering", "Cargo"]);
    const broken = mergePack(pack, { recipes: [{ ...recipe, blocks: { prefer: ["nope"], avoid: [] } }], blocks: [] });
    expect(broken.success).toBe(false);
  });
});
