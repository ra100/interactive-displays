import type { Show } from "@interactive-displays/core";
import { getThemeManifest, themeManifests } from "@interactive-displays/themes/manifest";

// The show's look: every display redraws in the theme and variant picked here. Screens keep their meaning, so
// re-skinning a show mid-prep is safe; decor of another theme is drawn by a stand-in or hidden.
export const LookPicker = ({ theme, onChange }: { theme: Show["theme"]; onChange: (theme: { id: string; variant?: string }) => void }) => {
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
    </div>
  );
};
