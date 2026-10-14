import { describe, expect, it } from "vitest";
import { getThemeManifest, themeManifests } from "./manifest.ts";

describe("theme manifests", () => {
  it("registers the base theme", () => {
    expect(themeManifests.get("base")?.name).toBe("Base");
  });

  it("falls back to base for an unknown theme", () => {
    expect(getThemeManifest("does-not-exist").id).toBe("base");
  });

  it("registers every manifest under its own id", () => {
    for (const [id, manifest] of themeManifests) expect(manifest.id).toBe(id);
  });
});
