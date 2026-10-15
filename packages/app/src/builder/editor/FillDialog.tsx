import type { LintIssue, Op, Screen, Show } from "@interactive-displays/core";
import { useState } from "react";
import { api } from "../../tools/api.ts";
import { Dialog } from "../../tools/Dialog.tsx";
import { ScreenThumbnail } from "../../tools/ScreenThumbnail.tsx";

interface Proposal {
  ops: Op[];
  screen: Screen;
  lint: LintIssue[];
  summary: string;
}

const SUGGESTIONS = ["Fill the placeholders", "Make it look busier", "Add a red alert banner", "Tidy the labels"];

// Fill with AI: describe a change, the server's model works on a copy of the screen, and the result comes back as
// a proposal to look at. Applying it is one ordinary edit, so Undo takes it back; discarding leaves nothing behind.
export const FillDialog = ({
  screenId,
  theme,
  states,
  settled,
  onApply,
  onClose,
}: {
  screenId: string;
  theme: Show["theme"];
  states: Show["states"];
  // The draft once pending edits are saved, so the proposal starts from what the server has.
  settled: () => Promise<Screen | undefined>;
  onApply: (ops: Op[]) => boolean;
  onClose: () => void;
}) => {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [proposal, setProposal] = useState<Proposal | undefined>(undefined);

  const ask = async () => {
    setBusy(true);
    setError(undefined);
    const saved = await settled();
    if (!saved) {
      setBusy(false);
      return setError("The screen has unsaved changes the server rejected; fix those first");
    }
    const result = await api<Proposal>("POST", `/api/screens/${screenId}/fill`, { baseRevision: saved.revision, brief });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setProposal(result.data);
  };

  const apply = () => {
    if (!proposal) return;
    if (onApply(proposal.ops)) onClose();
    else setError("The screen changed while the AI worked; ask again");
  };

  const warnings = proposal?.lint.filter((issue) => issue.level === "warning").length ?? 0;

  return (
    <Dialog title="Fill with AI" onClose={onClose} wide>
      {proposal ? (
        <div className="fill">
          <ScreenThumbnail screen={proposal.screen} theme={theme} states={states} />
          <p className="fill__summary">{proposal.summary}</p>
          <p className="tool-field__hint">
            {proposal.ops.length === 0
              ? "No changes proposed."
              : `${proposal.ops.length} ${proposal.ops.length === 1 ? "change" : "changes"}${warnings > 0 ? `, ${warnings} lint ${warnings === 1 ? "warning" : "warnings"}` : ""}. Locked parts were left alone.`}
          </p>
          {error ? <p className="tool-error">{error}</p> : null}
          <footer className="dialog__actions">
            <button type="button" className="tool-button" onClick={() => setProposal(undefined)}>
              Ask again
            </button>
            <button type="button" className="tool-button" onClick={onClose}>
              Discard
            </button>
            <button type="button" className="tool-button tool-button--primary" disabled={proposal.ops.length === 0} onClick={apply}>
              Apply
            </button>
          </footer>
        </div>
      ) : (
        <form
          className="fill"
          onSubmit={(event) => {
            event.preventDefault();
            void ask();
          }}
        >
          <label className="tool-field">
            <span className="tool-label">What should change?</span>
            <textarea
              className="tool-input fill__brief"
              rows={4}
              maxLength={2000}
              value={brief}
              placeholder="Turn this into the torpedo bay: loading status for each tube and a fire control panel"
              onChange={(event) => setBrief(event.target.value)}
            />
          </label>
          <div className="fill__suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="tool-button tool-button--small tool-button--quiet" onClick={() => setBrief(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <p className="tool-field__hint">Nothing changes until you apply the result. Locked parts are never touched.</p>
          {error ? <p className="tool-error">{error}</p> : null}
          <footer className="dialog__actions">
            <button type="button" className="tool-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="tool-button tool-button--primary" disabled={busy || brief.trim() === ""}>
              {busy ? "Working…" : "Ask"}
            </button>
          </footer>
        </form>
      )}
    </Dialog>
  );
};
