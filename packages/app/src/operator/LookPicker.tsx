import type { Show } from "@interactive-displays/core";
import { getThemeManifest, themeManifests } from "@interactive-displays/themes/manifest";
import { ButtonSizeSelect, PanelSelect } from "./PanelSelect.tsx";
import { ScaleSelect } from "./ScaleSelect.tsx";

// The show's look: every display redraws in the theme and variant picked here. Screens keep their meaning, so
// re-skinning a show mid-prep is safe; decor of another theme is drawn by a stand-in or hidden. Size scales
// every part on every display (a display can keep a size of its own); Panel and Buttons size buttons in real
// centimetres on the panels; Sounds plays another theme's sound pack.
export const LookPicker = ({
  theme,
  scale,
  panel,
  soundPack,
  onChange,
  onScale,
  onPanel,
  onSoundPack,
}: {
  theme: Show["theme"];
  scale: number;
  panel: Show["panel"];
  onPanel: (panel: Partial<Show["panel"]>) => void;
  soundPack: string | undefined;
  onChange: (theme: { id: string; variant?: string }) => void;
  onScale: (scale: number) => void;
  onSoundPack: (pack: string | null) => void;
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
      <PanelSelect value={panel.inches} onChange={(inches) => inches !== null && onPanel({ inches })} />
      <ButtonSizeSelect value={panel.buttonCm} onChange={(buttonCm) => onPanel({ buttonCm })} />
      <label className="tool-field">
        <span className="tool-label">Sounds</span>
        <select className="tool-select" value={soundPack ?? ""} onChange={(event) => onSoundPack(event.target.value || null)}>
          <option value="">The theme's own</option>
          {[...themeManifests.values()]
            .filter((each) => Object.keys(each.sounds).length > 0)
            .map((each) => (
              <option key={each.id} value={each.id}>
                {each.name}
              </option>
            ))}
        </select>
      </label>
    </div>
  );
};
