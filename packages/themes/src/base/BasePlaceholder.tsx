import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";

// A dashed outline with its intent, so the crew can see what is still to come; Regenerate replaces it.
export const BasePlaceholder = ({ props }: WidgetRendererProps<WidgetPropsOf<"placeholder">>) => (
  <div className="base-placeholder" data-size={props.size}>
    <span className="base-placeholder__intent">{props.intent}</span>
  </div>
);
