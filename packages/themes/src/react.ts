import type { ComponentType } from "react";
import { baseRenderers } from "./base/renderers.ts";
import type { AnyDecorRenderer, FrameRenderer, ThemeRenderers, WidgetRendererProps } from "./contract.ts";
import { lcarsRenderers } from "./lcars/renderers.ts";
import "./tones.css";

export type {
  AnyDecorRenderer,
  FrameRenderer,
  FrameRendererProps,
  ThemeRenderers,
  WidgetRendererProps,
} from "./contract.ts";

// Browser entry point: renderers, frames and decor. Never import this from the server.
const themeRenderers: ReadonlyMap<string, ThemeRenderers> = new Map([
  [baseRenderers.id, baseRenderers],
  [lcarsRenderers.id, lcarsRenderers],
]);

type AnyWidgetRenderer = ComponentType<WidgetRendererProps<Record<string, unknown>>>;

const lookup = (record: Partial<Record<string, unknown>>, key: string): unknown =>
  Object.hasOwn(record, key) ? record[key] : undefined;

// Theme renderer first, then base. Props are validated against the catalog before rendering,
// which is what makes erasing the per-kind prop type here safe.
export const resolveWidgetRenderer = (themeId: string, kind: string): AnyWidgetRenderer | undefined =>
  (lookup(themeRenderers.get(themeId)?.widgets ?? {}, kind) ?? lookup(baseRenderers.widgets, kind)) as
    | AnyWidgetRenderer
    | undefined;

export const resolveFrameRenderer = (themeId: string, archetype: string): FrameRenderer | undefined =>
  (lookup(themeRenderers.get(themeId)?.frames ?? {}, archetype) ?? lookup(baseRenderers.frames, archetype)) as
    | FrameRenderer
    | undefined;

// Decor belongs to one theme ("lcars.elbow") and is hidden everywhere else.
export const resolveDecorRenderer = (themeId: string, kind: string): AnyDecorRenderer | undefined =>
  kind.startsWith(`${themeId}.`) ? (lookup(themeRenderers.get(themeId)?.decor ?? {}, kind) as AnyDecorRenderer | undefined) : undefined;
