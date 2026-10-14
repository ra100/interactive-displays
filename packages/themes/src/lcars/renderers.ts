import { decorRenderer, defineRenderers, type ThemeRenderers } from "../contract.ts";
import { bar, bracket, cap, elbow } from "./decor.ts";
import { LcarsButton } from "./LcarsButton.tsx";
import { LcarsBar, LcarsBracket, LcarsCap, LcarsElbow } from "./LcarsDecor.tsx";
import { LcarsDashboardFrame, LcarsHeaderMainFrame, LcarsSidebarFrame } from "./LcarsFrames.tsx";
import { LcarsText } from "./LcarsText.tsx";
import { LcarsTitle } from "./LcarsTitle.tsx";
import "@fontsource/antonio/latin-400.css";
import "@fontsource/antonio/latin-700.css";
import "./lcars.css";

export const lcarsRenderers: ThemeRenderers = defineRenderers({
  id: "lcars",
  widgets: {
    title: LcarsTitle,
    text: LcarsText,
    button: LcarsButton,
  },
  frames: {
    sidebar: LcarsSidebarFrame,
    "header-main": LcarsHeaderMainFrame,
    dashboard: LcarsDashboardFrame,
  },
  decor: {
    ...decorRenderer(elbow, LcarsElbow),
    ...decorRenderer(bar, LcarsBar),
    ...decorRenderer(cap, LcarsCap),
    ...decorRenderer(bracket, LcarsBracket),
  },
});
