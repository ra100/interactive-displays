import { type Cue, nextCue, type ShowOverview } from "@interactive-displays/core";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type SignalStore, useSignalValues } from "../runtime/live.ts";
import { cueFromNow, cueSummary, moveCue } from "./cues.ts";

// Keys typed into these never press GO.
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName));

// The running order: a big GO that runs the next cue (also the space bar), the list with the last cue run and the
// next one marked, and a way to record what is on air now as a new cue.
export const CuePanel = ({
  overview,
  store,
  onGo,
  onRun,
  onReset,
  onSave,
}: {
  overview: ShowOverview;
  store: SignalStore;
  onGo: () => void;
  onRun: (cueId: string) => void;
  onReset: () => void;
  onSave: (cues: Cue[]) => void;
}) => {
  const values = useSignalValues(store);
  const [label, setLabel] = useState("");
  const { cues } = overview.show;
  const next = nextCue(overview.show, overview.cue);
  const go = useRef(onGo);
  go.current = onGo;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return;
      event.preventDefault();
      go.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const record = (event: FormEvent) => {
    event.preventDefault();
    if (!label.trim()) return;
    onSave([...cues, cueFromNow(overview, values, label.trim())]);
    setLabel("");
  };

  return (
    <div className="cue-panel">
      <div className="cue-panel__go">
        <button type="button" className="go-button" disabled={!next} onClick={onGo} aria-describedby="go-next">
          GO
        </button>
        <p id="go-next" className="cue-panel__next">
          {next ? (
            <>
              <span className="tool-label">Next</span> {next.label}
              {next.note ? <span className="cue-panel__note"> · {next.note}</span> : null}
            </>
          ) : cues.length ? (
            "End of the running order"
          ) : (
            "No cues yet: rehearse a beat, then record it below"
          )}
        </p>
        {overview.cue ? (
          <button type="button" className="tool-button tool-button--quiet tool-button--small" onClick={onReset}>
            Back to top
          </button>
        ) : null}
      </div>

      {cues.length ? (
        <ol className="cue-list">
          {cues.map((cue, index) => (
            <li
              key={cue.id}
              className="cue-row"
              data-current={cue.id === overview.cue || undefined}
              data-next={cue.id === next?.id || undefined}
              aria-label={cue.label}
            >
              <span className="cue-row__number">{index + 1}</span>
              <span className="cue-row__text">
                <strong>{cue.label}</strong>
                <span className="cue-row__summary">
                  {cueSummary(cue, overview)}
                  {cue.note ? ` · ${cue.note}` : ""}
                </span>
              </span>
              <span className="cue-row__actions">
                <button type="button" className="tool-button tool-button--small" onClick={() => onRun(cue.id)}>
                  Run
                </button>
                <button
                  type="button"
                  className="tool-button tool-button--quiet tool-button--small"
                  aria-label={`Move ${cue.label} up`}
                  disabled={index === 0}
                  onClick={() => onSave(moveCue(cues, cue.id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="tool-button tool-button--quiet tool-button--small"
                  aria-label={`Move ${cue.label} down`}
                  disabled={index === cues.length - 1}
                  onClick={() => onSave(moveCue(cues, cue.id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="tool-button tool-button--quiet tool-button--small"
                  aria-label={`Delete ${cue.label}`}
                  onClick={() => onSave(cues.filter((each) => each.id !== cue.id))}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <form className="cue-panel__record" onSubmit={record}>
        <input
          className="tool-input"
          aria-label="New cue name"
          placeholder="Cue name, e.g. Second hit"
          value={label}
          maxLength={60}
          onChange={(event) => setLabel(event.target.value)}
        />
        <button className="tool-button" type="submit" disabled={!label.trim()}>
          Record what is on air
        </button>
      </form>
    </div>
  );
};
