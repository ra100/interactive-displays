import type {
  ArchetypeId,
  DecorDefinition,
  DecorProps,
  SlotName,
  WidgetKind,
  WidgetPropsOf,
} from "@interactive-displays/core";
import type { ComponentType, ReactNode } from "react";

// What every widget renderer receives. Props are already validated and have their defaults.
// `slot` is the frame slot the widget sits in (nav, toolbar, main…), so a theme can draw a button
// as a sidebar block in nav and as a pill in a toolbar.
export interface WidgetRendererProps<Props> {
  props: Props;
  nodeId: string;
  slot?: SlotName;
}

export type WidgetRenderer<Kind extends WidgetKind> = ComponentType<WidgetRendererProps<WidgetPropsOf<Kind>>>;

export type WidgetRendererMap = { [Kind in WidgetKind]: WidgetRenderer<Kind> };

// A frame draws a theme's chrome for an archetype and places the already-rendered slot contents.
export interface FrameRendererProps {
  archetype: ArchetypeId;
  nodeId: string;
  slots: Partial<Record<SlotName, ReactNode>>;
}

export type FrameRenderer = ComponentType<FrameRendererProps>;

export interface DecorRendererProps<Props> {
  props: Props;
  nodeId: string;
}

export type AnyDecorRenderer = ComponentType<DecorRendererProps<Record<string, unknown>>>;

// The browser half of a theme pack. Missing widgets and frames fall back to the base theme;
// decor only renders in its own theme.
export interface ThemeRenderers {
  id: string;
  widgets: Partial<WidgetRendererMap>;
  frames: Partial<Record<ArchetypeId, FrameRenderer>>;
  decor: Readonly<Record<string, AnyDecorRenderer>>;
}

// The base theme must render every widget and every archetype; the compiler enforces it.
export interface BaseThemeRenderers extends ThemeRenderers {
  widgets: WidgetRendererMap;
  frames: Record<ArchetypeId, FrameRenderer>;
}

export const defineRenderers = <Renderers extends ThemeRenderers>(renderers: Renderers): Renderers => renderers;

// Pairs a decor definition with its renderer, typed by the definition's props.
export const decorRenderer = <Definition extends DecorDefinition>(
  definition: Definition,
  component: ComponentType<DecorRendererProps<DecorProps<Definition>>>,
): Record<string, AnyDecorRenderer> => ({ [definition.kind]: component as unknown as AnyDecorRenderer });
