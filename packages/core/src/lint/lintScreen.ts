import type { DecorCatalog } from "../catalog/defineDecor.ts";
import type { ContainerNode, Node, WidgetNode } from "../schema/node.ts";
import type { Screen } from "../schema/screen.ts";
import type { Show } from "../schema/show.ts";
import { isSettable } from "../signals/sample.ts";
import { walkNodes, widgetIds } from "../tree/tree.ts";

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
  // Ids of the show's screens, for checking where navigate actions go.
  screens?: ReadonlySet<string>;
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

// Bindings and actions that point at things the show does not have.
const lintLiveParts = (node: WidgetNode, videos: ReadonlySet<string>, context: LintContext, issues: LintIssue[]) => {
  const { show, screens } = context;
  const warn = (rule: string, message: string) => issues.push({ level: "warning", rule, nodeId: node.id, message });

  for (const [prop, binding] of Object.entries(node.bind ?? {})) {
    if ("signal" in binding && show && !show.signals.some((signal) => signal.id === binding.signal)) {
      warn("unknown-signal", `${prop} follows "${binding.signal}", which the show does not have`);
    }
  }

  for (const action of node.actions ?? []) {
    if (action.do === "setState" && show && !show.states.some((state) => state.id === action.state)) {
      warn("unknown-state", `The show has no state "${action.state}"`);
    }
    if (action.do === "navigate" && screens && !screens.has(action.screen)) {
      warn("unknown-screen", `There is no screen "${action.screen}" to go to`);
    }
    if (action.do === "video" && !videos.has(action.target)) {
      warn("video-target", `"${action.target}" is not a video on this screen`);
    }
    if (action.do === "setSignal" && show) {
      const signal = show.signals.find((each) => each.id === action.signal);
      if (!signal) warn("unknown-signal", `The show has no signal "${action.signal}"`);
      else if (!isSettable(signal)) {
        warn("signal-not-settable", `"${action.signal}" is not a shared manual signal, so controls cannot set it`);
      }
    }
  }
};

export const lintScreen = (screen: Screen, context: LintContext = {}): LintIssue[] => {
  const issues: LintIssue[] = [];
  const states = context.show ? new Set(context.show.states.map((state) => state.id)) : undefined;
  const videos = new Set(widgetIds(screen.root, "video"));

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

    if (node.type === "widget") lintLiveParts(node, videos, context, issues);

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
