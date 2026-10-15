import { type Field, TONES, type ThemeTokens } from "@interactive-displays/core";
import { useEffect, useId, useRef, useState } from "react";
import { useEditor } from "./EditorContext.ts";
import { formatField, parseField } from "./fieldText.ts";

const TYPING_MS = 600;

// Text is saved after a pause in typing, on Enter or when the field loses focus, not on every key.
const TextInput = ({
  id,
  value,
  multiline,
  maxLength,
  onCommit,
}: {
  id: string;
  value: string;
  multiline: boolean;
  maxLength: number | undefined;
  onCommit: (value: string) => void;
}) => {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ value, onCommit });
  latest.current = { value, onCommit };

  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string) => {
    clearTimeout(timer.current);
    if (next !== latest.current.value) latest.current.onCommit(next);
  };
  const change = (next: string) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), TYPING_MS);
  };
  const common = {
    id,
    value: draft,
    ...(maxLength !== undefined ? { maxLength } : {}),
    onBlur: () => commit(draft),
  };

  return multiline ? (
    <textarea className="tool-textarea" rows={3} {...common} onChange={(event) => change(event.target.value)} />
  ) : (
    <input
      className="tool-input"
      {...common}
      onChange={(event) => change(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit(draft);
      }}
    />
  );
};

// Text that becomes a number, a list or a table. It is saved when the field loses focus (or on Enter in a
// one-line field), never mid-typing, so "6." or a half-typed row is not reformatted under the cursor.
const ParsedInput = ({
  id,
  field,
  value,
  onCommit,
}: {
  id: string;
  field: Extract<Field, { type: "value" | "list" | "numbers" | "table" }>;
  value: unknown;
  onCommit: (value: unknown) => void;
}) => {
  const text = formatField(field, value);
  const [draft, setDraft] = useState(text);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    if (draft === text) return setProblem(undefined);
    const parsed = parseField(field, draft);
    if ("problem" in parsed) return setProblem(parsed.problem);
    setProblem(undefined);
    onCommit(parsed.value);
  };
  const common = {
    id,
    value: draft,
    "aria-invalid": problem ? true : undefined,
    onBlur: commit,
  };
  const hint = field.type === "list" ? "One per line" : field.type === "table" ? "One row per line, cells split by |" : undefined;
  return (
    <>
      {field.type === "list" || field.type === "table" ? (
        <textarea
          className="tool-textarea"
          rows={Math.min(8, Math.max(3, draft.split("\n").length + 1))}
          placeholder={hint}
          {...common}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <input
          className="tool-input"
          {...(field.type === "numbers" ? { inputMode: "decimal" as const, placeholder: "40, 65, 80" } : {})}
          {...common}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      )}
      {problem ? <span className="field__problem">{problem}</span> : null}
    </>
  );
};

const NumberInput = ({
  id,
  value,
  field,
  onCommit,
}: {
  id: string;
  value: number | undefined;
  field: Extract<Field, { type: "number" }>;
  onCommit: (value: number | undefined) => void;
}) => {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    const next = draft.trim() === "" ? undefined : Number(draft);
    if (next !== undefined && Number.isNaN(next)) return;
    if (next !== value) onCommit(next);
  };
  return (
    <input
      id={id}
      className="tool-input"
      type="number"
      inputMode="decimal"
      step={field.integer ? 1 : "any"}
      {...(field.min !== undefined ? { min: field.min } : {})}
      {...(field.max !== undefined ? { max: field.max } : {})}
      placeholder={field.default === undefined ? "" : String(field.default)}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
};

const JsonInput = ({ id, value, onCommit }: { id: string; value: unknown; onCommit: (value: unknown) => void }) => {
  const text = value === undefined ? "" : JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(text);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  useEffect(() => setDraft(text), [text]);
  return (
    <>
      <textarea
        id={id}
        className="tool-textarea tool-textarea--code"
        rows={4}
        value={draft}
        aria-invalid={problem ? true : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() === "") return onCommit(undefined);
          try {
            const parsed: unknown = JSON.parse(draft);
            setProblem(undefined);
            if (JSON.stringify(parsed) !== JSON.stringify(value)) onCommit(parsed);
          } catch {
            setProblem("Not valid JSON");
          }
        }}
      />
      {problem ? <span className="field__problem">{problem}</span> : null}
    </>
  );
};

const ToneInput = ({
  label,
  value,
  palette,
  onCommit,
}: {
  label: string;
  value: string | undefined;
  palette: ThemeTokens["palette"];
  onCommit: (value: string) => void;
}) => (
  <div className="tone-picker" role="radiogroup" aria-label={label}>
    {TONES.map((tone) => (
      <button
        key={tone}
        type="button"
        role="radio"
        aria-checked={value === tone}
        className="tone-picker__swatch"
        title={tone}
        style={{ ["--swatch" as string]: palette[tone] }}
        onClick={() => onCommit(tone)}
      >
        <span className="tone-picker__name">{tone}</span>
      </button>
    ))}
  </div>
);

// One control for one prop, chosen from its schema. `undefined` means "not set", which falls back to the default.
export const FieldInput = ({
  field,
  value,
  palette,
  overridden,
  onChange,
  onReset,
}: {
  field: Field;
  value: unknown;
  palette: ThemeTokens["palette"];
  overridden: boolean;
  onChange: (value: unknown) => void;
  onReset: (() => void) | undefined;
}) => {
  const { assets } = useEditor();
  const id = useId();
  const shown = value ?? field.default;

  const control = (() => {
    switch (field.type) {
      case "text":
        return (
          <TextInput
            id={id}
            value={typeof value === "string" ? value : ""}
            multiline={field.multiline}
            maxLength={field.maxLength}
            onCommit={(next) => onChange(next === "" && !field.required ? undefined : next)}
          />
        );
      case "number":
        return <NumberInput id={id} value={typeof value === "number" ? value : undefined} field={field} onCommit={onChange} />;
      case "boolean":
        return (
          <input id={id} type="checkbox" className="field__check" checked={shown === true} onChange={(event) => onChange(event.target.checked)} />
        );
      case "enum":
        return (
          <select id={id} className="tool-select" value={typeof shown === "string" ? shown : ""} onChange={(event) => onChange(event.target.value || undefined)}>
            {field.required || field.default !== undefined ? null : <option value="">—</option>}
            {field.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        );
      case "tone":
        return <ToneInput label={field.label} value={typeof shown === "string" ? shown : undefined} palette={palette} onCommit={onChange} />;
      case "asset": {
        const options = assets.filter((asset) => field.accept === "any" || asset.kind === field.accept);
        const current = typeof value === "string" ? value : "";
        return (
          <select id={id} className="tool-select" value={current} onChange={(event) => onChange(event.target.value || undefined)}>
            {current === "" ? <option value="">Choose a file…</option> : null}
            {current && !options.some((asset) => asset.name === current) ? <option value={current}>{current} (missing)</option> : null}
            {options.map((asset) => (
              <option key={asset.name}>{asset.name}</option>
            ))}
          </select>
        );
      }
      case "value":
      case "list":
      case "numbers":
      case "table":
        return <ParsedInput id={id} field={field} value={value} onCommit={onChange} />;
      case "json":
        return <JsonInput id={id} value={value} onCommit={onChange} />;
    }
  })();

  return (
    <div className="field" data-type={field.type} data-overridden={overridden}>
      <div className="field__head">
        {field.type === "tone" ? (
          <span className="field__label">{field.label}</span>
        ) : (
          <label className="field__label" htmlFor={id}>
            {field.label}
          </label>
        )}
        {onReset ? (
          <button type="button" className="field__reset" onClick={onReset}>
            {overridden ? "Use base value" : "Reset"}
          </button>
        ) : null}
      </div>
      {control}
      {field.description ? <span className="tool-field__hint">{field.description}</span> : null}
    </div>
  );
};
