import {
  type Action,
  applyOps,
  catalog,
  type DecorCatalog,
  type DisplayDef,
  findSignal,
  findState,
  isSettable,
  lintScreen,
  type LintIssue,
  type Op,
  OpListSchema,
  type Press,
  resolveScreenId,
  type Screen,
  type ShowSettings,
  type SignalDef,
  SignalListSchema,
  type SignalValues,
  slugify,
  uniqueId,
  validateScreen,
  type ValidationIssue,
  type AssetInfo,
  type RevisionInfo,
  type VideoCommand,
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
import { pressTarget, videoIds } from "./press.ts";
import { createSignals } from "./signals.ts";

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
  // Show-wide definitions every display renders with changed: settings or signal definitions.
  | { type: "show" }
  // Shared signal values changed; only the changed ones.
  | { type: "signals"; values: SignalValues }
  | { type: "video"; displayId: string; target: string; command: VideoCommand };

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

// Runtime state that changes often (displays seen, a slider dragged) is written at most this often.
const RUNTIME_WRITE_DELAY_MS = 2000;

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
  let runtimeTimer: NodeJS.Timeout | undefined;
  // displayId -> screenId whose draft it previews. Kept in memory: a restart ends every preview.
  const previews = new Map<string, string>();
  // displayId -> screens a control on it navigated to, oldest first. In memory too: a restart sends displays home.
  const navigation = new Map<string, string[]>();
  const signals = createSignals(loaded?.runtime.signals ?? {});

  const persistRuntime = async (current: LoadedShow) => {
    current.runtime = { ...current.runtime, state, signals: signals.saved(current.show) };
    await saveRuntime(dataDir, current.show.id, current.runtime);
  };

  const persistRuntimeSoon = (current: LoadedShow) => {
    if (runtimeTimer) return;
    runtimeTimer = setTimeout(() => {
      runtimeTimer = undefined;
      persistRuntime(current).catch((error: unknown) => log.warn({ err: error }, "Could not save runtime state"));
    }, RUNTIME_WRITE_DELAY_MS);
    runtimeTimer.unref();
  };

  const lint = (screen: Screen): LintIssue[] =>
    lintScreen(screen, { decor, ...(loaded ? { show: loaded.show, screens: new Set(loaded.screens.keys()) } : {}) });

  const navigatedTo = (displayId: string): string | undefined => navigation.get(displayId)?.at(-1);

  // The published screen a display shows when it is not previewing: where a control took it, or its own.
  const publishedScreenId = (current: LoadedShow, displayId: string): string | undefined =>
    navigatedTo(displayId) ?? resolveScreenId(current.show, displayId);

  // What a display shows: the draft it previews, or the published copy of where it navigated to or of its
  // assigned (or default) screen.
  const screenFor = (current: LoadedShow, displayId: string): { screen: Screen | null; preview: boolean } => {
    const previewId = previews.get(displayId);
    const draft = previewId ? current.screens.get(previewId) : undefined;
    if (draft) return { screen: draft, preview: true };
    const screenId = publishedScreenId(current, displayId);
    return { screen: (screenId && current.published.get(screenId)) || null, preview: false };
  };

  // Displays that show a screen's published copy (or would, once it is published); previews aside.
  const displaysShowing = (current: LoadedShow, screenId: string): string[] => {
    const ids = new Set([...current.show.displays.map((display) => display.id), ...Object.keys(current.runtime.seen)]);
    return [...ids].filter((id) => !previews.has(id) && publishedScreenId(current, id) === screenId);
  };

  // Sends a display home: forgets where its controls took it. True when it had gone anywhere.
  const clearNavigation = (displayId: string): boolean => navigation.delete(displayId);

  const navigate = (current: LoadedShow, displayId: string, screenId: string): boolean => {
    if (!current.published.has(screenId) || screenFor(current, displayId).screen?.id === screenId) return false;
    navigation.set(displayId, [...(navigation.get(displayId) ?? []), screenId]);
    emit({ type: "display", displayId });
    return true;
  };

  const back = (displayId: string): boolean => {
    const stack = navigation.get(displayId);
    if (!stack?.length) return false;
    const rest = stack.slice(0, -1);
    if (rest.length > 0) navigation.set(displayId, rest);
    else navigation.delete(displayId);
    emit({ type: "display", displayId });
    return true;
  };

  const setState = async (stateId: string): Promise<CommandResult<string>> => {
    if (!loaded) return NO_SHOW;
    if (!findState(loaded.show, stateId)) {
      return { ok: false, status: 404, message: `The show has no state "${stateId}"` };
    }
    state = stateId;
    // Broadcast first: the 100 ms budget is for displays, the disk can follow.
    emit({ type: "state", state });
    await persistRuntime(loaded);
    return { ok: true, value: state };
  };

  const setSignal = (signalId: string, change: { value?: number; delta?: number }): CommandResult<number> => {
    if (!loaded) return NO_SHOW;
    const signal = findSignal(loaded.show, signalId);
    if (!signal) return { ok: false, status: 404, message: `The show has no signal "${signalId}"` };
    if (!isSettable(signal)) {
      return { ok: false, status: 409, message: `Signal "${signalId}" is not a shared manual signal, so it cannot be set` };
    }
    const next = signals.set(signal, change);
    if (next !== undefined) {
      emit({ type: "signals", values: { [signal.id]: next } });
      persistRuntimeSoon(loaded);
    }
    return { ok: true, value: next ?? signals.current(signal) };
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

    screenForDisplay: (displayId: string): { screen: Screen | null; preview: boolean } =>
      loaded ? screenFor(loaded, displayId) : { screen: null, preview: false },

    // The screen a control took this display to, if any.
    navigated: (displayId: string): string | null => navigatedTo(displayId) ?? null,

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
        for (const [displayId, stack] of navigation) {
          if (!stack.includes(screenId)) continue;
          const rest = stack.filter((each) => each !== screenId);
          if (rest.length > 0) navigation.set(displayId, rest);
          else navigation.delete(displayId);
          emit({ type: "display", displayId });
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

    setState,

    updateSettings: (patch: Partial<ShowSettings>): Promise<CommandResult<ShowSettings>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        loaded.show = { ...loaded.show, settings: { ...loaded.show.settings, ...patch } };
        await saveShow(dataDir, loaded.show);
        emit({ type: "show" });
        return { ok: true, value: loaded.show.settings };
      }),

    // Replaces the show's signal definitions. Values of signals that are gone, or no longer manual, are dropped.
    defineSignals: (input: unknown): Promise<CommandResult<SignalDef[]>> =>
      serialize(async () => {
        if (!loaded) return NO_SHOW;
        const parsed = SignalListSchema.safeParse(input);
        if (!parsed.success) {
          return {
            ok: false,
            status: 422,
            message: "Signals are not valid",
            issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          };
        }
        loaded.show = { ...loaded.show, signals: parsed.data };
        signals.prune(loaded.show);
        await saveShow(dataDir, loaded.show);
        await persistRuntime(loaded);
        emit({ type: "show" });
        return { ok: true, value: parsed.data };
      }),

    // Sets a shared manual signal to a value or moves it by a delta, within its range and step.
    setSignal,

    // Current values of every server-owned signal.
    signalValues: (now: number = Date.now()): SignalValues => (loaded ? signals.values(loaded.show, state, now) : {}),

    // Called a few times a second: moves shared walk and wave signals on and broadcasts what changed.
    tickSignals: (now: number = Date.now()): void => {
      if (!loaded) return;
      const changed = signals.tick(loaded.show, state, now);
      if (Object.keys(changed).length > 0) emit({ type: "signals", values: changed });
    },

    // An actor used a control on a display. Runs the actions that are the server's: navigation for that display
    // (not while it previews a draft), and show state and shared signals while the show allows displays to change
    // them. The display plays its own sounds and videos. Returns what ran.
    press: async (displayId: string, input: Press): Promise<Action["do"][]> => {
      if (!loaded) return [];
      const { screen, preview } = screenFor(loaded, displayId);
      const node = screen ? pressTarget(screen, input.nodeId, state) : undefined;
      const ran: Action["do"][] = [];
      const global = loaded.show.settings.displayGlobalActions;
      for (const action of node?.actions ?? []) {
        if (action.do === "navigate" && !preview && navigate(loaded, displayId, action.screen)) ran.push(action.do);
        if (action.do === "back" && !preview && back(displayId)) ran.push(action.do);
        if (action.do === "setState" && global && (await setState(action.state)).ok) ran.push(action.do);
        if (action.do === "setSignal" && global) {
          // A fixed value or delta from the action, or else the control's own value.
          const value = action.value ?? (action.delta === undefined ? input.value : undefined);
          const change = action.delta === undefined ? (value === undefined ? undefined : { value }) : { delta: action.delta };
          if (change && setSignal(action.signal, change).ok) ran.push(action.do);
        }
      }
      return ran;
    },

    // Plays, pauses or restarts a video widget on the screen a display shows.
    video: (displayId: string, target: string, command: VideoCommand): CommandResult<string> => {
      if (!loaded) return NO_SHOW;
      if (!videoIds(screenFor(loaded, displayId).screen).includes(target)) {
        return { ok: false, status: 404, message: `Display "${displayId}" shows no video "${target}"` };
      }
      emit({ type: "video", displayId, target, command });
      return { ok: true, value: target };
    },

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
          // A new assignment wins over wherever the display's own controls took it.
          clearNavigation(displayId);
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
        clearNavigation(displayId);
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
      // Starting or ending a preview starts the display afresh on its own screen.
      clearNavigation(displayId);
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
      persistRuntimeSoon(loaded);
    },

    flush: async (): Promise<void> => {
      if (runtimeTimer) clearTimeout(runtimeTimer);
      runtimeTimer = undefined;
      if (loaded) await persistRuntime(loaded);
    },
  };
};

export type ShowService = ReturnType<typeof createShowService>;
