import type { RevisionInfo, Screen } from "@interactive-displays/core";
import { useEffect, useState } from "react";
import { api } from "../../tools/api.ts";
import { ConfirmDialog } from "../../tools/Dialog.tsx";
import { timeAgo } from "../../tools/timeAgo.ts";

// Saved revisions of the draft, newest first. Any of them can be looked at in the preview and restored, which
// adds a new revision with the old content (nothing is lost).
export const HistoryPanel = ({
  screenId,
  savedRevision,
  published,
  viewing,
  onView,
  onRestore,
}: {
  screenId: string;
  savedRevision: number | undefined;
  published: number | null;
  viewing: number | undefined;
  onView: (screen: Screen | undefined) => void;
  onRestore: (revision: number) => void;
}) => {
  const [revisions, setRevisions] = useState<RevisionInfo[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [restoring, setRestoring] = useState<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void api<{ revisions: RevisionInfo[] }>("GET", `/api/screens/${screenId}/revisions`).then((result) => {
      if (!active) return;
      if (result.ok) setRevisions(result.data.revisions);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [screenId, savedRevision]);

  const view = async (revision: number) => {
    if (viewing === revision) return onView(undefined);
    const result = await api<{ screen: Screen }>("GET", `/api/screens/${screenId}/revisions/${revision}`);
    if (result.ok) onView(result.data.screen);
    else setError(result.error);
  };

  if (error) return <p className="tool-error">{error}</p>;
  if (!revisions) return <p className="panel-empty">Loading…</p>;

  return (
    <div className="history">
      <p className="panel-note">Every saved change is a revision. Restoring one adds a new revision with its content.</p>
      <ol className="history__list">
        {revisions.map(({ revision, savedAt }) => (
          <li key={revision} className="history__item" data-viewing={viewing === revision}>
            <div className="history__info">
              <span className="history__revision">Revision {revision}</span>
              {savedAt ? <span className="history__time">{timeAgo(savedAt)}</span> : null}
              <span className="history__chips">
                {revision === savedRevision ? <span className="tool-chip">Current</span> : null}
                {revision === published ? (
                  <span className="tool-chip" data-tone="success">
                    On air
                  </span>
                ) : null}
              </span>
            </div>
            <div className="history__actions">
              <button type="button" className="tool-button tool-button--small" aria-pressed={viewing === revision} onClick={() => void view(revision)}>
                {viewing === revision ? "Hide" : "View"}
              </button>
              {revision !== savedRevision ? (
                <button type="button" className="tool-button tool-button--small" onClick={() => setRestoring(revision)}>
                  Restore
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {restoring !== undefined ? (
        <ConfirmDialog
          title={`Restore revision ${restoring}?`}
          confirm="Restore"
          onConfirm={() => onRestore(restoring)}
          onClose={() => setRestoring(undefined)}
        >
          <p>The draft goes back to how it was in revision {restoring}. Displays keep showing the published version until you publish.</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
};
