import { alertBanner } from "./alertBanner.ts";
import { barGraph } from "./barGraph.ts";
import { button } from "./button.ts";
import { buttonGroup } from "./buttonGroup.ts";
import { clock } from "./clock.ts";
import { dataCascade } from "./dataCascade.ts";
import { dataGrid } from "./dataGrid.ts";
import { createCatalog, type WidgetProps } from "./defineWidget.ts";
import { gauge } from "./gauge.ts";
import { image } from "./image.ts";
import { placeholder } from "./placeholder.ts";
import { readout } from "./readout.ts";
import { slider } from "./slider.ts";
import { sparkline } from "./sparkline.ts";
import { statusLight } from "./statusLight.ts";
import { statusMatrix } from "./statusMatrix.ts";
import { text } from "./text.ts";
import { title } from "./title.ts";
import { toggle } from "./toggle.ts";
import { video } from "./video.ts";

// Adding a widget: one definition file here, its test, and an entry in this object.
export const widgets = {
  title,
  text,
  button,
  "button-group": buttonGroup,
  toggle,
  slider,
  readout,
  gauge,
  "bar-graph": barGraph,
  sparkline,
  "status-light": statusLight,
  "status-matrix": statusMatrix,
  "data-cascade": dataCascade,
  "data-grid": dataGrid,
  clock,
  "alert-banner": alertBanner,
  image,
  video,
  placeholder,
} as const;

export type WidgetKind = keyof typeof widgets;
export type WidgetPropsOf<Kind extends WidgetKind> = WidgetProps<(typeof widgets)[Kind]>;

export const catalog = createCatalog(Object.values(widgets));
