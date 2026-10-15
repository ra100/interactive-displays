import { type Node, takenIds } from "@interactive-displays/core";
import { insertOps, insertTarget } from "./editing.ts";
import { useEditor } from "./EditorContext.ts";

// Puts a new node where the selection says (or at the end of the main slot) and selects it.
export const useInsert = () => {
  const { screen, selection, apply, select, notify } = useEditor();
  return (create: (taken: ReadonlySet<string>) => Node) => {
    const target = insertTarget(screen, selection);
    if (!target) {
      notify("Select a container or slot first", "danger");
      return;
    }
    const node = create(takenIds(screen.root));
    if (apply(insertOps(screen, node, target))) select({ kind: "node", id: node.id });
  };
};
