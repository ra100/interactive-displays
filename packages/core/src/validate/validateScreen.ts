import type { z } from "zod";
import type { Catalog } from "../catalog/defineWidget.ts";
import type { Node } from "../schema/node.ts";
import { type Screen, ScreenSchema } from "../schema/screen.ts";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

const formatPath = (path: readonly PropertyKey[]): string => path.map(String).join(".");

const toIssues = (error: z.ZodError, prefix: readonly PropertyKey[] = []): ValidationIssue[] =>
  error.issues.map((issue) => ({
    path: formatPath([...prefix, ...issue.path]),
    message: issue.message,
  }));

// Full document check: the schema, unique node ids, known widget kinds and each widget's props.
// On success the returned screen has every widget's prop defaults filled in.
export const validateScreen = (input: unknown, catalog: Catalog): ValidationResult<Screen> => {
  const parsed = ScreenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: toIssues(parsed.error) };

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  const visit = (node: Node, path: readonly PropertyKey[]): Node => {
    if (seen.has(node.id)) {
      issues.push({ path: formatPath([...path, "id"]), message: `Duplicate node id "${node.id}"` });
    }
    seen.add(node.id);

    if (node.type === "container") {
      return {
        ...node,
        children: node.children.map((child, index) => ({
          ...child,
          node: visit(child.node, [...path, "children", index, "node"]),
        })),
      };
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
    return { ...node, props: props.data };
  };

  const root = visit(parsed.data.root, ["root"]);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { ...parsed.data, root } };
};
