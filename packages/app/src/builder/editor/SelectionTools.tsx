import { findNode, type Op } from "@interactive-displays/core";
import type { Box } from "./dropGeometry.ts";
import { duplicateOps, removeOps } from "./editing.ts";
import { useEditor } from "./EditorContext.ts";
import { addTrackOps, flipOps, MAX_TRACKS, removeTrackOps, wrapOps } from "./layoutTools.ts";

interface Tool {
  label: string;
  title: string;
  run: () => void;
  disabled?: boolean;
}

const HEIGHT = 30;

// Quick layout buttons on the selection in the preview: add a copy next to it, put it in a new row or column so
// something can go beside it, flip a row into a column, add or remove grid tracks, delete.
export const SelectionTools = ({ box, width }: { box: Box; width: number }) => {
  const { screen, selection, apply, select } = useEditor();
  if (selection?.kind !== "node") return null;
  const location = findNode(screen.root, selection.id);
  if (!location) return null;
  const { node, parent } = location;
  const run = (ops: Op[] | undefined, then?: () => void) => () => {
    if (ops && ops.length > 0 && apply(ops)) then?.();
  };

  const tools: Tool[] = [];
  if (parent) {
    const copy = duplicateOps(screen, node.id);
    tools.push({ label: "+ Copy", title: "Add a copy right after it (Ctrl+D)", run: run(copy?.ops, () => copy && select({ kind: "node", id: copy.id })) });
    const row = wrapOps(screen, node.id, "row");
    const column = wrapOps(screen, node.id, "column");
    tools.push({ label: "In row", title: "Put it in a new row, so parts can go beside it", run: run(row?.ops) });
    tools.push({ label: "In column", title: "Put it in a new column, so parts can go above and below it", run: run(column?.ops) });
  }
  if (node.type === "container" && node.layout.kind === "stack") {
    const toRow = node.layout.direction === "column";
    tools.push({ label: toRow ? "To row" : "To column", title: toRow ? "Lay its parts out side by side" : "Lay its parts out one below the other", run: run(flipOps(screen, node.id)) });
  }
  if (node.type === "container" && node.layout.kind === "grid") {
    const { columns, rows } = node.layout;
    tools.push(
      { label: "+ Col", title: "Add a column", run: run(addTrackOps(screen, node.id, "columns")), disabled: columns.length >= MAX_TRACKS },
      { label: "− Col", title: "Remove the last column", run: run(removeTrackOps(screen, node.id, "columns")), disabled: columns.length <= 1 },
      { label: "+ Row", title: "Add a row", run: run(addTrackOps(screen, node.id, "rows")), disabled: rows.length >= MAX_TRACKS },
      { label: "− Row", title: "Remove the last row", run: run(removeTrackOps(screen, node.id, "rows")), disabled: rows.length <= 1 },
    );
  }
  if (parent) {
    tools.push({
      label: "Delete",
      title: "Delete it (Del)",
      run: run(removeOps(screen, node.id), () => select({ kind: "node", id: parent.id })),
    });
  }
  if (tools.length === 0) return null;

  // Above the selection, or inside its top edge when there is no room above; on the right half of the stage it
  // lines up with the selection's right edge, so it stays on the stage.
  const top = box.top >= HEIGHT + 4 ? box.top - HEIGHT - 4 : Math.max(0, box.top) + 4;
  const side = box.left + box.width / 2 > width / 2 ? { right: Math.max(0, width - box.left - box.width) } : { left: Math.max(0, box.left) };
  return (
    <div className="selection-tools" role="toolbar" aria-label="Selection tools" style={{ ...side, top }}>
      {tools.map((tool) => (
        <button
          key={tool.label}
          type="button"
          className="selection-tools__button"
          title={tool.title}
          disabled={tool.disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            tool.run();
          }}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
};
