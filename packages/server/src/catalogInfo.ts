import { ARCHETYPES, catalog, EFFECTS } from "@interactive-displays/core";
import { themeManifests } from "@interactive-displays/themes/manifest";
import { z } from "zod";

export const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

// What a screen can be made of: every widget with its props as JSON Schema, the layouts and effects, and each
// theme's layouts, variants and decor. The editor's REST catalog and MCP's get_catalog both serve this.
export const catalogInfo = () => ({
  widgets: [...catalog.values()].map((definition) => ({
    kind: definition.kind,
    label: definition.label,
    category: definition.category,
    description: definition.description,
    props: jsonSchema(definition.props),
    example: definition.example,
  })),
  archetypes: ARCHETYPES,
  effects: EFFECTS,
  themes: [...themeManifests.values()].map((theme) => ({
    id: theme.id,
    name: theme.name,
    description: theme.description,
    archetypes: theme.archetypes,
    variants: Object.fromEntries(Object.entries(theme.variants).map(([id, variant]) => [id, variant.name])),
    decor: theme.decor.map((definition) => ({
      kind: definition.kind,
      label: definition.label,
      description: definition.description,
      props: jsonSchema(definition.props),
      example: definition.example,
    })),
  })),
});
