import type { WidgetPropsOf } from "@interactive-displays/core";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { formatValue } from "../format.ts";
import { usePressFlash } from "../runtime.ts";

// Controls answer a touch at once from their own state, then follow their props again when they change
// (a bound control moves when the shared signal does, whoever changed it).
const useLocal = <T,>(value: T): [T, (next: T) => void] => {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return [local, setLocal];
};

export const BaseButtonGroup = ({ props, onUse }: WidgetRendererProps<WidgetPropsOf<"button-group">>) => {
  const [selected, setSelected] = useLocal(props.selected);
  return (
    <div className="base-button-group" role="group" data-orientation={props.orientation} data-tone={props.tone}>
      {props.items.map((item, index) => (
        <button
          key={index}
          type="button"
          className="base-button-group__item"
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

export const BaseToggle = ({ props, onUse }: WidgetRendererProps<WidgetPropsOf<"toggle">>) => {
  const [on, setOn] = useLocal(props.on);
  const { flashing, flash } = usePressFlash();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="base-toggle"
      data-tone={props.tone}
      data-flash={flashing}
      onClick={() => {
        flash();
        setOn(!on);
        onUse?.(on ? 0 : 1);
      }}
    >
      <span className="base-toggle__label">{props.label}</span>
      <span className="base-toggle__switch" aria-hidden="true">
        <span className="base-toggle__knob" />
      </span>
      <span className="base-toggle__state">{on ? "ON" : "OFF"}</span>
    </button>
  );
};

const SEND_EVERY_MS = 120;

// A native range input (keyboard and screen readers for free) with a thumb as big as a fingertip. While the
// actor drags, the value goes out a few times a second and once more where they let go.
export const BaseSlider = ({ props, onUse }: WidgetRendererProps<WidgetPropsOf<"slider">>) => {
  const [value, setValue] = useLocal(props.value);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(pending.current), []);

  const send = (next: number) => {
    clearTimeout(pending.current);
    const wait = SEND_EVERY_MS - (Date.now() - lastSent.current);
    if (wait <= 0) {
      lastSent.current = Date.now();
      onUse?.(next);
    } else {
      pending.current = setTimeout(() => {
        lastSent.current = Date.now();
        onUse?.(next);
      }, wait);
    }
  };

  const fill = ((value - props.min) / (props.max - props.min)) * 100;
  return (
    <label className="base-slider" data-tone={props.tone}>
      <span className="base-slider__label">{props.label}</span>
      <span className="base-slider__value">
        {formatValue(value, 0)}
        {props.unit ? <span className="base-slider__unit">{props.unit}</span> : null}
      </span>
      <input
        className="base-slider__input"
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={value}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(event) => {
          const next = Number(event.target.value);
          setValue(next);
          send(next);
        }}
      />
    </label>
  );
};
