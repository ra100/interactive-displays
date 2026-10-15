import { applyOps, catalog, type Op, type Screen } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";

// The editor's model of a screen: the last version the server accepted, plus local batches of ops waiting to be
// saved. Edits show at once (optimistic) and are sent one batch at a time; undo and redo are batches too, made
// from the inverse ops core returns. Pure functions, so the whole flow is testable without a server.

export interface EditorSession {
  // The last screen the server confirmed; its revision is the base for the next batch.
  confirmed: Screen;
  // Batches applied locally and not yet confirmed, oldest first. The first one may be in flight.
  pending: Op[][];
  // What the editor shows: confirmed plus pending.
  screen: Screen;
  // Inverse op lists, newest last.
  undo: Op[][];
  redo: Op[][];
}

const OPTIONS = { catalog, decor: decorCatalog };

export const startSession = (screen: Screen): EditorSession => ({
  confirmed: screen,
  pending: [],
  screen,
  undo: [],
  redo: [],
});

type Applied = { ok: true; session: EditorSession } | { ok: false; message: string };

const applyBatch = (session: EditorSession, ops: Op[]): { screen: Screen; inverse: Op[] } | string => {
  const result = applyOps(session.screen, ops, OPTIONS);
  if (!result.ok) return result.issues[0]?.message ?? "This change is not valid";
  return { screen: result.screen, inverse: result.inverse };
};

// A new edit: shown at once, queued for saving, and undoable. Redo history ends here.
export const edit = (session: EditorSession, ops: Op[]): Applied => {
  if (ops.length === 0) return { ok: true, session };
  const applied = applyBatch(session, ops);
  if (typeof applied === "string") return { ok: false, message: applied };
  return {
    ok: true,
    session: {
      ...session,
      screen: applied.screen,
      pending: [...session.pending, ops],
      undo: [...session.undo, applied.inverse],
      redo: [],
    },
  };
};

const step = (session: EditorSession, from: "undo" | "redo"): Applied => {
  const stack = session[from];
  const ops = stack.at(-1);
  if (!ops) return { ok: false, message: from === "undo" ? "Nothing to undo" : "Nothing to redo" };
  const rest = stack.slice(0, -1);
  const applied = applyBatch(session, ops);
  // The screen changed under this step (another editor, a revert): it cannot be undone any more.
  if (typeof applied === "string") return { ok: false, message: `Cannot ${from} this change any more` };
  const other = from === "undo" ? "redo" : "undo";
  return {
    ok: true,
    session: {
      ...session,
      screen: applied.screen,
      pending: [...session.pending, ops],
      [from]: rest,
      [other]: [...session[other], applied.inverse],
    },
  };
};

export const undo = (session: EditorSession): Applied => step(session, "undo");
export const redo = (session: EditorSession): Applied => step(session, "redo");

// Drops a step that can no longer be applied, so the button does not stay stuck on it.
export const dropStep = (session: EditorSession, from: "undo" | "redo"): EditorSession => ({
  ...session,
  [from]: session[from].slice(0, -1),
});

// Replays pending batches on a newer confirmed screen; batches that no longer apply are dropped.
const rebase = (confirmed: Screen, pending: Op[][]): { screen: Screen; pending: Op[][]; dropped: number } => {
  let screen = confirmed;
  const kept: Op[][] = [];
  for (const ops of pending) {
    const result = applyOps(screen, ops, OPTIONS);
    if (result.ok) {
      screen = result.screen;
      kept.push(ops);
    }
  }
  return { screen, pending: kept, dropped: pending.length - kept.length };
};

// The server accepted the first pending batch and answered with the new screen.
export const confirmFirst = (session: EditorSession, saved: Screen): EditorSession => {
  const rebased = rebase(saved, session.pending.slice(1));
  return { ...session, confirmed: saved, screen: rebased.screen, pending: rebased.pending };
};

// The server refused the first pending batch. Undo history may point at it, so it starts over.
export const rejectFirst = (session: EditorSession): EditorSession => {
  const rebased = rebase(session.confirmed, session.pending.slice(1));
  return { ...session, screen: rebased.screen, pending: rebased.pending, undo: [], redo: [] };
};

// A newer version from the server (someone else's edit, a conflict reload, a revert): local edits that still
// apply are kept on top of it.
export const adopt = (session: EditorSession, latest: Screen): { session: EditorSession; dropped: number } => {
  const rebased = rebase(latest, session.pending);
  return {
    session: { ...session, confirmed: latest, screen: rebased.screen, pending: rebased.pending },
    dropped: rebased.dropped,
  };
};

// After a revert the old undo steps describe a different screen.
export const resetHistory = (session: EditorSession): EditorSession => ({ ...session, undo: [], redo: [] });
