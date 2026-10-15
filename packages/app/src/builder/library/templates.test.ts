import { catalog, lintScreen, validateScreen } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { describe, expect, it } from "vitest";
import { buildScreen, TEMPLATE_IDS } from "./templates.ts";

describe("new screen templates", () => {
  it.each(TEMPLATE_IDS)("%s is valid and lint-clean", (template) => {
    const screen = buildScreen({ template, id: "warp", name: "Warp core", section: "engineering", aspect: "4:3" });
    expect(validateScreen(screen, catalog, decorCatalog)).toMatchObject({ ok: true });
    expect(lintScreen(screen, { decor: decorCatalog })).toEqual([]);
    expect(screen).toMatchObject({ id: "warp", name: "Warp core", section: "engineering", profile: { aspect: "4:3" } });
  });

  it("titles the screen with its name", () => {
    const screen = buildScreen({ template: "sidebar", id: "warp", name: "Warp core", aspect: "16:9" });
    expect(JSON.stringify(screen.root)).toContain('"text":"WARP CORE"');
    expect(screen.section).toBeUndefined();
  });
});
