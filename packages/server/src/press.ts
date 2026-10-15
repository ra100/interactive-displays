import { catalog, findNode, type Node, nodeInState, type Screen, type WidgetNode, widgetIds } from "@interactive-displays/core";

// The control an actor pressed, if it is one: a widget with actions, of an interactive kind, that is visible in
// the current state (it and every container around it). A press for anything else is stale or forged and is
// ignored.
export const pressTarget = (screen: Screen, nodeId: string, state: string): WidgetNode | undefined => {
  const location = findNode(screen.root, nodeId);
  if (!location) return undefined;
  const { node } = location;
  if (node.type !== "widget" || !node.actions?.length || !catalog.get(node.kind)?.interactive) return undefined;
  const chain: Node[] = [...location.ancestors.flatMap((id) => findNode(screen.root, id)?.node ?? []), node];
  return chain.some((each) => nodeInState(each, state).hidden) ? undefined : node;
};

// Ids of the video widgets on a screen, for the operator's transport controls.
export const videoIds = (screen: Screen | null): string[] => (screen ? widgetIds(screen.root, "video") : []);
