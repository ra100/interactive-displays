import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
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
import { exists, readJson, writeJsonAtomic } from "./files.ts";

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

/*
 * data/
 *   settings.json                                { schemaVersion, activeShow }
 *   shows/<showId>/show.json                     theme, states, displays
 *   shows/<showId>/runtime.json                  current state, displays seen (written by the server)
 *   shows/<showId>/screens/<screenId>.json
 *   shows/<showId>/screens/.history/<screenId>/<revision>.json
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
  screens: Map<string, Screen>;
  runtime: Runtime;
}

const showDir = (dataDir: string, showId: string) => path.join(dataDir, "shows", showId);
const screensDir = (dataDir: string, showId: string) => path.join(showDir(dataDir, showId), "screens");
const historyDir = (dataDir: string, showId: string, screenId: string) =>
  path.join(screensDir(dataDir, showId), ".history", screenId);

// A fresh data directory gets the demo show. Existing files are never overwritten.
export const ensureSeeded = async (dataDir: string, seedDir: string, log: Log): Promise<boolean> => {
  if (await exists(path.join(dataDir, "settings.json"))) return false;
  await cp(seedDir, dataDir, { recursive: true, force: false, errorOnExist: false });
  log.info({ dataDir }, "Seeded data directory with the demo show");
  return true;
};

const loadScreens = async (dir: string, decor: DecorCatalog, log: Log): Promise<Map<string, Screen>> => {
  const screens = new Map<string, Screen>();
  const files = (await exists(dir)) ? await readdir(dir) : [];

  for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
    const fullPath = path.join(dir, file);
    let result: ReturnType<typeof validateScreen>;
    try {
      result = validateScreen(await readJson(fullPath), catalog, decor);
    } catch (error) {
      log.warn({ file: fullPath, err: error }, "Skipping screen that is not valid JSON");
      continue;
    }

    if (!result.ok) {
      log.warn({ file: fullPath, issues: result.issues }, "Skipping invalid screen");
      continue;
    }
    if (`${result.value.id}.json` !== file) {
      log.warn({ file: fullPath, id: result.value.id }, "Skipping screen whose id does not match its file name");
      continue;
    }
    screens.set(result.value.id, result.value);
  }
  return screens;
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
    const runtime = await loadRuntime(path.join(dir, "runtime.json"), log);
    log.info({ show: show.id, screens: [...screens.keys()] }, "Loaded active show");
    return { show, screens, runtime };
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
  if (replaced) {
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

export const listRevisions = async (dataDir: string, showId: string, screenId: string): Promise<number[]> => {
  const dir = historyDir(dataDir, showId, screenId);
  if (!(await exists(dir))) return [];
  return (await readdir(dir))
    .map((name) => Number.parseInt(name, 10))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
};
