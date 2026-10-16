import { ShowSchema } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { generationBase } from "./generation.ts";

describe("generation in the builder", () => {
  it("draws the theme's layouts and tones and knows the show's states and screens", () => {
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
    expect(base.theme.archetypes).toEqual(["sidebar", "header-main", "dashboard", "split", "console"]);
    expect(base.theme.tones.nav).toContain("primary");
    expect(base.show.states.map((state) => state.id)).toEqual(["normal", "red-alert"]);
    expect(base.show.screens).toEqual(["bridge"]);
  });
});
