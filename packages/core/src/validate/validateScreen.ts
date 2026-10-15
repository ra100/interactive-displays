import type { z } from "zod";
import type { DecorCatalog } from "../catalog/defineDecor.ts";
import type { Catalog } from "../catalog/defineWidget.ts";
import { archetypeSlots, isArchetype } from "../schema/archetypes.ts";
import type { ChildEntry, ContainerNode, Node } from "../schema/node.ts";
import { migrateScreen } from "../migrate/migrateScreen.ts";
import { type Screen, ScreenSchema } from "../schema/screen.ts";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

type Path = readonly PropertyKey[];

export const formatPath = (path: Path): string => path.map(String).join(".");

const toIssues = (error: z.ZodError, prefix: Path = []): ValidationIssue[] =>
  error.issues.map((issue) => ({
    path: formatPath([...prefix, ...issue.path]),
    message: issue.message,
  }));

// Checks that need the parent's layout: slots exist in the archetype, grid areas fit the tracks.
const placementIssues = (container: ContainerNode, child: ChildEntry, path: Path): ValidationIssue[] => {
  const { layout } = container;
  const issues: ValidationIssue[] = [];

  if (layout.kind === "frame") {
    if (!child.slot) {
      issues.push({ path: formatPath([...path, "slot"]), message: "Children of a frame need a slot" });
    } else if (isArchetype(layout.archetype) && !archetypeSlots(layout.archetype).includes(child.slot)) {
      issues.push({
        path: formatPath([...path, "slot"]),
        message: `Archetype "${layout.archetype}" has no slot "${child.slot}"`,
      });
    }
  }

  if (layout.kind === "grid" && child.area) {
    const { col, row, colSpan = 1, rowSpan = 1 } = child.area;
    if (col + colSpan - 1 > layout.columns.length || row + rowSpan - 1 > layout.rows.length) {
      issues.push({ path: formatPath([...path, "area"]), message: "Grid area is outside the grid" });
    }
  }

  return issues;
};

// Full document check, after upgrading an older document to the current version: the schema, unique ids,
// known archetypes and widget kinds, props (including per-state overrides) and placement. On success every
// widget and known decor node has its prop defaults filled in.
export const validateScreen = (input: unknown, catalog: Catalog, decor?: DecorCatalog): ValidationResult<Screen> => {
  const parsed = ScreenSchema.safeParse(migrateScreen(input));
  if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  const visit = (node: Node, path: Path): Node => {
    if (seen.has(node.id)) {
      issues.push({ path: formatPath([...path, "id"]), message: `Duplicate node id "${node.id}"` });
    }
    seen.add(node.id);

    if (node.type === "container") {
      if (node.layout.kind === "frame" && !isArchetype(node.layout.archetype)) {
        issues.push({
          path: formatPath([...path, "layout", "archetype"]),
          message: `Unknown archetype "${node.layout.archetype}"`,
        });
      }
      return {
        ...node,
        children: node.children.map((child, index) => {
          const childPath = [...path, "children", index];
          issues.push(...placementIssues(node, child, childPath));
          return { ...child, node: visit(child.node, [...childPath, "node"]) };
        }),
      };
    }

    if (node.type === "decor") {
      // Decor of a theme that is not installed is kept (and hidden), so a screen survives theme changes.
      const definition = decor?.get(node.kind);
      if (!definition) return node;
      const props = definition.props.safeParse(node.props);
      if (!props.success) {
        issues.push(...toIssues(props.error, [...path, "props"]));
        return node;
      }
      return { ...node, props: props.data };
    }

    const definition = catalog.get(node.kind);
    if (!definition) {
      issues.push({ path: formatPath([...path, "kind"]), message: `Unknown widget kind "${node.kind}"` });
      return node;
    }

    const props = definition.props.safeParse(node.props);
    if (!props.success) {
      issues.push(...toIssues(props.error, [...path, "props"]));
      return node;
    }

    node.when?.forEach((override, index) => {
      if (!override.props) return;
      const merged = definition.props.safeParse({ ...node.props, ...override.props });
      if (!merged.success) issues.push(...toIssues(merged.error, [...path, "when", index, "props"]));
    });

    const bindable: readonly string[] = definition.bindable ?? [];
    for (const prop of Object.keys(node.bind ?? {})) {
      if (!bindable.includes(prop)) {
        issues.push({
          path: formatPath([...path, "bind", prop]),
          message: bindable.length > 0
            ? `"${prop}" cannot follow a live value; ${node.kind} can bind ${bindable.join(", ")}`
            : `${node.kind} has no props that can follow a live value`,
        });
      }
    }
    if (node.actions && node.actions.length > 0 && !definition.interactive) {
      issues.push({ path: formatPath([...path, "actions"]), message: `${node.kind} is not a control and cannot have actions` });
    }

    return { ...node, props: props.data };
  };

  const root = visit(parsed.data.root, ["root"]);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { ...parsed.data, root } };
};
