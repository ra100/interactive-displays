import type { WidgetRendererProps } from "../contract.ts";
import type { WidgetPropsOf } from "@interactive-displays/core";

export const BaseTitle = ({ props }: WidgetRendererProps<WidgetPropsOf<"title">>) => (
  <header className="base-title" data-tone={props.tone}>
    <h1 className="base-title__text">{props.text}</h1>
    {props.code ? <span className="base-title__code">{props.code}</span> : null}
  </header>
);
