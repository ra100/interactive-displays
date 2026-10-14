import type { DecorCatalog } from "../catalog/defineDecor.ts";
import type { ContainerNode, Node } from "../schema/node.ts";
import type { Screen } from "../schema/screen.ts";
import type { Show } from "../schema/show.ts";
import { walkNodes } from "../tree/tree.ts";

// Lint finds things that are valid but probably wrong or ugly. Validation (validateScreen) finds things
// that cannot render. Both run on every change, whoever makes it: editor, generator or AI.
export interface LintIssue {
  level: "warning" | "info";
  rule: string;
  nodeId: string;
  message: string;
}

export interface LintContext {
  decor?: DecorCatalog;
  show?: Show;
}

const MAX_STACK_CHILDREN = 12;
const MAX_LABEL = 24;
const MAX_NAV_LABEL = 18;

const label = (node: Node): string | undefined => {
  if (node.type !== "widget" || node.kind !== "button") return undefined;
  const value = node.props["label"];
  return typeof value === "string" ? value : undefined;
};

const lintContainer = (node: ContainerNode, issues: LintIssue[]) => {
  const visible = node.children.filter((child) => !child.node.hidden);

  if (node.children.length === 0) {
    issues.push({ level: "warning", rule: "empty-container", nodeId: node.id, message: "Container is empty" });
  }

  if (node.layout.kind === "stack" && visible.length > MAX_STACK_CHILDREN) {
    issues.push({
      level: "warning",
      rule: "crowded-stack",
      nodeId: node.id,
      message: `${visible.length} items in one stack; more than ${MAX_STACK_CHILDREN} get too small on a display`,
    });
  }

  if (node.layout.kind === "frame" && !node.children.some((child) => child.slot === "main")) {
    issues.push({ level: "warning", rule: "frame-without-main", nodeId: node.id, message: "Frame has nothing in main" });
  }

  if (node.layout.kind === "canvas") {
    for (const child of node.children.filter((entry) => !entry.rect)) {
      issues.push({
        level: "warning",
        rule: "canvas-without-rect",
        nodeId: child.node.id,
        message: "Canvas child has no rect and fills the whole canvas",
      });
    }
  }

  // Buttons with the same label next to each other confuse actors and the audience.
  const seen = new Map<string, string>();
  for (const child of node.children) {
    const text = label(child.node)?.trim().toLowerCase();
    if (!text) continue;
    const key = `${child.slot ?? ""}:${text}`;
    if (seen.has(key)) {
      issues.push({
        level: "warning",
        rule: "duplicate-label",
        nodeId: child.node.id,
        message: `Same label as "${seen.get(key)}"`,
      });
    } else {
      seen.set(key, child.node.id);
    }
  }

  for (const child of node.children) {
    const text = label(child.node);
    const max = child.slot === "nav" ? MAX_NAV_LABEL : MAX_LABEL;
    if (text && text.length > max) {
      issues.push({
        level: "warning",
        rule: "label-length",
        nodeId: child.node.id,
        message: `Label has ${text.length} characters; keep it under ${max + 1} so it fits`,
      });
    }
  }
};

export const lintScreen = (screen: Screen, context: LintContext = {}): LintIssue[] => {
  const issues: LintIssue[] = [];
  const states = context.show ? new Set(context.show.states.map((state) => state.id)) : undefined;

  walkNodes(screen.root, (node) => {
    if (node.type === "container") lintContainer(node, issues);

    if (node.type === "decor" && context.decor && !context.decor.has(node.kind)) {
      issues.push({
        level: "info",
        rule: "foreign-decor",
        nodeId: node.id,
        message: `Decor "${node.kind}" belongs to another theme and is hidden`,
      });
    }

    for (const override of node.when ?? []) {
      if (states && !states.has(override.state)) {
        issues.push({
          level: "warning",
          rule: "unknown-state",
          nodeId: node.id,
          message: `The show has no state "${override.state}"`,
        });
      }
    }
  });

  return issues;
};
