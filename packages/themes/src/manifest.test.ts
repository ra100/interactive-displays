import { resolveTokens } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { decorCatalog, getThemeManifest, themeManifests } from "./manifest.ts";

describe("theme manifests", () => {
  it("registers the base and LCARS themes", () => {
    expect(themeManifests.get("base")?.name).toBe("Base");
    expect(themeManifests.get("lcars")?.name).toBe("LCARS");
  });

  it("falls back to base for an unknown theme", () => {
    expect(getThemeManifest("does-not-exist").id).toBe("base");
  });

  it("registers every manifest under its own id", () => {
    for (const [id, manifest] of themeManifests) expect(manifest.id).toBe(id);
  });

  it("collects every theme's decor, each prefixed with its theme id", () => {
    expect([...decorCatalog.keys()]).toEqual(["lcars.elbow", "lcars.bar", "lcars.cap", "lcars.bracket"]);
  });

  it("gives every decor an example that passes its own schema", () => {
    for (const definition of decorCatalog.values()) {
      expect(definition.props.safeParse(definition.example).success).toBe(true);
    }
  });
});

describe("LCARS tokens", () => {
  const lcars = getThemeManifest("lcars");

  it("layers the variant under the state effect", () => {
    const nemesis = resolveTokens(lcars, "nemesis");
    expect(nemesis.palette.primary).toBe("#5c8fd6");
    expect(nemesis.palette.danger).toBe(lcars.tokens.palette.danger);

    const nemesisAlert = resolveTokens(lcars, "nemesis", "alert");
    expect(nemesisAlert.palette.primary).toBe("#ff3333");
  });

  it("ignores an unknown variant", () => {
    expect(resolveTokens(lcars, "mirror-universe")).toEqual(lcars.tokens);
  });

  it("leaves tokens alone for effects the theme does not restyle", () => {
    expect(resolveTokens(lcars, undefined, "blackout")).toEqual(lcars.tokens);
  });
});
