import { bindingTicks, bindProps, catalog, type SignalEnvironment, type WidgetNode } from "@interactive-displays/core";
import { resolveWidgetRenderer, useNow } from "@interactive-displays/themes/react";
import { useMemo } from "react";
import { useShowState, useSlot, useThemeId } from "./context.ts";
import { runControl, useLive, useSignalValues } from "./live.ts";
import { WidgetFallback } from "./WidgetFallback.tsx";

type Resolved = { props: Record<string, unknown> } | { problem: string };

// How often a widget bound to a value that moves with time (an ambient walk, a clock) redraws.
const LIVE_REDRAW_MS = 250;

// Props are re-validated here so a renderer only ever sees props that match its schema, even if the server
// runs a newer or older catalog than this bundle. Bound values replace their props; if a bound value does not
// fit (a signal changed type), the widget shows its own props rather than failing.
const resolveProps = (node: WidgetNode, environment: SignalEnvironment | undefined): Resolved => {
  const definition = catalog.get(node.kind);
  if (!definition) return { problem: "Unknown widget" };
  const fixed = definition.props.safeParse(node.props);
  if (!fixed.success) return { problem: "Invalid props" };
  if (!node.bind || !environment) return { props: fixed.data };
  const fits = (props: Record<string, unknown>) => definition.props.safeParse(props).success;
  const live = definition.props.safeParse(bindProps(fixed.data, node.bind, node.id, environment, fits));
  return { props: live.success ? live.data : fixed.data };
};

export const WidgetView = ({ node }: { node: WidgetNode }) => {
  const themeId = useThemeId();
  const slot = useSlot();
  const state = useShowState();
  const live = useLive();
  const bindings = node.bind;
  const ticks = bindings ? Object.values(bindings).some((binding) => bindingTicks(binding, live.signals)) : false;
  const now = useNow(ticks ? LIVE_REDRAW_MS : null);
  const values = useSignalValues(bindings ? live.store : null);

  const resolved = useMemo(
    () => resolveProps(node, bindings ? { signals: live.signals, values, state, now } : undefined),
    [node, bindings, live.signals, values, state, now],
  );
  const Renderer = resolveWidgetRenderer(themeId, node.kind);
  const onUse = catalog.get(node.kind)?.interactive
    ? (value?: number, moving?: boolean) => runControl(live, node, value, moving)
    : undefined;
  const bound = bindings !== undefined && Object.keys(bindings).length > 0;

  if ("problem" in resolved) return <WidgetFallback kind={node.kind} reason={resolved.problem} />;
  if (!Renderer) return <WidgetFallback kind={node.kind} reason="No renderer" />;
  return (
    <Renderer
      props={resolved.props}
      nodeId={node.id}
      {...(slot ? { slot } : {})}
      {...(onUse ? { onUse } : {})}
      {...(bound ? { bound } : {})}
    />
  );
};
