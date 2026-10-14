import type { DecorNode } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { resolveDecorRenderer } from "@interactive-displays/themes/react";
import { useMemo } from "react";
import { useThemeId } from "./context.ts";
import { WidgetFallback } from "./WidgetFallback.tsx";

// Decor is ornament for one theme. Containers already skip decor from other themes; this renders the rest
// with validated props, like widgets.
export const DecorView = ({ node }: { node: DecorNode }) => {
  const themeId = useThemeId();
  const parsed = useMemo(() => decorCatalog.get(node.kind)?.props.safeParse(node.props), [node]);
  const Renderer = resolveDecorRenderer(themeId, node.kind);

  if (!Renderer) return null;
  if (!parsed?.success) return <WidgetFallback kind={node.kind} reason="Invalid props" />;
  return <Renderer props={parsed.data} nodeId={node.id} />;
};
