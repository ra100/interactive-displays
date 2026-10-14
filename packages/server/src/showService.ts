import {
  applyOps,
  catalog,
  type DecorCatalog,
  type DisplayDef,
  findState,
  lintScreen,
  type LintIssue,
  OpListSchema,
  type Screen,
  validateScreen,
  type ValidationIssue,
} from "@interactive-displays/core";
import type { FastifyBaseLogger } from "fastify";
import { type LoadedShow, saveRuntime, saveScreen, saveShow } from "./storage/repository.ts";

type Log = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

export type ShowEvent =
  | { type: "screen"; screenId: string }
  | { type: "state"; state: string }
  | { type: "display"; displayId: string }
  | { type: "identify"; displayId: string; label: string };

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

  const persistRuntime = async (current: LoadedShow) => {
    current.runtime = { ...current.runtime, state };
    await saveRuntime(dataDir, current.show.id, current.runtime);
  };

  const lint = (screen: Screen): LintIssue[] => lintScreen(screen, { decor, ...(loaded ? { show: loaded.show } : {}) });

  return {
    loaded: (): LoadedShow | null => loaded,
    state: (): string => state,
    lint,

    subscribe: (listener: (event: ShowEvent) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    createScreen: (input: unknown): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const result = validateScreen(input, catalog, decor);
        if (!result.ok) return { ok: false, status: 422, message: "Screen is not valid", issues: result.issues };
        if (loaded.screens.has(result.value.id)) {
          return { ok: false, status: 409, message: `Screen "${result.value.id}" already exists` };
        }
        const screen = { ...result.value, revision: 0 };
        await saveScreen(dataDir, loaded.show.id, screen);
        loaded.screens.set(screen.id, screen);
        emit({ type: "screen", screenId: screen.id });
        return { ok: true, value: screen };
      }),

    applyOps: (
      screenId: string,
      baseRevision: number,
      input: unknown,
      options: { respectLocks?: boolean } = {},
    ): Promise<CommandResult<Screen>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const screen = loaded.screens.get(screenId);
        if (!screen) return { ok: false, status: 404, message: `Screen "${screenId}" does not exist` };
        if (baseRevision !== screen.revision) {
          return { ok: false, status: 409, message: "The screen changed; reload it", revision: screen.revision };
        }

        const ops = OpListSchema.safeParse(input);
        if (!ops.success) {
          return {
            ok: false,
            status: 400,
            message: "Operations are not valid",
            issues: ops.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          };
        }

        const result = applyOps(screen, ops.data, { catalog, decor, respectLocks: options.respectLocks ?? false });
        if (!result.ok) return { ok: false, status: 422, message: "The change was rejected", issues: result.issues };

        await saveScreen(dataDir, loaded.show.id, result.screen, screen);
        loaded.screens.set(screenId, result.screen);
        emit({ type: "screen", screenId });
        return { ok: true, value: result.screen };
      }),

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

    updateDisplay: (displayId: string, patch: DisplayPatch): Promise<CommandResult<DisplayDef>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        if (patch.screen && !loaded.screens.has(patch.screen)) {
          return { ok: false, status: 404, message: `Screen "${patch.screen}" does not exist` };
        }

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

    identify: (displayId: string): CommandResult<string> => {
      if (!loaded) return NO_SHOW;
      const label = loaded.show.displays.find((display) => display.id === displayId)?.name ?? displayId;
      emit({ type: "identify", displayId, label });
      return { ok: true, value: label };
    },

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
