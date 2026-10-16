import type { FrameRendererProps } from "../contract.ts";

/*
 * LCARS chrome for each archetype. The frames only draw elbows, bars and caps and place the slot
 * contents; sizes come from --u (1% of the display's shorter side), so the sweep keeps its proportions
 * on any display.
 */

const Elbow = ({ corner, tone, part }: { corner: "tl" | "bl"; tone: string; part?: string }) => (
  <div className="lcars-frame__elbow" data-corner={corner} data-part={part} data-tone={tone} aria-hidden="true">
    <div className="lcars-frame__elbow-inner" />
  </div>
);

export const LcarsSidebarFrame = ({ slots }: FrameRendererProps) => (
  <div className="lcars-frame lcars-frame--sidebar">
    <Elbow corner="tl" tone="neutral" />
    <div className="lcars-frame__title">{slots.title}</div>
    <div className="lcars-frame__nav">
      {slots.nav}
      <div className="lcars-frame__fill" data-tone="secondary" aria-hidden="true" />
    </div>
    <div className="lcars-frame__main">{slots.main}</div>
    <Elbow corner="bl" tone="accent" />
    <div className="lcars-frame__status">{slots.status}</div>
  </div>
);

export const LcarsHeaderMainFrame = ({ slots }: FrameRendererProps) => (
  <div className="lcars-frame lcars-frame--header-main">
    <Elbow corner="tl" tone="primary" />
    <div className="lcars-frame__title">{slots.title}</div>
    <div className="lcars-frame__arm" data-tone="info" aria-hidden="true" />
    <div className="lcars-frame__toolbar">{slots.toolbar}</div>
    <div className="lcars-frame__arm lcars-frame__arm--main" data-tone="neutral" aria-hidden="true" />
    <div className="lcars-frame__main">{slots.main}</div>
    <Elbow corner="bl" tone="primary" />
    <div className="lcars-frame__status">{slots.status}</div>
  </div>
);

export const LcarsDashboardFrame = ({ slots }: FrameRendererProps) => (
  <div className="lcars-frame lcars-frame--dashboard">
    <div className="lcars-frame__header">
      <div className="lcars-frame__cap" data-side="left" data-tone="primary" aria-hidden="true" />
      <div className="lcars-frame__title">{slots.title}</div>
      <div className="lcars-frame__rail" data-tone="secondary" aria-hidden="true" />
      <div className="lcars-frame__cap" data-side="right" data-tone="primary" aria-hidden="true" />
    </div>
    <div className="lcars-frame__main">{slots.main}</div>
    <div className="lcars-frame__divider" data-tone="accent" aria-hidden="true" />
    <div className="lcars-frame__aside">{slots.aside}</div>
    <div className="lcars-frame__footer">
      <div className="lcars-frame__cap" data-side="left" data-tone="neutral" aria-hidden="true" />
      <div className="lcars-frame__rail" data-tone="neutral" aria-hidden="true" />
      <div className="lcars-frame__status">{slots.status}</div>
      <div className="lcars-frame__cap" data-side="right" data-tone="neutral" aria-hidden="true" />
    </div>
  </div>
);

// A run of differently coloured blocks that continues an elbow's bar, as TNG frames break their bars up.
const Segments = ({ part, tones }: { part: string; tones: readonly string[] }) => (
  <div className="lcars-frame__segments" data-part={part} aria-hidden="true">
    {tones.map((tone, index) => (
      <span key={index} className="lcars-frame__segment" data-tone={tone} />
    ))}
  </div>
);

/*
 * The classic double frame (TNG engineering, the Okuda "split"): an upper frame that sweeps down into a bar, a
 * gap, and a lower frame that sweeps up from a bar into the navigation column. The upper frame holds the aside.
 */
export const LcarsSplitFrame = ({ slots }: FrameRendererProps) => (
  <div className="lcars-frame lcars-frame--split">
    <div className="lcars-frame__column" data-part="upper" aria-hidden="true">
      <span className="lcars-frame__fill" data-tone="accent" />
      <span className="lcars-frame__fill" data-tone="primary" />
    </div>
    <div className="lcars-frame__title">{slots.title}</div>
    <div className="lcars-frame__aside">{slots.aside}</div>
    <Elbow corner="bl" tone="primary" part="upper" />
    <Segments part="upper" tones={["primary", "secondary", "neutral", "primary"]} />
    <Elbow corner="tl" tone="info" part="lower" />
    <Segments part="lower" tones={["info", "accent", "info", "secondary"]} />
    <div className="lcars-frame__nav">
      {slots.nav}
      <div className="lcars-frame__fill" data-tone="secondary" aria-hidden="true" />
    </div>
    <div className="lcars-frame__main">{slots.main}</div>
    <Elbow corner="bl" tone="neutral" part="foot" />
    <div className="lcars-frame__status">{slots.status}</div>
  </div>
);

/*
 * A full console (Voyager and later): the sweep and navigation column on the left, a row of tools under the
 * title, and a side panel on the right behind a capped divider.
 */
export const LcarsConsoleFrame = ({ slots }: FrameRendererProps) => (
  <div className="lcars-frame lcars-frame--console">
    <Elbow corner="tl" tone="accent" />
    <div className="lcars-frame__title">{slots.title}</div>
    <div className="lcars-frame__nav">
      {slots.nav}
      <div className="lcars-frame__fill" data-tone="neutral" aria-hidden="true" />
    </div>
    <div className="lcars-frame__toolbar">{slots.toolbar}</div>
    <div className="lcars-frame__main">{slots.main}</div>
    <div className="lcars-frame__divider" data-tone="info" aria-hidden="true" />
    <div className="lcars-frame__aside">{slots.aside}</div>
    <Elbow corner="bl" tone="primary" />
    <div className="lcars-frame__status">{slots.status}</div>
  </div>
);
