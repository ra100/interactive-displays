import {
  archetypeSlots,
  type ChildEntry,
  type ContainerNode,
  type GridArea,
  isArchetype,
  type Node,
  type NormRect,
  nodeInState,
  SLOT_DIRECTION,
  type SlotName,
} from "@interactive-displays/core";
import { resolveDecor, resolveFrameRenderer } from "@interactive-displays/themes/react";
import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { SlotProvider, useEditing, useShowState, useThemeId } from "./context.ts";
import { DecorView } from "./DecorView.tsx";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary.tsx";
import { WidgetFallback } from "./WidgetFallback.tsx";
import { WidgetView } from "./WidgetView.tsx";

// Children as they look in the current show state, without the hidden ones and without decor the theme
// cannot draw (another theme's piece with no stand-in), so neither leaves an empty gap in the layout.
const useVisibleChildren = (node: ContainerNode): ChildEntry[] => {
  const state = useShowState();
  const themeId = useThemeId();
  return node.children.flatMap((child) => {
    const resolved = nodeInState(child.node, state);
    if (resolved.hidden) return [];
    if (resolved.type === "decor" && !resolveDecor(themeId, resolved.kind, resolved.props)) return [];
    return [{ ...child, node: resolved }];
  });
};

const weightStyle = (child: ChildEntry): CSSProperties => ({ flexGrow: child.weight ?? 1 });

const track = (value: string) => (value === "auto" ? "auto" : `minmax(0, ${value})`);

const areaStyle = (area: GridArea | undefined): CSSProperties =>
  area
    ? { gridColumn: `${area.col} / span ${area.colSpan ?? 1}`, gridRow: `${area.row} / span ${area.rowSpan ?? 1}` }
    : {};

const percent = (value: number) => `${value * 100}%`;

// A canvas child without a rect fills the canvas; lint flags it.
const rectStyle = (rect: NormRect | undefined): CSSProperties =>
  rect ? { left: percent(rect.x), top: percent(rect.y), width: percent(rect.w), height: percent(rect.h) } : { inset: 0 };

const StackView = ({ node }: { node: ContainerNode & { layout: { kind: "stack" } } }) => (
  <div className="stack" data-node-id={node.id} data-direction={node.layout.direction} data-gap={node.layout.gap}>
    {useVisibleChildren(node).map((child) => (
      <div key={child.node.id} className="stack__item" style={weightStyle(child)}>
        <NodeView node={child.node} />
      </div>
    ))}
  </div>
);

const GridView = ({ node }: { node: ContainerNode & { layout: { kind: "grid" } } }) => (
  <div
    className="grid"
    data-node-id={node.id}
    data-gap={node.layout.gap}
    style={{
      gridTemplateColumns: node.layout.columns.map(track).join(" "),
      gridTemplateRows: node.layout.rows.map(track).join(" "),
    }}
  >
    {useVisibleChildren(node).map((child) => (
      <div key={child.node.id} className="grid__item" style={areaStyle(child.area)}>
        <NodeView node={child.node} />
      </div>
    ))}
  </div>
);

const CanvasView = ({ node }: { node: ContainerNode }) => (
  <div className="canvas" data-node-id={node.id}>
    {useVisibleChildren(node).map((child) => (
      <div key={child.node.id} className="canvas__item" style={rectStyle(child.rect)}>
        <NodeView node={child.node} />
      </div>
    ))}
  </div>
);

const SlotView = ({ slot, entries }: { slot: SlotName; entries: ChildEntry[] }) => (
  <SlotProvider value={slot}>
    <div className="slot" data-slot={slot} data-direction={SLOT_DIRECTION[slot]}>
      {entries.map((child) => (
        <div key={child.node.id} className="slot__item" style={weightStyle(child)}>
          <NodeView node={child.node} />
        </div>
      ))}
    </div>
  </SlotProvider>
);

// The theme draws the chrome; the runtime renders each slot's children and hands them over.
const FrameView = ({ node, archetype }: { node: ContainerNode; archetype: string }) => {
  const themeId = useThemeId();
  const editing = useEditing();
  const children = useVisibleChildren(node);
  if (!isArchetype(archetype)) return <WidgetFallback kind={archetype} reason="Unknown archetype" />;
  const Frame = resolveFrameRenderer(themeId, archetype);
  if (!Frame) return <WidgetFallback kind={archetype} reason="No frame" />;

  const slots: Partial<Record<SlotName, ReactNode>> = {};
  for (const slot of archetypeSlots(archetype)) {
    const entries = children.filter((child) => child.slot === slot);
    if (entries.length > 0 || editing) slots[slot] = <SlotView slot={slot} entries={entries} />;
  }

  return (
    <div className="frame" data-node-id={node.id} data-archetype={archetype}>
      <Frame archetype={archetype} nodeId={node.id} slots={slots} />
    </div>
  );
};

const ContainerView = ({ node }: { node: ContainerNode }) => {
  const { layout } = node;
  switch (layout.kind) {
    case "stack":
      return <StackView node={{ ...node, layout }} />;
    case "grid":
      return <GridView node={{ ...node, layout }} />;
    case "canvas":
      return <CanvasView node={node} />;
    case "frame":
      return <FrameView node={node} archetype={layout.archetype} />;
  }
};

// How much the nodes above have scaled the screen unit, so a scaled node inside a scaled node multiplies.
const NodeScaleContext = createContext(1);

// Draws a node's parts larger or smaller by giving everything inside it its own screen unit.
const NodeScale = ({ scale, children }: { scale: number; children: ReactNode }) => {
  const total = useContext(NodeScaleContext) * scale;
  return (
    <NodeScaleContext.Provider value={total}>
      <div className="node-scale" style={{ "--u": `calc(var(--u-screen) * ${total})`, "--touch": `calc(var(--touch-screen) * ${total})` } as CSSProperties}>
        {children}
      </div>
    </NodeScaleContext.Provider>
  );
};

const NodeBody = ({ node }: { node: Node }) => {
  if (node.type === "container") return <ContainerView node={node} />;

  return (
    <div className={node.type === "widget" ? "widget-slot" : "decor-slot"} data-node-id={node.id} data-kind={node.kind}>
      <WidgetErrorBoundary kind={node.kind}>
        {node.type === "widget" ? <WidgetView node={node} /> : <DecorView node={node} />}
      </WidgetErrorBoundary>
    </div>
  );
};

// Renders a node that has already been resolved for the current show state.
export const NodeView = ({ node }: { node: Node }) => {
  if (node.hidden) return null;
  if (node.scale === undefined || node.scale === 1) return <NodeBody node={node} />;
  return (
    <NodeScale scale={node.scale}>
      <NodeBody node={node} />
    </NodeScale>
  );
};
