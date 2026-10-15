import type { Screen } from "../schema/screen.ts";
import type { Node } from "../schema/node.ts";

const label = (node: Node): string => {
  if (node.type === "container") {
    const { layout } = node;
    if (layout.kind === "frame") return `frame ${layout.archetype}`;
    if (layout.kind === "stack") return `stack ${layout.direction}`;
    if (layout.kind === "grid") return `grid ${layout.columns.length}×${layout.rows.length}`;
    return "canvas";
  }
  if (node.type === "decor") return `decor ${node.kind}`;
  const props = node.props;
  const text = [props["label"], props["text"], props["intent"]].find((value) => typeof value === "string");
  return `${node.kind}${typeof text === "string" ? ` "${text.length > 40 ? `${text.slice(0, 39)}…` : text}"` : ""}`;
};

const flags = (node: Node): string => {
  const marks: string[] = [];
  if (node.locked) marks.push("locked");
  if (node.hidden) marks.push("hidden");
  if (node.when && node.when.length > 0) marks.push(`changes in ${node.when.map((entry) => entry.state).join(", ")}`);
  if (node.type === "widget" && node.bind) marks.push(`live ${Object.keys(node.bind).join(", ")}`);
  if (node.type === "widget" && node.actions?.length) marks.push(`actions ${node.actions.map((action) => action.do).join(", ")}`);
  return marks.length > 0 ? ` [${marks.join("; ")}]` : "";
};

// A compact, indented text outline of a screen: one line per node with its id, what it is and its slot. Small
// enough for a model's context and a person's eye; `get_screen` with format "full" gives the JSON.
export const outlineScreen = (screen: Screen): string => {
  const lines = [
    `${screen.name} (${screen.id}) · revision ${screen.revision}${screen.published === undefined ? "" : ` · published ${screen.published}`} · ${screen.profile.aspect}${screen.section ? ` · section ${screen.section}` : ""}${screen.generator ? ` · generated from ${screen.generator.recipe} seed ${screen.generator.seed}` : ""}`,
  ];
  const visit = (node: Node, depth: number, slot?: string) => {
    lines.push(`${"  ".repeat(depth)}${slot ? `${slot}: ` : ""}${node.id} ${label(node)}${flags(node)}`);
    if (node.type === "container") for (const child of node.children) visit(child.node, depth + 1, child.slot);
  };
  visit(screen.root, 1);
  return lines.join("\n");
};
