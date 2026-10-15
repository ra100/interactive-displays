import { type ReactNode, useEffect, useId, useState } from "react";

export const Section = ({ title, children }: { title: string; children: ReactNode }) => {
  const id = useId();
  return (
    <section className="inspector__section" aria-labelledby={id}>
      <h3 id={id} className="tool-label">
        {title}
      </h3>
      {children}
    </section>
  );
};

// A small numeric input that saves on Enter or blur; for placement and layout numbers.
export const NumberBox = ({
  label,
  value,
  min,
  max,
  step = 1,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number | undefined) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  useEffect(() => setDraft(value === undefined ? "" : String(value)), [value]);
  const commit = () => {
    const next = draft.trim() === "" ? undefined : Number(draft);
    if (next !== undefined && Number.isNaN(next)) return;
    if (next !== value) onCommit(next);
  };
  return (
    <div className="number-box">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="tool-input"
        type="number"
        step={step}
        {...(placeholder ? { placeholder } : {})}
        {...(min !== undefined ? { min } : {})}
        {...(max !== undefined ? { max } : {})}
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
