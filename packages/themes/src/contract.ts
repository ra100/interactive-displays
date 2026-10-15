import type {
  ArchetypeId,
  DecorDefinition,
  DecorProps,
  SlotName,
  WidgetKind,
  WidgetPropsOf,
} from "@interactive-displays/core";
import type { ComponentType, ReactNode } from "react";

// What every widget renderer receives. Props are already validated, have their defaults and carry their
// live values (bindings are resolved before the renderer sees them).
// `slot` is the frame slot the widget sits in (nav, toolbar, main…), so a theme can draw a button
// as a sidebar block in nav and as a pill in a toolbar.
// `onUse` is for controls: call it when the actor uses the control, with the control's value (the chosen
// option, the slider position, 1 or 0 for a toggle). The runtime plays the press sound and runs the actions.
// A control that moves continuously (a slider being dragged) passes `moving` for the values on the way, which
// only update shared values, and calls it once more without it where the actor lets go.
// `bound` says the control's value follows a live value: after a use it shows what the show says again
// (useControlValue does this), rather than keeping its own.
export interface WidgetRendererProps<Props> {
  props: Props;
  nodeId: string;
  slot?: SlotName;
  onUse?: (value?: number, moving?: boolean) => void;
  bound?: boolean;
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
