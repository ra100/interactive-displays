import { decorRenderer, defineRenderers, type ThemeRenderers } from "../contract.ts";
import { CrtBrackets, CrtLog, CrtRadar, CrtRule } from "./CrtDecor.tsx";
import { CrtConsoleFrame, CrtDashboardFrame, CrtHeaderMainFrame, CrtSidebarFrame, CrtSplitFrame } from "./CrtFrames.tsx";
import { CrtAlertBanner, CrtButton, CrtGauge, CrtReadout, CrtStatusLight, CrtText, CrtTitle } from "./CrtWidgets.tsx";
import { brackets, log, radar, rule } from "./decor.ts";
import "@fontsource/vt323/latin-400.css";
import "@fontsource/share-tech-mono/latin-400.css";
import "./crt.css";

export const crtRenderers: ThemeRenderers = defineRenderers({
  id: "crt",
  widgets: {
    title: CrtTitle,
    text: CrtText,
    button: CrtButton,
    readout: CrtReadout,
    gauge: CrtGauge,
    "status-light": CrtStatusLight,
    "alert-banner": CrtAlertBanner,
  },
  frames: {
    sidebar: CrtSidebarFrame,
    "header-main": CrtHeaderMainFrame,
    dashboard: CrtDashboardFrame,
    split: CrtSplitFrame,
    console: CrtConsoleFrame,
  },
  decor: {
    ...decorRenderer(rule, CrtRule),
    ...decorRenderer(brackets, CrtBrackets),
    ...decorRenderer(radar, CrtRadar),
    ...decorRenderer(log, CrtLog),
  },
});
