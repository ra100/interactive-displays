import { catalog, type WidgetNode } from "@interactive-displays/core";
import { resolveWidgetRenderer } from "@interactive-displays/themes/react";
import { useMemo } from "react";
import { useSlot, useThemeId } from "./context.ts";
import { WidgetFallback } from "./WidgetFallback.tsx";

type Resolved = { props: Record<string, unknown> } | { problem: string };

// Props are re-validated here so a renderer only ever sees props that match its schema,
// even if the server runs a newer or older catalog than this bundle.
const resolveProps = (node: WidgetNode): Resolved => {
  const definition = catalog.get(node.kind);
  if (!definition) return { problem: "Unknown widget" };
  const parsed = definition.props.safeParse(node.props);
  return parsed.success ? { props: parsed.data } : { problem: "Invalid props" };
};

export const WidgetView = ({ node }: { node: WidgetNode }) => {
  const themeId = useThemeId();
  const slot = useSlot();
  const resolved = useMemo(() => resolveProps(node), [node]);
  const Renderer = resolveWidgetRenderer(themeId, node.kind);

  if ("problem" in resolved) return <WidgetFallback kind={node.kind} reason={resolved.problem} />;
  if (!Renderer) return <WidgetFallback kind={node.kind} reason="No renderer" />;
  return slot ? (
    <Renderer props={resolved.props} nodeId={node.id} slot={slot} />
  ) : (
    <Renderer props={resolved.props} nodeId={node.id} />
  );
};
