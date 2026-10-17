import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { usePressFlash } from "../runtime.ts";
import { lcarsCode } from "./code.ts";

// Slot-aware: a flush block with a reference number in the sidebar, a pill in toolbars and content.
export const LcarsButton = ({ props, nodeId, slot, onUse }: WidgetRendererProps<WidgetPropsOf<"button">>) => {
  const shape = slot === "nav" ? "block" : "pill";
  const { flashing, flash } = usePressFlash(nodeId);
  return (
    <button
      type="button"
      className="lcars-button"
      data-shape={shape}
      data-tone={props.tone}
      data-flash={flashing}
      onClick={() => {
        flash();
        onUse?.();
      }}
    >
      {shape === "block" ? (
        <span className="lcars-button__code" aria-hidden="true">
          {lcarsCode(nodeId)}
        </span>
      ) : null}
      <span className="lcars-button__label">{props.label}</span>
    </button>
  );
};
