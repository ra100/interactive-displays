import type { DecorNode } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { resolveDecor } from "@interactive-displays/themes/react";
import { useMemo } from "react";
import { useThemeId } from "./context.ts";
import { WidgetFallback } from "./WidgetFallback.tsx";

// Decor is ornament for one theme. Containers already skip decor the theme cannot draw; this renders the rest,
// or the theme's stand-in for another theme's piece, with validated props, like widgets.
export const DecorView = ({ node }: { node: DecorNode }) => {
  const themeId = useThemeId();
  const shown = useMemo(() => resolveDecor(themeId, node.kind, node.props), [themeId, node]);
  const parsed = useMemo(() => shown && decorCatalog.get(shown.kind)?.props.safeParse(shown.props), [shown]);

  if (!shown) return null;
  if (!parsed?.success) return <WidgetFallback kind={node.kind} reason="Invalid props" />;
  return <shown.Renderer props={parsed.data} nodeId={node.id} />;
};
