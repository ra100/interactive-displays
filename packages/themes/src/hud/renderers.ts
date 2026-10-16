import { decorRenderer, defineRenderers, type ThemeRenderers } from "../contract.ts";
import { arcs, corners, reticle, scale } from "./decor.ts";
import { HudArcs, HudCorners, HudReticle, HudScale } from "./HudDecor.tsx";
import { HudConsoleFrame, HudDashboardFrame, HudHeaderMainFrame, HudPanelFrame, HudSidebarFrame, HudSplitFrame } from "./HudFrames.tsx";
import { HudAlertBanner, HudButton, HudGauge, HudReadout, HudStatusLight, HudText, HudTitle } from "./HudWidgets.tsx";
import "@fontsource/rajdhani/latin-400.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/share-tech-mono/latin-400.css";
import "./hud.css";
import "./instruments.css";

export const hudRenderers: ThemeRenderers = defineRenderers({
  id: "hud",
  widgets: {
    title: HudTitle,
    text: HudText,
    button: HudButton,
    readout: HudReadout,
    gauge: HudGauge,
    "status-light": HudStatusLight,
    "alert-banner": HudAlertBanner,
  },
  frames: {
    sidebar: HudSidebarFrame,
    "header-main": HudHeaderMainFrame,
    dashboard: HudDashboardFrame,
    split: HudSplitFrame,
    console: HudConsoleFrame,
    panel: HudPanelFrame,
  },
  decor: {
    ...decorRenderer(reticle, HudReticle),
    ...decorRenderer(corners, HudCorners),
    ...decorRenderer(scale, HudScale),
    ...decorRenderer(arcs, HudArcs),
  },
});
