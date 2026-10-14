import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { lcarsCode } from "./code.ts";

// Slot-aware: a flush block with a reference number in the sidebar, a pill in toolbars and content.
export const LcarsButton = ({ props, nodeId, slot }: WidgetRendererProps<WidgetPropsOf<"button">>) => {
  const shape = slot === "nav" ? "block" : "pill";
  return (
    <button type="button" className="lcars-button" data-shape={shape} data-tone={props.tone}>
      {shape === "block" ? (
        <span className="lcars-button__code" aria-hidden="true">
          {lcarsCode(nodeId)}
        </span>
      ) : null}
      <span className="lcars-button__label">{props.label}</span>
    </button>
  );
};
