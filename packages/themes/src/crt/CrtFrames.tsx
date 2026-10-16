import type { ReactNode } from "react";
import type { FrameRendererProps } from "../contract.ts";
import { panelLook } from "../panel.ts";

/*
 * Terminal chrome: the title as an inverse bar, content in boxes drawn with double or single rules, and the
 * status line as a command prompt with a blinking cursor. Everything is sized in --u.
 */

const Box = ({ area, line, tone, children }: { area: string; line: "double" | "single" | "dashed"; tone: string; children: ReactNode }) => (
  <div className="crt-frame__box" data-area={area} data-line={line} data-tone={tone}>
    {children}
  </div>
);

const Title = ({ children }: { children: ReactNode }) => (
  <div className="crt-frame__title" data-tone="primary">
    {children}
  </div>
);

const Status = ({ children }: { children: ReactNode }) => (
  <div className="crt-frame__status" data-tone="secondary">
    <span className="crt-frame__prompt" aria-hidden="true">
      &gt;
    </span>
    <div className="crt-frame__status-text">{children}</div>
    <span className="crt-frame__cursor" aria-hidden="true" />
  </div>
);

export const CrtSidebarFrame = ({ slots }: FrameRendererProps) => (
  <div className="crt-frame crt-frame--sidebar">
    <Title>{slots.title}</Title>
    <Box area="nav" line="double" tone="primary">
      {slots.nav}
    </Box>
    <Box area="main" line="single" tone="neutral">
      {slots.main}
    </Box>
    <Status>{slots.status}</Status>
  </div>
);

export const CrtHeaderMainFrame = ({ slots }: FrameRendererProps) => (
  <div className="crt-frame crt-frame--header-main">
    <Title>{slots.title}</Title>
    <Box area="toolbar" line="dashed" tone="secondary">
      {slots.toolbar}
    </Box>
    <Box area="main" line="double" tone="neutral">
      {slots.main}
    </Box>
    <Status>{slots.status}</Status>
  </div>
);

export const CrtSplitFrame = ({ slots }: FrameRendererProps) => (
  <div className="crt-frame crt-frame--split">
    <Title>{slots.title}</Title>
    <Box area="aside" line="single" tone="secondary">
      {slots.aside}
    </Box>
    <Box area="nav" line="double" tone="primary">
      {slots.nav}
    </Box>
    <Box area="main" line="double" tone="neutral">
      {slots.main}
    </Box>
    <Status>{slots.status}</Status>
  </div>
);

export const CrtConsoleFrame = ({ slots }: FrameRendererProps) => (
  <div className="crt-frame crt-frame--console">
    <Title>{slots.title}</Title>
    <Box area="nav" line="double" tone="primary">
      {slots.nav}
    </Box>
    <Box area="toolbar" line="dashed" tone="secondary">
      {slots.toolbar}
    </Box>
    <Box area="main" line="double" tone="neutral">
      {slots.main}
    </Box>
    <Box area="aside" line="single" tone="secondary">
      {slots.aside}
    </Box>
    <Status>{slots.status}</Status>
  </div>
);

export const CrtDashboardFrame = ({ slots }: FrameRendererProps) => (
  <div className="crt-frame crt-frame--dashboard">
    <Title>{slots.title}</Title>
    <Box area="main" line="double" tone="neutral">
      {slots.main}
    </Box>
    <Box area="aside" line="single" tone="secondary">
      {slots.aside}
    </Box>
    <Status>{slots.status}</Status>
  </div>
);

const PANEL_LINE = { sweep: "double", top: "single", bottom: "single", bracket: "single", rails: "double" } as const;

// A nested section: a ruled box with its title set into the top rule, as terminal screens frame a listing.
export const CrtPanelFrame = ({ nodeId, variant, slots }: FrameRendererProps) => {
  const look = panelLook(variant, nodeId);
  return (
    <div className="crt-panel" data-shape={look.shape} data-line={PANEL_LINE[look.shape]} data-tone={look.pick(1) > 0.6 ? "secondary" : "primary"}>
      <div className="crt-panel__title">{slots.title}</div>
      <div className="crt-panel__main">{slots.main}</div>
      {slots.status ? <div className="crt-panel__status">{slots.status}</div> : null}
    </div>
  );
};
