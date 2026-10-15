import { generateScreen, ShowSchema, walkNodes } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { canReroll, generationBase, regenerate, reroll, sectionOf, sections } from "./generation.ts";

const show = ShowSchema.parse({
  schemaVersion: 1,
  id: "demo",
  name: "Demo",
  theme: { id: "lcars" },
  states: [
    { id: "normal", label: "Normal" },
    { id: "red-alert", label: "Red alert", effect: "alert" },
  ],
});

const base = generationBase(show, ["bridge"]);
const section = sections.find((each) => each.key === "trek/science");
if (!section) throw new Error("no science section");

const sample = () =>
  generateScreen({ ...base, pack: section.pack, recipe: section.recipe, seed: 3, id: "science", archetype: "header-main" });

describe("generation in the builder", () => {
  it("draws the theme's layouts and tones and knows the show's states", () => {
    expect(base.theme.archetypes).toEqual(["sidebar", "header-main", "dashboard"]);
    expect(base.theme.tones.nav).toContain("primary");
    expect(base.show.states.map((state) => state.id)).toEqual(["normal", "red-alert"]);
  });

  it("finds a screen's section from how it was made, or from its section name", () => {
    expect(sectionOf(sample())?.key).toBe("trek/science");
    const { generator: _made, ...plain } = { ...sample(), section: "medical" };
    expect(sectionOf(plain)?.key).toBe("trek/medical");
    expect(sectionOf({ ...plain, section: "lounge" })).toBeUndefined();
  });

  it("regenerates with a new seed", () => {
    const ops = regenerate(sample(), base, 99);
    expect(ops?.at(-1)).toEqual({ op: "meta", generator: { recipe: "trek/science", seed: 99, density: "normal" } });
  });

  it("rerolls a panel but not the grid that holds it", () => {
    const screen = sample();
    const panels: string[] = [];
    walkNodes(screen.root, (node, ancestors) => {
      if (node.type === "container" && ancestors.length === 2) panels.push(node.id);
    });
    const [panel] = panels;
    if (!panel) throw new Error("no panel");
    expect(canReroll(screen, panel)).toBe(true);
    expect(canReroll(screen, "root")).toBe(false);
    expect(reroll(screen, panel, base, 5)?.[0]).toMatchObject({ op: "replace", id: panel, node: { id: panel } });
  });
});
