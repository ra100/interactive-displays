import { describe, expect, it } from "vitest";
import { AssetNameSchema, assetContentType, assetKind, assetUrl, toAssetName } from "./asset.ts";

describe("AssetNameSchema", () => {
  it.each(["warp-core.png", "schematic.svg", "intro_v2.mp4", "deck.12.webp", "a.jpg"])("accepts %s", (name) => {
    expect(AssetNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(["../show.json", "x.exe", "Upper.png", ".hidden.png", "no-extension", "a/b.png", "x.html", "x..png"])(
    "rejects %s",
    (name) => {
      expect(AssetNameSchema.safeParse(name).success).toBe(false);
    },
  );
});

describe("asset helpers", () => {
  it("knows content types and kinds", () => {
    expect(assetContentType("a.svg")).toBe("image/svg+xml");
    expect(assetContentType("a.jpeg")).toBe("image/jpeg");
    expect(assetContentType("a.txt")).toBeUndefined();
    expect(assetKind("a.webm")).toBe("video");
    expect(assetKind("a.png")).toBe("image");
    expect(assetKind("a.txt")).toBeUndefined();
  });

  it("turns file names into asset names", () => {
    expect(toAssetName("Warp Core (v2).PNG")).toBe("warp-core-v2.png");
    expect(toAssetName("___.svg")).toBe("asset.svg");
    expect(toAssetName("notes.txt")).toBeUndefined();
    expect(toAssetName("noextension")).toBeUndefined();
  });

  it("builds media URLs", () => {
    expect(assetUrl("warp-core.png")).toBe("/media/warp-core.png");
  });
});
