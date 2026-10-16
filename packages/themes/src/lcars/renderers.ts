import { decorRenderer, defineRenderers, type ThemeRenderers } from "../contract.ts";
import { bar, bracket, cap, elbow, scan, segments } from "./decor.ts";
import { LcarsButton } from "./LcarsButton.tsx";
import { LcarsButtonGroup } from "./LcarsControls.tsx";
import { LcarsAlertBanner, LcarsDataCascade, LcarsGauge, LcarsReadout } from "./LcarsData.tsx";
import { LcarsBar, LcarsBracket, LcarsCap, LcarsElbow, LcarsScan, LcarsSegments } from "./LcarsDecor.tsx";
import { LcarsConsoleFrame, LcarsDashboardFrame, LcarsHeaderMainFrame, LcarsSidebarFrame, LcarsSplitFrame } from "./LcarsFrames.tsx";
import { LcarsPanelFrame } from "./LcarsPanel.tsx";
import { LcarsText } from "./LcarsText.tsx";
import { LcarsTitle } from "./LcarsTitle.tsx";
import "./font.css";
import "./lcars.css";
import "./instruments.css";

export const lcarsRenderers: ThemeRenderers = defineRenderers({
  id: "lcars",
  widgets: {
    title: LcarsTitle,
    text: LcarsText,
    button: LcarsButton,
    "button-group": LcarsButtonGroup,
    readout: LcarsReadout,
    gauge: LcarsGauge,
    "data-cascade": LcarsDataCascade,
    "alert-banner": LcarsAlertBanner,
  },
  frames: {
    sidebar: LcarsSidebarFrame,
    "header-main": LcarsHeaderMainFrame,
    dashboard: LcarsDashboardFrame,
    split: LcarsSplitFrame,
    console: LcarsConsoleFrame,
    panel: LcarsPanelFrame,
  },
  decor: {
    ...decorRenderer(elbow, LcarsElbow),
    ...decorRenderer(bar, LcarsBar),
    ...decorRenderer(cap, LcarsCap),
    ...decorRenderer(bracket, LcarsBracket),
    ...decorRenderer(segments, LcarsSegments),
    ...decorRenderer(scan, LcarsScan),
  },
});
