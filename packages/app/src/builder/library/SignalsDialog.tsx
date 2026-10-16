import {
  CLOCK_FORMATS,
  type SignalDef,
  SignalListSchema,
  type Source,
  uniqueId,
  type ValidationIssue,
} from "@interactive-displays/core";
import { useEffect, useId, useState } from "react";
import type { ApiResult } from "../../tools/api.ts";
import { plainNumber } from "../editor/fieldText.ts";
import { Dialog } from "../../tools/Dialog.tsx";

const SOURCE_LABELS: Record<Source["kind"], string> = {
  manual: "Set by the operator",
  walk: "Wanders",
  wave: "Swings back and forth",
  static: "Fixed",
  clock: "Clock",
};

// A new source of another kind keeps the range of the old one where both have one.
const sourceOfKind = (kind: Source["kind"], from: Source): Source => {
  const range = "min" in from && "max" in from ? { min: from.min, max: from.max } : { min: 0, max: 100 };
  switch (kind) {
    case "manual":
      return { kind, initial: range.min, step: 1, ...range };
    case "walk":
      return { kind, volatility: 0.3, ...range };
    case "wave":
      return { kind, periodMs: 4000, ...range };
    case "static":
      return { kind, value: 0 };
    case "clock":
      return { kind, format: "time" };
  }
};

const NumberField = ({
  label,
  value,
  step = "any",
  onCommit,
}: {
  label: string;
  value: number;
  step?: number | "any";
  onCommit: (value: number) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(next)) return setDraft(String(value));
    if (next !== value) onCommit(next);
  };
  return (
    <div className="tool-field">
      <label className="tool-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="tool-input"
        type="number"
        inputMode="decimal"
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </div>
  );
};

// A fixed number or text, typed freely and read when the field is left: "6.2" is a number, "007" stays text.
const StaticValue = ({ value, onCommit }: { value: number | string; onCommit: (value: number | string) => void }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = plainNumber(draft) ?? draft;
    if (next !== value) onCommit(next);
  };
  return (
    <label className="tool-field">
      <span className="tool-label">Fixed value</span>
      <input
        className="tool-input"
        value={draft}
        maxLength={80}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
};

const between = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const SourceFields = ({ source, onChange }: { source: Source; onChange: (source: Source) => void }) => {
  switch (source.kind) {
    case "manual":
      return (
        <>
          <NumberField label="Starts at" value={source.initial} onCommit={(initial) => onChange({ ...source, initial })} />
          <NumberField
            label="Lowest"
            value={source.min}
            onCommit={(min) => onChange({ ...source, min, initial: between(source.initial, min, source.max) })}
          />
          <NumberField
            label="Highest"
            value={source.max}
            onCommit={(max) => onChange({ ...source, max, initial: between(source.initial, source.min, max) })}
          />
          <NumberField label="Step" value={source.step} onCommit={(step) => onChange({ ...source, step })} />
        </>
      );
    case "walk":
      return (
        <>
          <NumberField label="Lowest" value={source.min} onCommit={(min) => onChange({ ...source, min })} />
          <NumberField label="Highest" value={source.max} onCommit={(max) => onChange({ ...source, max })} />
          <NumberField label="Restless (0–1)" value={source.volatility} step={0.1} onCommit={(volatility) => onChange({ ...source, volatility })} />
        </>
      );
    case "wave":
      return (
        <>
          <NumberField label="Lowest" value={source.min} onCommit={(min) => onChange({ ...source, min })} />
          <NumberField label="Highest" value={source.max} onCommit={(max) => onChange({ ...source, max })} />
          <NumberField
            label="Seconds per swing"
            value={source.periodMs / 1000}
            onCommit={(seconds) => onChange({ ...source, periodMs: Math.round(seconds * 1000) })}
          />
        </>
      );
    case "static":
      return <StaticValue value={source.value} onCommit={(value) => onChange({ ...source, value })} />;
    case "clock":
      return (
        <label className="tool-field">
          <span className="tool-label">Shows</span>
          <select
            className="tool-select"
            value={source.format}
            onChange={(event) => onChange({ ...source, format: event.target.value as (typeof CLOCK_FORMATS)[number] })}
          >
            {CLOCK_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format === "stardate" ? "Stardate" : format === "date" ? "Date" : "Time"}
              </option>
            ))}
          </select>
        </label>
      );
  }
};

const SignalForm = ({ signal, onChange }: { signal: SignalDef; onChange: (signal: SignalDef) => void }) => {
  const overridden = Object.keys(signal.byState ?? {});
  return (
    <div className="signal-form">
      <div className="signal-form__row">
        <label className="tool-field">
          <span className="tool-label">Name</span>
          <input
            className="tool-input"
            value={signal.label}
            maxLength={60}
            onChange={(event) => onChange({ ...signal, label: event.target.value })}
          />
        </label>
        <label className="tool-field">
          <span className="tool-label">Id</span>
          <input
            className="tool-input"
            value={signal.id}
            maxLength={64}
            onChange={(event) => onChange({ ...signal, id: event.target.value.trim() })}
          />
        </label>
        <label className="tool-field">
          <span className="tool-label">Unit</span>
          <input
            className="tool-input"
            value={signal.unit ?? ""}
            maxLength={12}
            onChange={(event) => {
              const { unit: _unit, ...rest } = signal;
              onChange(event.target.value ? { ...rest, unit: event.target.value } : rest);
            }}
          />
        </label>
      </div>
      <fieldset className="signal-form__scope">
        <legend className="tool-label">Every display shows</legend>
        <label className="signal-form__choice">
          <input
            type="radio"
            name={`scope-${signal.id}`}
            checked={signal.scope === "shared"}
            onChange={() => onChange({ ...signal, scope: "shared" })}
          />
          The same value (the server keeps it)
        </label>
        <label className="signal-form__choice">
          <input
            type="radio"
            name={`scope-${signal.id}`}
            checked={signal.scope === "ambient"}
            disabled={signal.source.kind === "manual"}
            onChange={() => onChange({ ...signal, scope: "ambient" })}
          />
          Its own value (no network)
        </label>
        {signal.source.kind === "manual" ? <p className="tool-field__hint">A value the operator sets is always shared.</p> : null}
      </fieldset>
      <div className="signal-form__row">
        <label className="tool-field">
          <span className="tool-label">Value</span>
          <select
            className="tool-select"
            value={signal.source.kind}
            onChange={(event) => {
              const kind = event.target.value as Source["kind"];
              // Only the server can hold a value the operator sets.
              onChange({ ...signal, source: sourceOfKind(kind, signal.source), ...(kind === "manual" ? { scope: "shared" } : {}) });
            }}
          >
            {(Object.keys(SOURCE_LABELS) as Source["kind"][]).map((kind) => (
              <option key={kind} value={kind}>
                {SOURCE_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <SourceFields source={signal.source} onChange={(source) => onChange({ ...signal, source })} />
      </div>
      {overridden.length > 0 ? (
        <p className="tool-field__hint">Changes per state ({overridden.join(", ")}) are kept as they are.</p>
      ) : null}
    </div>
  );
};

const problemOf = (signals: SignalDef[]): string | undefined => {
  const result = SignalListSchema.safeParse(signals);
  if (result.success) {
    const outside = signals.find(({ source }) => source.kind === "manual" && (source.initial < source.min || source.initial > source.max));
    return outside ? `${outside.label || outside.id}: Starts at must be between Lowest and Highest` : undefined;
  }
  const issue = result.error.issues[0];
  if (!issue) return "Check the signals";
  const index = typeof issue.path[0] === "number" ? issue.path[0] : undefined;
  const which = index === undefined ? "" : `${signals[index]?.label || `Signal ${index + 1}`}: `;
  return `${which}${issue.message}`;
};

// The show's live values: what each one is, where it comes from, and whether every display shares it.
export const SignalsDialog = ({
  signals: initial,
  onSave,
  onClose,
}: {
  signals: SignalDef[];
  onSave: (signals: SignalDef[]) => Promise<ApiResult<unknown>>;
  onClose: () => void;
}) => {
  const [signals, setSignals] = useState(initial);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const current = signals[selected];
  const problem = problemOf(signals);

  const add = () => {
    const id = uniqueId("signal", new Set(signals.map((signal) => signal.id)));
    const next: SignalDef = { id, label: "New signal", scope: "shared", source: { kind: "manual", initial: 0, min: 0, max: 100, step: 1 } };
    setSignals([...signals, next]);
    setSelected(signals.length);
  };

  const save = async () => {
    setBusy(true);
    const result = await onSave(signals);
    setBusy(false);
    if (result.ok) return onClose();
    const issue: ValidationIssue | undefined = result.issues?.[0];
    setError(issue ? `${issue.path} ${issue.message}`.trim() : result.error);
  };

  return (
    <Dialog title="Signals" onClose={onClose} wide>
      <div className="signals">
        <div className="signals__list">
          <ul role="listbox" aria-label="Signals">
            {signals.map((signal, index) => (
              <li
                key={index}
                role="option"
                aria-selected={index === selected}
                tabIndex={0}
                className="signals__item"
                onClick={() => setSelected(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelected(index);
                }}
              >
                <span className="signals__name">{signal.label || signal.id}</span>
                <span className="signals__meta">
                  {SOURCE_LABELS[signal.source.kind]} · {signal.scope}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="tool-button tool-button--small" onClick={add}>
            Add signal
          </button>
        </div>
        {current ? (
          <div className="signals__edit">
            <SignalForm signal={current} onChange={(next) => setSignals(signals.map((each, index) => (index === selected ? next : each)))} />
            <button
              type="button"
              className="tool-button tool-button--small tool-button--quiet"
              onClick={() => {
                setSignals(signals.filter((_, index) => index !== selected));
                setSelected(Math.max(0, selected - 1));
              }}
            >
              Remove {current.label || current.id}
            </button>
          </div>
        ) : (
          <p className="tool-field__hint">No signals yet. Add one, then bind gauges and readouts to it in the editor.</p>
        )}
      </div>
      {problem || error ? <p className="tool-error">{problem ?? error}</p> : null}
      <footer className="dialog__actions">
        <button type="button" className="tool-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="tool-button tool-button--primary" disabled={Boolean(problem) || busy} onClick={() => void save()}>
          Save signals
        </button>
      </footer>
    </Dialog>
  );
};
