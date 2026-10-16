import { type BaseThemeRenderers, defineRenderers } from "../contract.ts";
import { BaseAlertBanner } from "./BaseAlertBanner.tsx";
import { BaseBarGraph, BaseDataCascade, BaseSparkline, BaseStatusMatrix } from "./BaseAmbient.tsx";
import { BaseButton } from "./BaseButton.tsx";
import { BaseButtonGroup, BaseSlider, BaseToggle } from "./BaseControls.tsx";
import { BaseClock, BaseDataGrid, BaseGauge, BaseReadout, BaseStatusLight } from "./BaseData.tsx";
import { BaseFrame } from "./BaseFrame.tsx";
import { BaseImage } from "./BaseImage.tsx";
import { BasePlaceholder } from "./BasePlaceholder.tsx";
import { BaseText } from "./BaseText.tsx";
import { BaseTitle } from "./BaseTitle.tsx";
import { BaseVideo } from "./BaseVideo.tsx";
import "./base.css";

export const baseRenderers: BaseThemeRenderers = defineRenderers({
  id: "base",
  widgets: {
    title: BaseTitle,
    text: BaseText,
    button: BaseButton,
    "button-group": BaseButtonGroup,
    toggle: BaseToggle,
    slider: BaseSlider,
    readout: BaseReadout,
    gauge: BaseGauge,
    "bar-graph": BaseBarGraph,
    sparkline: BaseSparkline,
    "status-light": BaseStatusLight,
    "status-matrix": BaseStatusMatrix,
    "data-cascade": BaseDataCascade,
    "data-grid": BaseDataGrid,
    clock: BaseClock,
    "alert-banner": BaseAlertBanner,
    image: BaseImage,
    video: BaseVideo,
    placeholder: BasePlaceholder,
  },
  frames: {
    sidebar: BaseFrame,
    "header-main": BaseFrame,
    dashboard: BaseFrame,
    split: BaseFrame,
    console: BaseFrame,
  },
  decor: {},
});
