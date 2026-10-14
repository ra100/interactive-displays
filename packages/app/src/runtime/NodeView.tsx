import type { ContainerNode, Node } from "@interactive-displays/core";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary.tsx";
import { WidgetView } from "./WidgetView.tsx";

const StackView = ({ node }: { node: ContainerNode }) => (
  <div
    className="stack"
    data-node-id={node.id}
    data-direction={node.layout.direction}
    data-gap={node.layout.gap}
  >
    {node.children
      .filter((child) => !child.node.hidden)
      .map((child) => (
        <div key={child.node.id} className="stack__item" style={{ flexGrow: child.weight ?? 1 }}>
          <NodeView node={child.node} />
        </div>
      ))}
  </div>
);

export const NodeView = ({ node }: { node: Node }) => {
  if (node.hidden) return null;
  if (node.type === "container") return <StackView node={node} />;

  return (
    <div className="widget-slot" data-node-id={node.id} data-kind={node.kind}>
      <WidgetErrorBoundary kind={node.kind}>
        <WidgetView node={node} />
      </WidgetErrorBoundary>
    </div>
  );
};
