import type { Node } from "../schema/node.ts";

// The node as it looks in a show state: every `when` entry for that state applied in order.
// Container overrides can only hide or show; widget and decor overrides also merge props.
export const nodeInState = <N extends Node>(node: N, state: string): N => {
  let result: N = node;
  for (const override of node.when ?? []) {
    if (override.state !== state) continue;
    if (override.hidden !== undefined) result = { ...result, hidden: override.hidden };
    if (override.props && "props" in result) result = { ...result, props: { ...result.props, ...override.props } };
  }
  return result;
};
