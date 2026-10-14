import type { z } from "zod";

export type WidgetCategory = "text" | "control" | "data" | "media" | "alert" | "meta";

export interface WidgetDefinition<Props extends z.ZodType = z.ZodType> {
  readonly kind: string;
  readonly label: string;
  readonly category: WidgetCategory;
  // One sentence for editors and AI: what the widget is for, not how it looks.
  readonly description: string;
  readonly props: Props;
}

export type AnyWidgetDefinition = WidgetDefinition<z.ZodType<Record<string, unknown>>>;

export type WidgetProps<Definition extends WidgetDefinition> = z.output<Definition["props"]>;

export const defineWidget = <Props extends z.ZodType<Record<string, unknown>>>(
  definition: WidgetDefinition<Props>,
): WidgetDefinition<Props> => definition;

export type Catalog = ReadonlyMap<string, AnyWidgetDefinition>;

export const createCatalog = (definitions: readonly AnyWidgetDefinition[]): Catalog => {
  const catalog = new Map<string, AnyWidgetDefinition>();
  for (const definition of definitions) {
    if (catalog.has(definition.kind)) {
      throw new Error(`Duplicate widget kind "${definition.kind}"`);
    }
    catalog.set(definition.kind, definition);
  }
  return catalog;
};
