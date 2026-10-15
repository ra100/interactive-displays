import { packs } from "@interactive-displays/content";
import { sectionsOf } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { packGroups } from "./GenerateDialog.tsx";

describe("packGroups", () => {
  const sections = sectionsOf(packs);

  it("lists the packs written for the show's theme first", () => {
    expect(packGroups(sections, "crt").map((group) => group.name)).toEqual(["Deep-space freighter", "Starship"]);
    expect(packGroups(sections, "lcars").map((group) => group.name)).toEqual(["Starship", "Deep-space freighter"]);
  });

  it("keeps every section, in pack order", () => {
    const groups = packGroups(sections, "base");
    expect(groups.flatMap((group) => group.sections)).toEqual(sections);
  });
});
