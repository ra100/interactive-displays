import type { WidgetPropsOf } from "@interactive-displays/core";
import { useEffect, useState } from "react";
import type { WidgetRendererProps } from "../contract.ts";

// A row (or column) of pills; the chosen one lights up, the rest dim. Answers a touch at once and follows
// its props again when a bound signal moves.
export const LcarsButtonGroup = ({ props, onUse }: WidgetRendererProps<WidgetPropsOf<"button-group">>) => {
  const [selected, setSelected] = useState(props.selected);
  useEffect(() => setSelected(props.selected), [props.selected]);
  return (
    <div className="lcars-button-group" role="group" data-orientation={props.orientation} data-tone={props.tone}>
      {props.items.map((item, index) => (
        <button
          key={index}
          type="button"
          className="lcars-button-group__item"
          aria-pressed={index === selected}
          onClick={() => {
            setSelected(index);
            onUse?.(index);
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
};
