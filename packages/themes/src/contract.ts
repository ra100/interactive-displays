import type { WidgetKind, WidgetPropsOf } from "@interactive-displays/core";
import type { ComponentType } from "react";

// What every widget renderer receives. Props are already validated and have their defaults.
export interface WidgetRendererProps<Props> {
  props: Props;
  nodeId: string;
}

export type WidgetRenderer<Kind extends WidgetKind> = ComponentType<WidgetRendererProps<WidgetPropsOf<Kind>>>;

export type WidgetRendererMap = { [Kind in WidgetKind]: WidgetRenderer<Kind> };

// The browser half of a theme pack. Missing widgets fall back to the base theme.
export interface ThemeRenderers {
  id: string;
  widgets: Partial<WidgetRendererMap>;
}

// The base theme must render every widget; the compiler enforces it.
export interface BaseThemeRenderers extends ThemeRenderers {
  widgets: WidgetRendererMap;
}

export const defineRenderers = <Renderers extends ThemeRenderers>(renderers: Renderers): Renderers =>
  renderers;
