import type { FrameRendererProps } from "../contract.ts";

/*
 * LCARS chrome for each archetype. The frames only draw elbows, bars and caps and place the slot
 * contents; sizes come from --u (1% of the display's shorter side), so the sweep keeps its proportions
 * on any display.
 */

const Elbow = ({ corner, tone }: { corner: "tl" | "bl"; tone: string }) => (
  <div className="lcars-frame__elbow" data-corner={corner} data-tone={tone} aria-hidden="true">
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
