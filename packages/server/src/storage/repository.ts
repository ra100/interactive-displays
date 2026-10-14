import { readdir, readFile, access, cp } from "node:fs/promises";
import path from "node:path";
import { catalog, IdSchema, type Screen, type Show, ShowSchema, validateScreen } from "@interactive-displays/core";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

/*
 * data/
 *   settings.json                 { schemaVersion, activeShow }
 *   shows/<showId>/show.json
 *   shows/<showId>/screens/<screenId>.json
 */
const SettingsSchema = z.object({
  schemaVersion: z.literal(1),
  activeShow: IdSchema,
});

export interface LoadedShow {
  show: Show;
  screens: ReadonlyMap<string, Screen>;
}

const exists = async (file: string): Promise<boolean> =>
  access(file).then(
    () => true,
    () => false,
  );

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"));

// A fresh data directory gets the demo show. Existing files are never overwritten.
export const ensureSeeded = async (dataDir: string, seedDir: string, log: Log): Promise<boolean> => {
  if (await exists(path.join(dataDir, "settings.json"))) return false;
  await cp(seedDir, dataDir, { recursive: true, force: false, errorOnExist: false });
  log.info({ dataDir }, "Seeded data directory with the demo show");
  return true;
};

const loadScreens = async (screensDir: string, log: Log): Promise<Map<string, Screen>> => {
  const screens = new Map<string, Screen>();
  const files = (await exists(screensDir)) ? await readdir(screensDir) : [];

  for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
    const fullPath = path.join(screensDir, file);
    let result: ReturnType<typeof validateScreen>;
    try {
      result = validateScreen(await readJson(fullPath), catalog);
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

// Returns null, with the reason logged, when there is no usable active show; displays then show an error.
export const loadActiveShow = async (dataDir: string, log: Log): Promise<LoadedShow | null> => {
  try {
    const settings = SettingsSchema.parse(await readJson(path.join(dataDir, "settings.json")));
    const showDir = path.join(dataDir, "shows", settings.activeShow);
    const show = ShowSchema.parse(await readJson(path.join(showDir, "show.json")));

    if (show.id !== settings.activeShow) {
      throw new Error(`show.json id "${show.id}" does not match its folder "${settings.activeShow}"`);
    }

    const screens = await loadScreens(path.join(showDir, "screens"), log);
    log.info({ show: show.id, screens: [...screens.keys()] }, "Loaded active show");
    return { show, screens };
  } catch (error) {
    log.error({ err: error, dataDir }, "Could not load the active show");
    return null;
  }
};
