// Sizes offered for a show or a display. 100 % sizes parts to the display; a large 4K panel seen from a few
// metres usually wants 50–70 %.
export const SCALE_STEPS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5] as const;

const percent = (scale: number) => `${Math.round(scale * 100)}%`;

// A size picker. With `inherited`, an empty choice means "use the show's size" and reports null.
export const ScaleSelect = ({
  label,
  value,
  inherited,
  onChange,
}: {
  label: string;
  value: number | undefined;
  inherited?: number;
  onChange: (scale: number | null) => void;
}) => {
  // A value set elsewhere (the API, an AI) that is not one of the steps still shows.
  const steps = value === undefined || SCALE_STEPS.some((step) => step === value) ? SCALE_STEPS : [...SCALE_STEPS, value].sort((a, b) => a - b);
  return (
    <label className="tool-field">
      <span className="tool-label">{label}</span>
      <select
        className="tool-select"
        value={value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      >
        {inherited === undefined ? null : <option value="">Show size ({percent(inherited)})</option>}
        {steps.map((step) => (
          <option key={step} value={String(step)}>
            {percent(step)}
          </option>
        ))}
      </select>
    </label>
  );
};
