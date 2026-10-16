import { ARCHETYPE_IDS, ARCHETYPES, EFFECTS, type Effect, SLOTS, type SlotName, type WidgetKind, widgets } from "@interactive-displays/core";
import { getThemeManifest, themeManifests } from "@interactive-displays/themes/manifest";
import { type CSSProperties, type ReactNode, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { SlotProvider } from "../runtime/context.ts";
import { ScreenView } from "../runtime/ScreenView.tsx";
import { decorSample, frameSample, widgetSample } from "./samples.ts";
import "./gallery.css";

const isEffect = (value: string | null): value is Effect => EFFECTS.some((effect) => effect === value);

// Roughly how big each slot is on a real display, in screen units (--u). Widget tiles share one scale, so a
// nav button looks the way it would sit in a frame rather than blown up to fill a tile.
const SLOT_UNITS: Record<SlotName, [width: number, height: number]> = {
  title: [120, 12],
  nav: [21, 8.5],
  toolbar: [30, 8],
  main: [100, 56],
  aside: [40, 30],
  status: [120, 5],
};

const Tile = ({
  label,
  aspect,
  units,
  children,
}: {
  label: string;
  aspect: string;
  units?: number;
  children: ReactNode;
}) => (
  <figure className="gallery__tile" style={units ? ({ "--tile-units": units } as CSSProperties) : undefined}>
    <div className={units ? "gallery__preview gallery__preview--scaled" : "gallery__preview"} style={{ aspectRatio: aspect }}>
      {children}
    </div>
    <figcaption className="gallery__caption">{label}</figcaption>
  </figure>
);

const Select = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => (
  <label className="gallery__control">
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

// Every frame, widget and decor piece in one theme, variant and state effect. Designers check a theme
// here; the contract tests check the same matrix automatically.
export const GalleryPage = () => {
  const [params, setParams] = useSearchParams();
  const theme = getThemeManifest(params.get("theme") ?? "lcars");
  const variantParam = params.get("variant") ?? "";
  const variant = Object.hasOwn(theme.variants, variantParam) ? variantParam : "";
  const effectParam = params.get("effect");
  const effect: Effect = isEffect(effectParam) ? effectParam : "none";

  // Builds on the last params asked for, not this render's: two quick changes in a row must both stick.
  const latest = useRef(params);
  const seen = useRef(params.toString());
  if (params.toString() !== seen.current) {
    seen.current = params.toString();
    latest.current = params;
  }
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(latest.current);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "theme") next.delete("variant");
    latest.current = next;
    setParams(next, { replace: true });
  };

  const view = { themeId: theme.id, variant: variant || undefined, effect, embedded: true } as const;

  return (
    <div className="gallery">
      <header className="gallery__header">
        <h1 className="gallery__title">Gallery</h1>
        <Select
          label="Theme"
          value={theme.id}
          options={[...themeManifests.values()].map((manifest) => ({ value: manifest.id, label: manifest.name }))}
          onChange={(value) => update("theme", value)}
        />
        <Select
          label="Variant"
          value={variant}
          options={[
            { value: "", label: "Default" },
            ...Object.entries(theme.variants).map(([id, definition]) => ({ value: id, label: definition.name })),
          ]}
          onChange={(value) => update("variant", value)}
        />
        <Select
          label="Effect"
          value={effect}
          options={EFFECTS.map((value) => ({ value, label: value }))}
          onChange={(value) => update("effect", value === "none" ? "" : value)}
        />
      </header>

      <section className="gallery__section" aria-labelledby="gallery-frames">
        <h2 id="gallery-frames">Frames</h2>
        <div className="gallery__grid gallery__grid--wide">
          {ARCHETYPE_IDS.map((archetype) => (
            <Tile key={archetype} label={ARCHETYPES[archetype].label} aspect="16 / 9">
              <ScreenView screen={frameSample(archetype)} {...view} />
            </Tile>
          ))}
        </div>
      </section>

      <section className="gallery__section" aria-labelledby="gallery-widgets">
        <h2 id="gallery-widgets">Widgets by slot</h2>
        {(Object.keys(widgets) as WidgetKind[]).map((kind) => (
          <div key={kind} className="gallery__row">
            <h3 className="gallery__row-title">{widgets[kind].label}</h3>
            <div className="gallery__strip">
              {SLOTS.map((slot) => (
                <Tile
                  key={slot}
                  label={slot}
                  aspect={`${SLOT_UNITS[slot][0]} / ${SLOT_UNITS[slot][1]}`}
                  units={SLOT_UNITS[slot][0]}
                >
                  <SlotProvider value={slot}>
                    <ScreenView screen={widgetSample(kind)} {...view} />
                  </SlotProvider>
                </Tile>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="gallery__section" aria-labelledby="gallery-decor">
        <h2 id="gallery-decor">Decor</h2>
        {theme.decor.length === 0 ? (
          <p className="gallery__empty">{theme.name} has no decor.</p>
        ) : (
          <div className="gallery__grid">
            {theme.decor.map((definition) => (
              <Tile key={definition.kind} label={definition.label} aspect="4 / 3">
                <ScreenView screen={decorSample(definition)} {...view} />
              </Tile>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
