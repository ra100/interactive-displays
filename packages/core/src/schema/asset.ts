import { z } from "zod";

// Files in a show's assets folder: images and video the crew uploads. Names end up in file paths and URLs,
// so they are lowercase and path-safe, with an extension the server knows how to serve.
export const ASSET_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
} as const;

export type AssetExtension = keyof typeof ASSET_TYPES;

const extensions = Object.keys(ASSET_TYPES).join("|");

export const AssetNameSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(
    new RegExp(`^[a-z0-9][a-z0-9_-]*(\\.[a-z0-9_-]+)*\\.(${extensions})$`),
    "Asset names are lowercase letters, digits, '-', '_' or '.', ending in a known file type",
  );

export type AssetName = z.infer<typeof AssetNameSchema>;

const extensionOf = (name: string): string => name.slice(name.lastIndexOf(".") + 1);

export const assetContentType = (name: string): string | undefined =>
  Object.hasOwn(ASSET_TYPES, extensionOf(name)) ? ASSET_TYPES[extensionOf(name) as AssetExtension] : undefined;

export const assetKind = (name: string): "image" | "video" | undefined => {
  const type = assetContentType(name);
  if (!type) return undefined;
  return type.startsWith("video/") ? "video" : "image";
};

// Turns an uploaded file name into a valid asset name: "Warp Core (v2).PNG" → "warp-core-v2.png".
export const toAssetName = (fileName: string): string | undefined => {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return undefined;
  const extension = fileName.slice(dot + 1).toLowerCase();
  const stem = fileName
    .slice(0, dot)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 80);
  const name = `${stem || "asset"}.${extension}`;
  return AssetNameSchema.safeParse(name).success ? name : undefined;
};

// Where the server serves a show asset.
export const assetUrl = (name: string): string => `/media/${encodeURIComponent(name)}`;
