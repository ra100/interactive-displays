import type { WidgetRendererProps, ThemeRenderers } from "./contract.ts";
import { baseRenderers } from "./base/renderers.ts";
import type { ComponentType } from "react";
import "./tones.css";

export type { ThemeRenderers, WidgetRendererProps } from "./contract.ts";

// Browser entry point: renderers, frames and decor. Never import this from the server.
const themeRenderers: ReadonlyMap<string, ThemeRenderers> = new Map([[baseRenderers.id, baseRenderers]]);

type AnyWidgetRenderer = ComponentType<WidgetRendererProps<Record<string, unknown>>>;

// Theme renderer first, then base. Props are validated against the catalog before rendering,
// which is what makes erasing the per-kind prop type here safe.
export const resolveWidgetRenderer = (themeId: string, kind: string): AnyWidgetRenderer | undefined => {
  const widgets: Partial<Record<string, unknown>> = themeRenderers.get(themeId)?.widgets ?? {};
  const fallback: Partial<Record<string, unknown>> = baseRenderers.widgets;
  return (widgets[kind] ?? fallback[kind]) as AnyWidgetRenderer | undefined;
};
