import type { Node } from "@interactive-displays/core";

// What is being dragged in the editor: a node from the outline, or something new from the Add panel.
export type DragSource =
  | { kind: "node"; id: string; label: string }
  | { kind: "new"; label: string; create: (taken: ReadonlySet<string>) => Node };
