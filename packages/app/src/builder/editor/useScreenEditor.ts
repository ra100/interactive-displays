import type { Op, Screen, ScreenUpdate } from "@interactive-displays/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../tools/api.ts";
import type { ToolSocket } from "../../tools/useToolConnection.ts";
import {
  adopt,
  confirmFirst,
  dropStep,
  edit,
  type EditorSession,
  redo,
  rejectFirst,
  resetHistory,
  startSession,
  undo,
} from "./session.ts";

export type EditorStatus = "loading" | "missing" | "deleted" | "ready";

export interface ScreenEditor {
  status: EditorStatus;
  screen: Screen | undefined;
  // The revision the server has; the draft is saved when nothing is pending.
  savedRevision: number | undefined;
  saving: boolean;
  offline: boolean;
  canUndo: boolean;
  canRedo: boolean;
  // Applies ops at once and saves them in the background. False (with a message) when they are not valid.
  apply: (ops: Op[]) => boolean;
  undo: () => void;
  redo: () => void;
  // Resolves with the saved screen once every pending edit is on the server.
  settled: () => Promise<Screen | undefined>;
  // Takes a screen the server just returned (a revert), dropping undo history.
  replace: (screen: Screen) => void;
}

const RETRY_MS = 2000;

const loadScreen = async (screenId: string) => api<{ screen: Screen }>("GET", `/api/screens/${screenId}`);

// The editor's link to one screen draft: optimistic edits, a serialized save queue with conflict rebasing,
// undo/redo, and live updates when someone else (another editor, later the AI) changes the same draft.
export const useScreenEditor = (
  screenId: string,
  socket: ToolSocket | null,
  report: (message: string) => void,
): ScreenEditor => {
  const [status, setStatus] = useState<EditorStatus>("loading");
  const [session, setSession] = useState<EditorSession | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);
  const current = useRef<EditorSession | undefined>(undefined);
  const inFlight = useRef(false);
  const latestSeen = useRef(0);
  const waiters = useRef<Array<(screen: Screen | undefined) => void>>([]);
  const reportRef = useRef(report);
  reportRef.current = report;

  const update = useCallback((next: EditorSession | undefined) => {
    current.current = next;
    setSession(next);
  }, []);

  const reload = useCallback(async () => {
    const result = await loadScreen(screenId);
    const session = current.current;
    if (!result.ok || !session) return;
    const { session: next, dropped } = adopt(session, result.data.screen);
    update(next);
    if (dropped > 0) reportRef.current("Someone else changed this screen; some of your edits no longer fit and were dropped");
  }, [screenId, update]);

  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    const session = current.current;
    if (!session) return;
    const ops = session.pending[0];
    if (!ops) {
      setSaving(false);
      if (latestSeen.current > session.confirmed.revision) await reload();
      for (const resolve of waiters.current.splice(0)) resolve(current.current?.confirmed);
      return;
    }

    inFlight.current = true;
    setSaving(true);
    const result = await api<{ screen: Screen }>("POST", `/api/screens/${screenId}/ops`, {
      baseRevision: session.confirmed.revision,
      ops,
    });
    inFlight.current = false;
    const latest = current.current;
    if (!latest) return;

    if (result.ok) {
      setOffline(false);
      update(confirmFirst(latest, result.data.screen));
    } else if (result.status === 0) {
      setOffline(true);
      setTimeout(() => void flush(), RETRY_MS);
      return;
    } else if (result.status === 409) {
      await reload();
    } else if (result.status === 404) {
      setStatus("deleted");
      return;
    } else {
      update(rejectFirst(latest));
      reportRef.current(result.issues?.[0]?.message ?? result.error);
    }
    await flush();
  }, [reload, screenId, update]);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    update(undefined);
    void loadScreen(screenId).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setStatus("missing");
        return;
      }
      latestSeen.current = result.data.screen.revision;
      update(startSession(result.data.screen));
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [screenId, update]);

  useEffect(() => {
    if (!socket) return;
    const watch = () => socket.emit("watch", { screenId });
    const onScreen = (change: ScreenUpdate) => {
      if (change.screenId !== screenId) return;
      if (!change.screen) {
        setStatus("deleted");
        return;
      }
      latestSeen.current = Math.max(latestSeen.current, change.screen.revision);
      const session = current.current;
      // While edits are on their way the queue reconciles once it is empty.
      if (!session || inFlight.current || session.pending.length > 0) return;
      if (change.screen.revision > session.confirmed.revision) update(adopt(session, change.screen).session);
    };
    watch();
    socket.on("connect", watch);
    socket.on("screen", onScreen);
    return () => {
      socket.off("connect", watch);
      socket.off("screen", onScreen);
      socket.emit("watch", { screenId: null });
    };
  }, [socket, screenId, update]);

  const apply = useCallback(
    (ops: Op[]) => {
      const session = current.current;
      if (!session || ops.length === 0) return false;
      const result = edit(session, ops);
      if (!result.ok) {
        reportRef.current(result.message);
        return false;
      }
      update(result.session);
      void flush();
      return true;
    },
    [flush, update],
  );

  const step = useCallback(
    (from: "undo" | "redo") => {
      const session = current.current;
      if (!session) return;
      const result = from === "undo" ? undo(session) : redo(session);
      if (!result.ok) {
        if (session[from].length > 0) update(dropStep(session, from));
        reportRef.current(result.message);
        return;
      }
      update(result.session);
      void flush();
    },
    [flush, update],
  );

  const settled = useCallback(
    () =>
      new Promise<Screen | undefined>((resolve) => {
        const session = current.current;
        if (!session || (session.pending.length === 0 && !inFlight.current)) resolve(session?.confirmed);
        else waiters.current.push(resolve);
      }),
    [],
  );

  const replace = useCallback(
    (screen: Screen) => {
      const session = current.current;
      if (!session) return;
      latestSeen.current = Math.max(latestSeen.current, screen.revision);
      update(resetHistory(adopt(session, screen).session));
    },
    [update],
  );

  return {
    status,
    screen: session?.screen,
    savedRevision: session?.confirmed.revision,
    saving,
    offline,
    canUndo: (session?.undo.length ?? 0) > 0,
    canRedo: (session?.redo.length ?? 0) > 0,
    apply,
    undo: () => step("undo"),
    redo: () => step("redo"),
    settled,
    replace,
  };
};
