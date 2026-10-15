import {
  applyOps,
  catalog,
  type DecorCatalog,
  type DisplayDef,
  findState,
  lintScreen,
  type LintIssue,
  type Op,
  OpListSchema,
  resolveScreenId,
  type Screen,
  type ShowSettings,
  slugify,
  uniqueId,
  validateScreen,
  type ValidationIssue,
  type AssetInfo,
  type RevisionInfo,
} from "@interactive-displays/core";
import type { FastifyBaseLogger } from "fastify";
import {
  deleteAsset,
  listAssets,
  listRevisions,
  type LoadedShow,
  readRevision,
  saveAsset,
  savePublished,
  saveRuntime,
  saveScreen,
  saveShow,
  trashScreen,
} from "./storage/repository.ts";

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

export type ShowEvent =
  // The draft of a screen was created or changed.
  | { type: "screen"; screenId: string }
  // What displays show for a screen changed.
  | { type: "published"; screenId: string }
  | { type: "deleted"; screenId: string }
  | { type: "state"; state: string }
  // A display's name or assignment changed, or it was forgotten.
  | { type: "display"; displayId: string }
  | { type: "preview"; displayId: string }
  | { type: "identify"; displayId: string; label: string }
  | { type: "reload"; displayId: string }
  | { type: "settings" };

export type Failure = {
  ok: false;
  status: 400 | 404 | 409 | 422 | 503;
  message: string;
  issues?: ValidationIssue[];
  revision?: number;
};

export type CommandResult<T> = { ok: true; value: T } | Failure;

export interface DisplayPatch {
  name?: string | null;
  screen?: string | null;
}

const NO_SHOW: Failure = { ok: false, status: 503, message: "The server has no active show; check its log" };

const noScreen = (screenId: string): Failure => ({
  ok: false,
  status: 404,
  message: `Screen "${screenId}" does not exist`,
});

const SEEN_WRITE_DELAY_MS = 2000;

// Runs writes one at a time, so two edits based on the same revision can never both pass the
// revision check while the first is still saving.
const createWriteQueue = () => {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
};

// The command layer: the single write path. REST, Socket.io and (later) MCP are thin adapters over it,
// so every change is validated, persisted and broadcast the same way whoever makes it.
// Edits change drafts; displays show the published copy until someone publishes (or the show is in live edit).
export const createShowService = ({
  dataDir,
  decor,
  log,
  loaded,
}: {
  dataDir: string;
  decor: DecorCatalog;
  log: Log;
  loaded: LoadedShow | null;
}) => {
  const listeners = new Set<(event: ShowEvent) => void>();
  const emit = (event: ShowEvent) => {
    for (const listener of listeners) listener(event);
  };

  const initialState = (show: LoadedShow) => {
    const saved = show.runtime.state;
    return saved && findState(show.show, saved) ? saved : (show.show.states[0]?.id ?? "normal");
  };

  const serialize = createWriteQueue();
  let state = loaded ? initialState(loaded) : "normal";
  let seenTimer: NodeJS.Timeout | undefined;
  // displayId -> screenId whose draft it previews. Kept in memory: a restart ends every preview.
  const previews = new Map<string, string>();

  const persistRuntime = async (current: LoadedShow) => {
    current.runtime = { ...current.runtime, state };
    await saveRuntime(dataDir, current.show.id, current.runtime);
  };

  const lint = (screen: Screen): LintIssue[] => lintScreen(screen, { decor, ...(loaded ? { show: loaded.show } : {}) });

  // Displays that show a screen's published copy (or would, once it is published); previews aside.
  const displaysShowing = (current: LoadedShow, screenId: string): string[] => {
    const ids = new Set([...current.show.displays.map((display) => display.id), ...Object.keys(current.runtime.seen)]);
    return [...ids].filter((id) => !previews.has(id) && resolveScreenId(current.show, id) === screenId);
  };

  const publishDraft = async (current: LoadedShow, draft: Screen): Promise<Screen> => {
    const marked = { ...draft, published: draft.revision };
    current.screens.set(marked.id, marked);
    current.published.set(marked.id, marked);
    await savePublished(dataDir, current.show.id, marked);
    await saveScreen(dataDir, current.show.id, marked);
    emit({ type: "published", screenId: marked.id });
    return marked;
  };

  // Saves a new draft revision, publishing it straight away in live edit.
  const commitDraft = async (current: LoadedShow, next: Screen, replaced?: Screen): Promise<Screen> => {
    await saveScreen(dataDir, current.show.id, next, replaced);
    current.screens.set(next.id, next);
    const saved = current.show.settings.liveEdit ? await publishDraft(current, next) : next;
    emit({ type: "screen", screenId: next.id });
    return saved;
  };

  const applyChecked = async (
    current: LoadedShow,
    screenId: string,
    baseRevision: number,
    ops: Op[],
    respectLocks: boolean,
  ): Promise<CommandResult<Screen>> => {
    const screen = current.screens.get(screenId);
    if (!screen) return noScreen(screenId);
    if (baseRevision !== screen.revision) {
      return { ok: false, status: 409, message: "The screen changed; reload it", revision: screen.revision };
    }
    const result = applyOps(screen, ops, { catalog, decor, respectLocks });
    if (!result.ok) return { ok: false, status: 422, message: "The change was rejected", issues: result.issues };
    return { ok: true, value: await commitDraft(current, result.screen, screen) };
  };

  return {
    loaded: (): LoadedShow | null => loaded,
    state: (): string => state,
    lint,
    previews: (): ReadonlyMap<string, string> => previews,

    subscribe: (listener: (event: ShowEvent) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // What a display shows: the draft it previews, or the published copy of its assigned (or default) screen.
    screenForDisplay: (displayId: string): { screen: Screen | null; preview: boolean } => {
      if (!loaded) return { screen: null, preview: false };
      const previewId = previews.get(displayId);
      const draft = previewId ? loaded.screens.get(previewId) : undefined;
      if (draft) return { screen: draft, preview: true };
      const screenId = resolveScreenId(loaded.show, displayId);
      return { screen: (screenId && loaded.published.get(screenId)) || null, preview: false };
    },

    displaysShowing: (screenId: string): string[] => (loaded ? displaysShowing(loaded, screenId) : []),

    createScreen: (input: unknown): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const result = validateScreen(input, catalog, decor);
        if (!result.ok) return { ok: false, status: 422, message: "Screen is not valid", issues: result.issues };
        if (loaded.screens.has(result.value.id)) {
          return { ok: false, status: 409, message: `Screen "${result.value.id}" already exists` };
        }
        const { published: _ignored, ...fresh } = result.value;
        return { ok: true, value: await commitDraft(loaded, { ...fresh, revision: 0 }) };
      }),

    applyOps: (
      screenId: string,
      baseRevision: number,
      input: unknown,
      options: { respectLocks?: boolean } = {},
    ): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const ops = OpListSchema.safeParse(input);
        if (!ops.success) {
          return {
            ok: false,
            status: 400,
            message: "Operations are not valid",
            issues: ops.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          };
        }
        return applyChecked(loaded, screenId, baseRevision, ops.data, options.respectLocks ?? false);
      }),

    // Puts the current draft on air. `revision`, when given, must be the draft's revision, so nobody
    // publishes a version they have not seen.
    publish: (screenId: string, revision?: number): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const draft = loaded.screens.get(screenId);
        if (!draft) return noScreen(screenId);
        if (revision !== undefined && revision !== draft.revision) {
          return { ok: false, status: 409, message: "The screen changed; review it before publishing", revision: draft.revision };
        }
        const published = await publishDraft(loaded, draft);
        emit({ type: "screen", screenId });
        return { ok: true, value: published };
      }),

    // Makes an earlier revision the new draft. History is never rewritten: the revert is a new revision.
    revert: (screenId: string, baseRevision: number, toRevision: number): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const draft = loaded.screens.get(screenId);
        if (!draft) return noScreen(screenId);
        const published = loaded.published.get(screenId);
        const target =
          published?.revision === toRevision
            ? published
            : await readRevision(dataDir, loaded.show.id, screenId, toRevision, decor, log);
        if (!target) return { ok: false, status: 404, message: `Revision ${toRevision} is not in the history` };

        const ops: Op[] = [
          { op: "replace", id: draft.root.id, node: target.root },
          {
            op: "meta",
            name: target.name,
            section: target.section ?? null,
            tags: target.tags,
            profile: target.profile,
          },
        ];
        return applyChecked(loaded, screenId, baseRevision, ops, false);
      }),

    duplicateScreen: (screenId: string, copy: { id?: string; name?: string } = {}): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const source = loaded.screens.get(screenId);
        if (!source) return noScreen(screenId);
        if (copy.id && loaded.screens.has(copy.id)) {
          return { ok: false, status: 409, message: `Screen "${copy.id}" already exists` };
        }
        const name = copy.name ?? `${source.name} copy`;
        const id = copy.id ?? uniqueId(slugify(name) || `${source.id}-copy`, new Set(loaded.screens.keys()));
        const { published: _ignored, ...draft } = structuredClone(source);
        return { ok: true, value: await commitDraft(loaded, { ...draft, id, name, revision: 0 }) };
      }),

    // A screen that is on air (assigned, or the default) is not deleted, so a display never goes blank by accident.
    deleteScreen: (screenId: string): Promise<CommandResult<string>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        if (!loaded.screens.has(screenId)) return noScreen(screenId);
        const assigned = loaded.show.displays.filter((display) => display.screen === screenId).map((display) => display.id);
        if (assigned.length > 0 || loaded.show.defaultScreen === screenId) {
          const where = assigned.length > 0 ? `displays ${assigned.join(", ")}` : "the default screen";
          return { ok: false, status: 409, message: `Screen "${screenId}" is in use by ${where}; reassign it first` };
        }
        await trashScreen(dataDir, loaded.show.id, screenId);
        loaded.screens.delete(screenId);
        loaded.published.delete(screenId);
        for (const [displayId, previewed] of previews) {
          if (previewed !== screenId) continue;
          previews.delete(displayId);
          emit({ type: "preview", displayId });
        }
        emit({ type: "deleted", screenId });
        return { ok: true, value: screenId };
      }),

    revisions: async (screenId: string): Promise<CommandResult<RevisionInfo[]>> => {
      if (!loaded) return NO_SHOW;
      const draft = loaded.screens.get(screenId);
      if (!draft) return noScreen(screenId);
      return { ok: true, value: await listRevisions(dataDir, loaded.show.id, screenId, draft.revision) };
    },

    revision: async (screenId: string, revision: number): Promise<CommandResult<Screen>> => {
      if (!loaded) return NO_SHOW;
      const draft = loaded.screens.get(screenId);
      if (!draft) return noScreen(screenId);
      if (draft.revision === revision) return { ok: true, value: draft };
      const published = loaded.published.get(screenId);
      if (published?.revision === revision) return { ok: true, value: published };
      const old = await readRevision(dataDir, loaded.show.id, screenId, revision, decor, log);
      return old ? { ok: true, value: old } : { ok: false, status: 404, message: `Revision ${revision} is not in the history` };
    },

    setState: async (stateId: string): Promise<CommandResult<string>> => {
      if (!loaded) return NO_SHOW;
      if (!findState(loaded.show, stateId)) {
        return { ok: false, status: 404, message: `The show has no state "${stateId}"` };
      }
      state = stateId;
      // Broadcast first: the 100 ms budget is for displays, the disk can follow.
      emit({ type: "state", state });
      await persistRuntime(loaded);
      return { ok: true, value: state };
    },

    updateSettings: (patch: Partial<ShowSettings>): Promise<CommandResult<ShowSettings>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        loaded.show = { ...loaded.show, settings: { ...loaded.show.settings, ...patch } };
        await saveShow(dataDir, loaded.show);
        emit({ type: "settings" });
        return { ok: true, value: loaded.show.settings };
      }),

    updateDisplay: (displayId: string, patch: DisplayPatch): Promise<CommandResult<DisplayDef>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        if (patch.screen && !loaded.screens.has(patch.screen)) return noScreen(patch.screen);

        const existing = loaded.show.displays.find((display) => display.id === displayId);
        const next: DisplayDef = { ...existing, id: displayId };
        if (patch.name !== undefined) {
          if (patch.name === null) delete next.name;
          else next.name = patch.name;
        }
        if (patch.screen !== undefined) {
          if (patch.screen === null) delete next.screen;
          else next.screen = patch.screen;
        }

        loaded.show = {
          ...loaded.show,
          displays: existing
            ? loaded.show.displays.map((display) => (display.id === displayId ? next : display))
            : [...loaded.show.displays, next],
        };
        await saveShow(dataDir, loaded.show);
        emit({ type: "display", displayId });
        return { ok: true, value: next };
      }),

    // Drops a display from the list (its name, assignment and last-seen time). It reappears when it connects.
    forgetDisplay: (displayId: string): Promise<CommandResult<string>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const { [displayId]: _seen, ...seen } = loaded.runtime.seen;
        loaded.runtime = { ...loaded.runtime, seen };
        loaded.show = { ...loaded.show, displays: loaded.show.displays.filter((display) => display.id !== displayId) };
        previews.delete(displayId);
        await saveShow(dataDir, loaded.show);
        await persistRuntime(loaded);
        emit({ type: "display", displayId });
        return { ok: true, value: displayId };
      }),

    // Shows a screen's draft on one display without publishing it; null goes back to the published screen.
    setPreview: (displayId: string, screenId: string | null): CommandResult<string | null> => {
      if (!loaded) return NO_SHOW;
      if (screenId !== null && !loaded.screens.has(screenId)) return noScreen(screenId);
      if (screenId === null) previews.delete(displayId);
      else previews.set(displayId, screenId);
      emit({ type: "preview", displayId });
      return { ok: true, value: screenId };
    },

    identify: (displayId: string): CommandResult<string> => {
      if (!loaded) return NO_SHOW;
      const label = loaded.show.displays.find((display) => display.id === displayId)?.name ?? displayId;
      emit({ type: "identify", displayId, label });
      return { ok: true, value: label };
    },

    reload: (displayId: string): CommandResult<string> => {
      if (!loaded) return NO_SHOW;
      emit({ type: "reload", displayId });
      return { ok: true, value: displayId };
    },

    assets: async (): Promise<CommandResult<AssetInfo[]>> => {
      if (!loaded) return NO_SHOW;
      return { ok: true, value: await listAssets(dataDir, loaded.show.id) };
    },

    // The caller has validated the name and type.
    saveAsset: (name: string, data: Buffer): Promise<CommandResult<string>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        await saveAsset(dataDir, loaded.show.id, name, data);
        return { ok: true, value: name };
      }),

    deleteAsset: (name: string): Promise<CommandResult<string>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const deleted = await deleteAsset(dataDir, loaded.show.id, name);
        return deleted ? { ok: true, value: name } : { ok: false, status: 404, message: `Asset "${name}" does not exist` };
      }),

    // Remembered so the operator can see and assign displays that are currently off.
    markSeen: (displayId: string): void => {
      if (!loaded) return;
      loaded.runtime = { ...loaded.runtime, seen: { ...loaded.runtime.seen, [displayId]: new Date().toISOString() } };
      if (seenTimer) return;
      seenTimer = setTimeout(() => {
        seenTimer = undefined;
        persistRuntime(loaded).catch((error: unknown) => log.warn({ err: error }, "Could not save runtime state"));
      }, SEEN_WRITE_DELAY_MS);
      seenTimer.unref();
    },

    flush: async (): Promise<void> => {
      if (seenTimer) clearTimeout(seenTimer);
      seenTimer = undefined;
      if (loaded) await persistRuntime(loaded);
    },
  };
};

export type ShowService = ReturnType<typeof createShowService>;
