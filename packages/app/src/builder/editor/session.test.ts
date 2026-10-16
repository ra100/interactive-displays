import type { Op, Screen } from "@interactive-displays/core";
import { describe, expect, it } from "vitest";
import { sampleScreen } from "../../testing/fixtures.ts";
import { adopt, confirmFirst, dropStep, edit, redo, rejectFirst, startSession, undo } from "./session.ts";

const rename = (text: string): Op[] => [{ op: "update", id: "title", props: { text } }];

const titleOf = (screen: Screen) => {
  const root = screen.root;
  const node = root.type === "container" ? root.children[0]?.node : undefined;
  return node?.type === "widget" ? node.props["text"] : undefined;
};

const ok = <T,>(result: { ok: true; session: T } | { ok: false; message: string }): T => {
  if (!result.ok) throw new Error(result.message);
  return result.session;
};

const base = sampleScreen("bridge", "Bridge");

describe("editor session", () => {
  it("shows an edit at once and queues it for saving", () => {
    const session = ok(edit(startSession(base), rename("ONE")));
    expect(titleOf(session.screen)).toBe("ONE");
    expect(titleOf(session.confirmed)).toBe("BRIDGE");
    expect(session.pending).toEqual([rename("ONE")]);
  });

  it("refuses an edit that does not validate, and keeps the screen", () => {
    const result = edit(startSession(base), [{ op: "remove", id: "nope" }]);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("nope") });
  });

  it("undoes and redoes edits as new batches", () => {
    let session = ok(edit(startSession(base), rename("ONE")));
    session = ok(edit(session, rename("TWO")));
    session = ok(undo(session));
    expect(titleOf(session.screen)).toBe("ONE");
    session = ok(undo(session));
    expect(titleOf(session.screen)).toBe("BRIDGE");
    expect(undo(session)).toEqual({ ok: false, message: "Nothing to undo" });
    session = ok(redo(session));
    expect(titleOf(session.screen)).toBe("ONE");
    expect(session.pending).toHaveLength(5);
  });

  it("ends redo history with a new edit", () => {
    let session = ok(edit(startSession(base), rename("ONE")));
    session = ok(undo(session));
    session = ok(edit(session, rename("OTHER")));
    expect(session.redo).toEqual([]);
  });

  it("moves the confirmed screen forward as the server saves each batch", () => {
    let session = ok(edit(startSession(base), rename("ONE")));
    session = ok(edit(session, rename("TWO")));
    session = confirmFirst(session, { ...ok(edit(startSession(base), rename("ONE"))).screen, revision: 1 });
    expect(session.confirmed.revision).toBe(1);
    expect(session.pending).toEqual([rename("TWO")]);
    expect(titleOf(session.screen)).toBe("TWO");
  });

  it("drops a refused batch and keeps the rest", () => {
    let session = ok(edit(startSession(base), rename("ONE")));
    session = ok(edit(session, [{ op: "set", id: "title", locked: true }]));
    session = rejectFirst(session);
    expect(titleOf(session.screen)).toBe("BRIDGE");
    expect(session.pending).toEqual([[{ op: "set", id: "title", locked: true }]]);
    expect(session.undo).toEqual([]);
  });

  it("rebases local edits on a newer screen from someone else", () => {
    let session = ok(edit(startSession(base), [{ op: "set", id: "title", locked: true }]));
    const theirs = { ...ok(edit(startSession(base), rename("THEIRS"))).screen, revision: 1 };
    const { session: next, dropped } = adopt(session, theirs);
    session = next;
    expect(dropped).toBe(0);
    expect(titleOf(session.screen)).toBe("THEIRS");
    expect(session.pending).toHaveLength(1);
  });

  it("drops local edits that no longer apply after a rebase", () => {
    const session = ok(edit(startSession(base), rename("MINE")));
    const theirs = ok(edit(startSession(base), [{ op: "remove", id: "title" }])).screen;
    const { session: next, dropped } = adopt(session, theirs);
    expect(dropped).toBe(1);
    expect(next.pending).toEqual([]);
  });

  it("reports an undo step that no longer applies, which can then be dropped", () => {
    let session = ok(edit(startSession(base), rename("ONE")));
    session = adopt(session, ok(edit(startSession(base), [{ op: "remove", id: "title" }])).screen).session;
    expect(undo(session)).toEqual({ ok: false, message: "Cannot undo this change any more" });
    expect(dropStep(session, "undo").undo).toEqual([]);
  });
});
