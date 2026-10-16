import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { usePressFlash } from "../runtime.ts";

export const BaseButton = ({ props, onUse }: WidgetRendererProps<WidgetPropsOf<"button">>) => {
  const { flashing, flash } = usePressFlash();
  return (
    <button
      type="button"
      className="base-button"
      data-tone={props.tone}
      data-flash={flashing}
      onClick={() => {
        flash();
        onUse?.();
      }}
    >
      <span className="base-button__label">{props.label}</span>
    </button>
  );
};
