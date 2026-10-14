import type { WidgetRendererProps } from "../contract.ts";
import type { WidgetPropsOf } from "@interactive-displays/core";

export const BaseText = ({ props }: WidgetRendererProps<WidgetPropsOf<"text">>) => (
  <p className="base-text" data-tone={props.tone} data-size={props.size}>
    {props.text}
  </p>
);
