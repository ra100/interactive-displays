import type { ReactNode } from "react";
import type { FrameRendererProps } from "../contract.ts";
import { panelLook } from "../panel.ts";

/*
 * HUD chrome: a header strip with a thin rule and tick marks, content on glassy panels with chamfered corners
 * and corner ticks, and a status strip along the bottom. Lines are 1–2 px; everything else is sized in --u.
 */

const Panel = ({ area, tone, children }: { area: string; tone: string; children: ReactNode }) => (
  <div className="hud-frame__panel" data-area={area} data-tone={tone}>
    <span className="hud-frame__tick" data-corner="tl" aria-hidden="true" />
    <span className="hud-frame__tick" data-corner="br" aria-hidden="true" />
    {children}
  </div>
);

const Header = ({ children }: { children: ReactNode }) => (
  <div className="hud-frame__header" data-tone="primary">
    {children}
    <span className="hud-frame__rule" aria-hidden="true" />
  </div>
);

const Status = ({ children }: { children: ReactNode }) => (
  <div className="hud-frame__status" data-tone="secondary">
    <span className="hud-frame__pip" aria-hidden="true" />
    <div className="hud-frame__status-text">{children}</div>
    <span className="hud-frame__scale" aria-hidden="true" />
  </div>
);

export const HudSidebarFrame = ({ slots }: FrameRendererProps) => (
  <div className="hud-frame hud-frame--sidebar">
    <Header>{slots.title}</Header>
    <Panel area="nav" tone="primary">
      {slots.nav}
    </Panel>
    <Panel area="main" tone="neutral">
      {slots.main}
    </Panel>
    <Status>{slots.status}</Status>
  </div>
);

export const HudHeaderMainFrame = ({ slots }: FrameRendererProps) => (
  <div className="hud-frame hud-frame--header-main">
    <Header>{slots.title}</Header>
    <Panel area="toolbar" tone="secondary">
      {slots.toolbar}
    </Panel>
    <Panel area="main" tone="neutral">
      {slots.main}
    </Panel>
    <Status>{slots.status}</Status>
  </div>
);

export const HudSplitFrame = ({ slots }: FrameRendererProps) => (
  <div className="hud-frame hud-frame--split">
    <Header>{slots.title}</Header>
    <Panel area="aside" tone="secondary">
      {slots.aside}
    </Panel>
    <Panel area="nav" tone="primary">
      {slots.nav}
    </Panel>
    <Panel area="main" tone="neutral">
      {slots.main}
    </Panel>
    <Status>{slots.status}</Status>
  </div>
);

export const HudConsoleFrame = ({ slots }: FrameRendererProps) => (
  <div className="hud-frame hud-frame--console">
    <Header>{slots.title}</Header>
    <Panel area="nav" tone="primary">
      {slots.nav}
    </Panel>
    <Panel area="toolbar" tone="secondary">
      {slots.toolbar}
    </Panel>
    <Panel area="main" tone="neutral">
      {slots.main}
    </Panel>
    <Panel area="aside" tone="secondary">
      {slots.aside}
    </Panel>
    <Status>{slots.status}</Status>
  </div>
);

export const HudDashboardFrame = ({ slots }: FrameRendererProps) => (
  <div className="hud-frame hud-frame--dashboard">
    <Header>{slots.title}</Header>
    <Panel area="main" tone="neutral">
      {slots.main}
    </Panel>
    <Panel area="aside" tone="secondary">
      {slots.aside}
    </Panel>
    <Status>{slots.status}</Status>
  </div>
);

// A nested section: a small header with its rule over a glass body; the shape decides which corners carry ticks
// and whether the body is boxed, bracketed or ruled top and bottom.
export const HudPanelFrame = ({ nodeId, variant, slots }: FrameRendererProps) => {
  const look = panelLook(variant, nodeId);
  return (
    <div className="hud-panel" data-shape={look.shape} data-side={look.side} data-tone={look.pick(1) > 0.5 ? "primary" : "secondary"}>
      <div className="hud-panel__head">
        <div className="hud-panel__title">{slots.title}</div>
        <span className="hud-panel__rule" aria-hidden="true" />
      </div>
      <div className="hud-panel__body">
        <span className="hud-frame__tick" data-corner={look.side === "right" ? "tr" : "tl"} aria-hidden="true" />
        <span className="hud-frame__tick" data-corner={look.side === "right" ? "bl" : "br"} aria-hidden="true" />
        {slots.main}
      </div>
      {slots.status ? <div className="hud-panel__status">{slots.status}</div> : null}
    </div>
  );
};
