import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { useControlValue } from "../runtime.ts";

// A row (or column) of pills; the chosen one lights up, the rest dim. Answers a touch at once and follows
// its props again when a bound signal moves.
export const LcarsButtonGroup = ({ props, onUse, bound = false }: WidgetRendererProps<WidgetPropsOf<"button-group">>) => {
  const [selected, setSelected] = useControlValue(props.selected, bound);
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
