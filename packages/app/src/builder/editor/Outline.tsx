import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { nodeLabel } from "./editing.ts";
import { useEditor } from "./EditorContext.ts";
import { type OutlineRow, outlineRows } from "./outline.ts";
import type { DragSource } from "./dragSource.ts";

const INDENT = 14;

const TYPE_ICON = { container: "▣", widget: "◆", decor: "✦" } as const;

const Gap = ({ row }: { row: Extract<OutlineRow, { kind: "gap" }> }) => {
  const { active } = useDndContext();
  const source = active?.data.current as DragSource | undefined;
  const disabled = !source || (source.kind === "node" && row.inside.includes(source.id));
  const { setNodeRef, isOver } = useDroppable({ id: row.key, data: { target: row.target }, disabled });
  return (
    <div
      ref={setNodeRef}
      className="outline-gap"
      data-active={!disabled}
      data-over={isOver}
      data-end={row.end}
      style={{ marginLeft: row.depth * INDENT }}
      aria-hidden="true"
    />
  );
};

const NodeRow = ({
  row,
  onToggle,
}: {
  row: Extract<OutlineRow, { kind: "node" }>;
  onToggle: (id: string) => void;
}) => {
  const { selection, select } = useEditor();
  const { node } = row;
  const label = nodeLabel(node);
  const source: DragSource = { kind: "node", id: node.id, label };
  const draggable = useDraggable({ id: `node:${node.id}`, data: source, disabled: row.parentId === undefined });
  const selected = selection?.kind === "node" && selection.id === node.id;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  return (
    <div
      ref={(element) => {
        ref.current = element;
        draggable.setNodeRef(element);
      }}
      className="outline-row"
      data-selected={selected}
      data-dragging={draggable.isDragging}
      data-hidden={Boolean(node.hidden)}
      style={{ paddingLeft: 6 + row.depth * INDENT }}
      {...draggable.listeners}
      {...draggable.attributes}
      role="treeitem"
      aria-selected={selected}
      aria-level={row.depth + 1}
      tabIndex={selected ? 0 : -1}
      onClick={() => select({ kind: "node", id: node.id })}
    >
      {node.type === "container" ? (
        <button
          type="button"
          className="outline-row__toggle"
          aria-label={row.collapsed ? `Expand ${label}` : `Collapse ${label}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(node.id);
          }}
        >
          {row.collapsed ? "▸" : "▾"}
        </button>
      ) : (
        <span className="outline-row__toggle" />
      )}
      <span className="outline-row__icon" data-type={node.type} aria-hidden="true">
        {TYPE_ICON[node.type]}
      </span>
      <span className="outline-row__label">{label}</span>
      {node.when?.length ? (
        <span className="outline-row__badge" title="Changes per show state">
          ⚡
        </span>
      ) : null}
      {node.hidden ? <span className="outline-row__badge">hidden</span> : null}
      {node.locked ? (
        <span className="outline-row__badge" title="Locked: the generator and AI leave it alone">
          🔒
        </span>
      ) : null}
    </div>
  );
};

const SlotRow = ({ row }: { row: Extract<OutlineRow, { kind: "slot" }> }) => {
  const { selection, select } = useEditor();
  const selected = selection?.kind === "slot" && selection.frameId === row.frameId && selection.slot === row.slot;
  return (
    <div
      className="outline-slot"
      data-selected={selected}
      style={{ paddingLeft: 6 + row.depth * INDENT }}
      role="treeitem"
      aria-selected={selected}
      aria-level={row.depth + 1}
      tabIndex={selected ? 0 : -1}
      onClick={() => select({ kind: "slot", frameId: row.frameId, slot: row.slot })}
    >
      <span className="outline-slot__name">{row.slot}</span>
      {row.count === 0 ? <span className="outline-slot__empty">empty</span> : null}
    </div>
  );
};

// The screen tree. Rows are dragged to reorder or move them; the gaps between rows open up while dragging.
export const Outline = () => {
  const { screen } = useEditor();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { active } = useDndContext();
  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="outline" role="tree" aria-label="Outline" data-dragging={Boolean(active)}>
      {outlineRows(screen, collapsed).map((row) => {
        if (row.kind === "gap") return <Gap key={row.key} row={row} />;
        if (row.kind === "slot") return <SlotRow key={row.key} row={row} />;
        return <NodeRow key={row.key} row={row} onToggle={toggle} />;
      })}
    </div>
  );
};
