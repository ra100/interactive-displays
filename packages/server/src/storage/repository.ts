import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  AssetNameSchema,
  assetContentType,
  assetKind,
  catalog,
  type DecorCatalog,
  IdSchema,
  type Screen,
  type Show,
  ShowSchema,
  validateScreen,
} from "@interactive-displays/core";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { exists, readJson, writeFileAtomic, writeJsonAtomic } from "./files.ts";

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

/*
 * data/
 *   settings.json                                { schemaVersion, activeShow }
 *   shows/<showId>/show.json                     theme, states, displays, settings
 *   shows/<showId>/runtime.json                  current state, displays seen (written by the server)
 *   shows/<showId>/screens/<screenId>.json       the draft
 *   shows/<showId>/screens/.history/<screenId>/<revision>.json
 *   shows/<showId>/screens/.trash/<screenId>-<time>.json
 *   shows/<showId>/published/<screenId>.json     what displays show
 *   shows/<showId>/assets/<name>                 images and video
 */
const SettingsSchema = z.object({
  schemaVersion: z.literal(1),
  activeShow: IdSchema,
});

export const RuntimeSchema = z.object({
  schemaVersion: z.literal(1),
  state: IdSchema.optional(),
  // displayId -> ISO time it last said hello
  seen: z.record(IdSchema, z.string()).default({}),
});

export type Runtime = z.infer<typeof RuntimeSchema>;

export const HISTORY_LIMIT = 50;

export interface LoadedShow {
  show: Show;
  // Drafts, which the editor changes.
  screens: Map<string, Screen>;
  // Published copies, which displays show.
  published: Map<string, Screen>;
  runtime: Runtime;
}

export interface RevisionInfo {
  revision: number;
  savedAt: string;
}

export interface AssetInfo {
  name: string;
  kind: "image" | "video";
  type: string;
  size: number;
  modified: string;
}

const showDir = (dataDir: string, showId: string) => path.join(dataDir, "shows", showId);
const screensDir = (dataDir: string, showId: string) => path.join(showDir(dataDir, showId), "screens");
const publishedDir = (dataDir: string, showId: string) => path.join(showDir(dataDir, showId), "published");
const historyDir = (dataDir: string, showId: string, screenId: string) =>
  path.join(screensDir(dataDir, showId), ".history", screenId);
const trashDir = (dataDir: string, showId: string) => path.join(screensDir(dataDir, showId), ".trash");
export const assetsDir = (dataDir: string, showId: string) => path.join(showDir(dataDir, showId), "assets");

// A fresh data directory gets the demo show. Existing files are never overwritten.
export const ensureSeeded = async (dataDir: string, seedDir: string, log: Log): Promise<boolean> => {
  if (await exists(path.join(dataDir, "settings.json"))) return false;
  await cp(seedDir, dataDir, { recursive: true, force: false, errorOnExist: false });
  log.info({ dataDir }, "Seeded data directory with the demo show");
  return true;
};

// Reads and validates one screen document (upgrading older versions); undefined, with a warning, if unusable.
const readScreen = async (file: string, decor: DecorCatalog, log: Log): Promise<Screen | undefined> => {
  let result: ReturnType<typeof validateScreen>;
  try {
    result = validateScreen(await readJson(file), catalog, decor);
  } catch (error) {
    log.warn({ file, err: error }, "Skipping screen that is not valid JSON");
    return undefined;
  }
  if (!result.ok) {
    log.warn({ file, issues: result.issues }, "Skipping invalid screen");
    return undefined;
  }
  return result.value;
};

const loadScreens = async (dir: string, decor: DecorCatalog, log: Log): Promise<Map<string, Screen>> => {
  const screens = new Map<string, Screen>();
  const files = (await exists(dir)) ? await readdir(dir) : [];

  for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
    const screen = await readScreen(path.join(dir, file), decor, log);
    if (!screen) continue;
    if (`${screen.id}.json` !== file) {
      log.warn({ file, id: screen.id }, "Skipping screen whose id does not match its file name");
      continue;
    }
    screens.set(screen.id, screen);
  }
  return screens;
};

export const readRevision = async (
  dataDir: string,
  showId: string,
  screenId: string,
  revision: number,
  decor: DecorCatalog,
  log: Log,
): Promise<Screen | undefined> => {
  const file = path.join(historyDir(dataDir, showId, screenId), `${revision}.json`);
  return (await exists(file)) ? readScreen(file, decor, log) : undefined;
};

// The copy displays show. When it is missing but the draft says which revision is published (a screen saved
// before drafts existed, or a crash between two writes), it is rebuilt from the draft or the history.
const loadPublished = async (
  dataDir: string,
  showId: string,
  drafts: Map<string, Screen>,
  decor: DecorCatalog,
  log: Log,
): Promise<Map<string, Screen>> => {
  const published = new Map<string, Screen>();
  for (const [id, draft] of drafts) {
    const file = path.join(publishedDir(dataDir, showId), `${id}.json`);
    const saved = (await exists(file)) ? await readScreen(file, decor, log) : undefined;
    if (saved?.id === id) {
      published.set(id, saved);
      continue;
    }
    if (draft.published === undefined) continue;

    const rebuilt =
      draft.revision === draft.published
        ? draft
        : await readRevision(dataDir, showId, id, draft.published, decor, log);
    if (!rebuilt) {
      log.warn({ screen: id, revision: draft.published }, "Published revision is gone; the screen is off air");
      delete draft.published;
      continue;
    }
    const copy = { ...rebuilt, published: draft.published };
    await writeJsonAtomic(file, copy);
    published.set(id, copy);
  }
  return published;
};

const loadRuntime = async (file: string, log: Log): Promise<Runtime> => {
  if (!(await exists(file))) return { schemaVersion: 1, seen: {} };
  try {
    return RuntimeSchema.parse(await readJson(file));
  } catch (error) {
    log.warn({ file, err: error }, "Ignoring unreadable runtime state");
    return { schemaVersion: 1, seen: {} };
  }
};

// Returns null, with the reason logged, when there is no usable active show; displays then show an error.
export const loadActiveShow = async (dataDir: string, decor: DecorCatalog, log: Log): Promise<LoadedShow | null> => {
  try {
    const settings = SettingsSchema.parse(await readJson(path.join(dataDir, "settings.json")));
    const dir = showDir(dataDir, settings.activeShow);
    const show = ShowSchema.parse(await readJson(path.join(dir, "show.json")));

    if (show.id !== settings.activeShow) {
      throw new Error(`show.json id "${show.id}" does not match its folder "${settings.activeShow}"`);
    }

    const screens = await loadScreens(screensDir(dataDir, show.id), decor, log);
    const published = await loadPublished(dataDir, show.id, screens, decor, log);
    const runtime = await loadRuntime(path.join(dir, "runtime.json"), log);
    log.info({ show: show.id, screens: [...screens.keys()] }, "Loaded active show");
    return { show, screens, published, runtime };
  } catch (error) {
    log.error({ err: error, dataDir }, "Could not load the active show");
    return null;
  }
};

export const saveShow = (dataDir: string, show: Show): Promise<void> =>
  writeJsonAtomic(path.join(showDir(dataDir, show.id), "show.json"), show);

export const saveRuntime = (dataDir: string, showId: string, runtime: Runtime): Promise<void> =>
  writeJsonAtomic(path.join(showDir(dataDir, showId), "runtime.json"), runtime);

// Saves the new revision and archives the one it replaces, keeping the last HISTORY_LIMIT revisions.
export const saveScreen = async (dataDir: string, showId: string, screen: Screen, replaced?: Screen) => {
  if (replaced && replaced.revision !== screen.revision) {
    const dir = historyDir(dataDir, showId, replaced.id);
    await writeJsonAtomic(path.join(dir, `${replaced.revision}.json`), replaced);
    const revisions = (await readdir(dir))
      .filter((name) => name.endsWith(".json"))
      .map((name) => Number.parseInt(name, 10))
      .filter(Number.isFinite)
      .sort((a, b) => b - a);
    for (const old of revisions.slice(HISTORY_LIMIT)) await rm(path.join(dir, `${old}.json`), { force: true });
  }
  await writeJsonAtomic(path.join(screensDir(dataDir, showId), `${screen.id}.json`), screen);
};

export const savePublished = (dataDir: string, showId: string, screen: Screen): Promise<void> =>
  writeJsonAtomic(path.join(publishedDir(dataDir, showId), `${screen.id}.json`), screen);

// Deleting moves the draft to the trash and takes the screen off air; its history stays, so nothing is lost.
export const trashScreen = async (dataDir: string, showId: string, screenId: string): Promise<void> => {
  const draft = path.join(screensDir(dataDir, showId), `${screenId}.json`);
  if (await exists(draft)) {
    await mkdir(trashDir(dataDir, showId), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await rename(draft, path.join(trashDir(dataDir, showId), `${screenId}-${stamp}.json`));
  }
  await rm(path.join(publishedDir(dataDir, showId), `${screenId}.json`), { force: true });
};

// Newest first.
export const listRevisions = async (dataDir: string, showId: string, screenId: string): Promise<RevisionInfo[]> => {
  const dir = historyDir(dataDir, showId, screenId);
  if (!(await exists(dir))) return [];
  const revisions = (await readdir(dir))
    .filter((name) => /^\d+\.json$/.test(name))
    .map((name) => Number.parseInt(name, 10))
    .sort((a, b) => b - a);
  return Promise.all(
    revisions.map(async (revision) => ({
      revision,
      savedAt: (await stat(path.join(dir, `${revision}.json`))).mtime.toISOString(),
    })),
  );
};

// Sorted by name. Files with names the server would not accept are ignored.
export const listAssets = async (dataDir: string, showId: string): Promise<AssetInfo[]> => {
  const dir = assetsDir(dataDir, showId);
  if (!(await exists(dir))) return [];
  const names = (await readdir(dir)).filter((name) => AssetNameSchema.safeParse(name).success).sort();
  const assets: AssetInfo[] = [];
  for (const name of names) {
    const info = await stat(path.join(dir, name));
    const type = assetContentType(name);
    const kind = assetKind(name);
    if (!info.isFile() || !type || !kind) continue;
    assets.push({ name, kind, type, size: info.size, modified: info.mtime.toISOString() });
  }
  return assets;
};

// The caller validates `name` with AssetNameSchema, which keeps it inside the assets folder.
export const saveAsset = (dataDir: string, showId: string, name: string, data: Buffer): Promise<void> =>
  writeFileAtomic(path.join(assetsDir(dataDir, showId), name), data);

export const deleteAsset = async (dataDir: string, showId: string, name: string): Promise<boolean> => {
  const file = path.join(assetsDir(dataDir, showId), name);
  if (!(await exists(file))) return false;
  await rm(file);
  return true;
};
