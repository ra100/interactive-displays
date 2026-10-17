import type { WidgetPropsOf } from "@interactive-displays/core";
import { type CSSProperties, useEffect, useRef } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { formatValue } from "../format.ts";
import { useControlValue, usePressFlash } from "../runtime.ts";

export const BaseButtonGroup = ({ props, onUse, bound = false }: WidgetRendererProps<WidgetPropsOf<"button-group">>) => {
  const [selected, setSelected] = useControlValue(props.selected, bound);
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

export const BaseToggle = ({ props, nodeId, onUse, bound = false }: WidgetRendererProps<WidgetPropsOf<"toggle">>) => {
  const [on, setOn] = useControlValue(props.on, bound);
  const { flashing, flash } = usePressFlash(nodeId);
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
// Where a pointer-up never reaches the input, the slider counts as let go this long after it last moved.
const RELEASE_AFTER_MS = 800;

// Decimals the readout needs for the slider's step: 0.1 shows one, 5 shows none.
const decimalsOf = (step: number): number => Math.min(3, (String(step).split(".")[1] ?? "").length);

// A native range input (keyboard and screen readers for free) with a thumb as big as a fingertip. While the
// actor drags, the value goes out a few times a second as `moving`; where they let go it goes out once more,
// and only then do the press sound and the slider's own actions run.
export const BaseSlider = ({ props, onUse, bound = false }: WidgetRendererProps<WidgetPropsOf<"slider">>) => {
  const [value, setValue] = useControlValue(props.value, bound);
  const lastSent = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The value moved since the last release, if it did.
  const moved = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(pending.current);
      clearTimeout(idle.current);
    },
    [],
  );

  const release = () => {
    const final = moved.current;
    clearTimeout(idle.current);
    if (final === undefined) return;
    moved.current = undefined;
    clearTimeout(pending.current);
    lastSent.current = Date.now();
    onUse?.(final);
  };

  const move = (next: number) => {
    moved.current = next;
    clearTimeout(pending.current);
    clearTimeout(idle.current);
    idle.current = setTimeout(release, RELEASE_AFTER_MS);
    const go = () => {
      lastSent.current = Date.now();
      onUse?.(next, true);
    };
    const wait = SEND_EVERY_MS - (Date.now() - lastSent.current);
    if (wait <= 0) go();
    else pending.current = setTimeout(go, wait);
  };

  const fill = ((value - props.min) / (props.max - props.min)) * 100;
  return (
    <label className="base-slider" data-tone={props.tone}>
      <span className="base-slider__label">{props.label}</span>
      <span className="base-slider__value">
        {formatValue(value, decimalsOf(props.step))}
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
          move(next);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyUp={release}
        onBlur={release}
      />
    </label>
  );
};
