import type { Show } from "@interactive-displays/core";
import { getThemeManifest, themeManifests } from "@interactive-displays/themes/manifest";
import { ScaleSelect } from "./ScaleSelect.tsx";

// The show's look: every display redraws in the theme and variant picked here. Screens keep their meaning, so
// re-skinning a show mid-prep is safe; decor of another theme is drawn by a stand-in or hidden. Size scales
// every part on every display (a display can keep a size of its own).
export const LookPicker = ({
  theme,
  scale,
  onChange,
  onScale,
}: {
  theme: Show["theme"];
  scale: number;
  onChange: (theme: { id: string; variant?: string }) => void;
  onScale: (scale: number) => void;
}) => {
  const variants = Object.entries(getThemeManifest(theme.id).variants);
  return (
    <div className="look-picker">
      <label className="tool-field">
        <span className="tool-label">Theme</span>
        <select className="tool-select" value={theme.id} onChange={(event) => onChange({ id: event.target.value })}>
          {[...themeManifests.values()].map((each) => (
            <option key={each.id} value={each.id}>
              {each.name}
            </option>
          ))}
        </select>
      </label>
      <label className="tool-field">
        <span className="tool-label">Variant</span>
        <select
          className="tool-select"
          value={theme.variant ?? ""}
          disabled={variants.length === 0}
          onChange={(event) => onChange(event.target.value ? { id: theme.id, variant: event.target.value } : { id: theme.id })}
        >
          <option value="">Default</option>
          {variants.map(([id, variant]) => (
            <option key={id} value={id}>
              {variant.name}
            </option>
          ))}
        </select>
      </label>
      <ScaleSelect label="Size" value={scale} onChange={(next) => next !== null && onScale(next)} />
    </div>
  );
};
