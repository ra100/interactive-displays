// Panel diagonals offered for a show or a display, in inches: tablets, monitors and the big 4K sets.
export const PANEL_STEPS = [10, 13, 24, 32, 43, 55, 65, 75, 80, 85, 90, 98, 100, 110] as const;

// Button heights offered, in centimetres on the panel: 1–2 cm is a comfortable fingertip.
export const BUTTON_STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

// A value set elsewhere (the API, an AI) that is not one of the steps still shows.
const withValue = (steps: readonly number[], value: number | undefined) =>
  value === undefined || steps.includes(value) ? steps : [...steps, value].sort((a, b) => a - b);

// How big the panel is. With `inherited`, an empty choice means "the show's panel" and reports null.
export const PanelSelect = ({
  value,
  inherited,
  onChange,
}: {
  value: number | undefined;
  inherited?: number;
  onChange: (inches: number | null) => void;
}) => (
  <label className="tool-field">
    <span className="tool-label">Panel</span>
    <select
      className="tool-select"
      value={value === undefined ? "" : String(value)}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
    >
      {inherited === undefined ? null : <option value="">Show panel ({inherited}″)</option>}
      {withValue(PANEL_STEPS, value).map((step) => (
        <option key={step} value={String(step)}>
          {step}″
        </option>
      ))}
    </select>
  </label>
);

// How tall buttons are on every panel, in real centimetres.
export const ButtonSizeSelect = ({ value, onChange }: { value: number; onChange: (cm: number) => void }) => (
  <label className="tool-field">
    <span className="tool-label">Buttons</span>
    <select className="tool-select" value={String(value)} onChange={(event) => onChange(Number(event.target.value))}>
      {withValue(BUTTON_STEPS, value).map((step) => (
        <option key={step} value={String(step)}>
          {step} cm
        </option>
      ))}
    </select>
  </label>
);
