import { assetUrl, type WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";

export const BaseImage = ({ props }: WidgetRendererProps<WidgetPropsOf<"image">>) => (
  <img className="base-image" src={assetUrl(props.asset)} alt={props.alt ?? ""} data-fit={props.fit} draggable={false} />
);
