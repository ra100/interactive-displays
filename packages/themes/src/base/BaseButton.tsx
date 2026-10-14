import type { WidgetRendererProps } from "../contract.ts";
import type { WidgetPropsOf } from "@interactive-displays/core";

// Phase 0 buttons give touch feedback only; actions arrive with the command layer.
export const BaseButton = ({ props }: WidgetRendererProps<WidgetPropsOf<"button">>) => (
  <button type="button" className="base-button" data-tone={props.tone}>
    <span className="base-button__label">{props.label}</span>
  </button>
);
