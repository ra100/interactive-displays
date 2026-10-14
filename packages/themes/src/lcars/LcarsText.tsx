import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";

export const LcarsText = ({ props }: WidgetRendererProps<WidgetPropsOf<"text">>) => (
  <p className="lcars-text" data-tone={props.tone} data-size={props.size}>
    {props.text}
  </p>
);
