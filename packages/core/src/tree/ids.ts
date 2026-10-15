import type { Node } from "../schema/node.ts";
import { collectIds } from "./tree.ts";

const MAX_ID = 64;

// Turns a label into an id stem: "Warp Core!" → "warp-core".
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

// An id that is not in `taken`: the stem itself, or the stem with the lowest free number appended.
export const uniqueId = (stem: string, taken: ReadonlySet<string>): string => {
  const base = slugify(stem) || "node";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, MAX_ID - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
};

// A deep copy of a node with every id in it replaced by one that is free in `taken`, which it extends.
// Used to duplicate parts of a screen and to drop blocks into one.
export const cloneWithFreshIds = (node: Node, taken: Set<string>): Node => {
  const copy = structuredClone(node);
  const rename = (current: Node) => {
    current.id = uniqueId(current.id.replace(/-\d+$/, ""), taken);
    taken.add(current.id);
    if (current.type === "container") for (const child of current.children) rename(child.node);
  };
  rename(copy);
  return copy;
};

export const takenIds = (root: Node): Set<string> => collectIds(root);
