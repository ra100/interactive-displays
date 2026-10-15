import { isSettable, isTicking, type SignalDef, type SignalValue } from "@interactive-displays/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { type SignalStore, useSignalValues } from "../runtime/live.ts";

// While the operator drags, a value goes out a few times a second and once more where they stop.
const SEND_EVERY_MS = 150;
// How long the slider keeps the operator's own position before it follows the server again.
const HOLD_MS = 1500;

const useThrottled = (send: (value: number) => void) => {
  const latest = useRef(send);
  latest.current = send;
  const lastSent = useRef(0);
  const pending = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback((value: number) => {
    pending.current = value;
    const flush = () => {
      if (pending.current === undefined) return;
      lastSent.current = Date.now();
      latest.current(pending.current);
      pending.current = undefined;
    };
    clearTimeout(timer.current);
    const wait = SEND_EVERY_MS - (Date.now() - lastSent.current);
    if (wait <= 0) flush();
    else timer.current = setTimeout(flush, wait);
  }, []);
};

const decimalsOf = (step: number): number => {
  const [, decimals = ""] = String(step).split(".");
  return Math.min(decimals.length, 4);
};

const shown = (value: SignalValue | undefined, decimals: number, unit: string | undefined): string => {
  if (value === undefined) return "—";
  const text = typeof value === "number" ? value.toFixed(decimals) : value;
  return unit ? `${text} ${unit}` : text;
};

// A shared signal the crew sets by hand: a big slider, and a step either way for fine changes.
const ManualSignal = ({
  signal,
  value,
  onSet,
}: {
  signal: SignalDef;
  value: SignalValue | undefined;
  onSet: (change: { value: number } | { delta: number }) => void;
}) => {
  const { source } = signal;
  const [local, setLocal] = useState<number | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const send = useThrottled((next) => onSet({ value: next }));
  useEffect(() => () => clearTimeout(hold.current), []);
  // Follow the server again once it has caught up with the operator.
  useEffect(() => {
    if (local !== null && value === local) setLocal(null);
  }, [value, local]);

  if (source.kind !== "manual") return null;
  const decimals = decimalsOf(source.step);
  const server = typeof value === "number" ? value : source.initial;
  const current = local ?? server;
  const id = `signal-${signal.id}`;

  const drag = (next: number) => {
    setLocal(next);
    send(next);
    clearTimeout(hold.current);
    hold.current = setTimeout(() => setLocal(null), HOLD_MS);
  };

  return (
    <li className="signal-control">
      <div className="signal-control__head">
        <label htmlFor={id} className="signal-control__label">
          {signal.label}
        </label>
        <output className="signal-control__value" htmlFor={id}>
          {shown(current, decimals, signal.unit)}
        </output>
      </div>
      <div className="signal-control__row">
        <button
          type="button"
          className="tool-button"
          aria-label={`Lower ${signal.label}`}
          disabled={current <= source.min}
          onClick={() => onSet({ delta: -source.step })}
        >
          −
        </button>
        <input
          id={id}
          className="signal-control__slider"
          type="range"
          min={source.min}
          max={source.max}
          step={source.step}
          value={current}
          onChange={(event) => drag(Number(event.target.value))}
        />
        <button
          type="button"
          className="tool-button"
          aria-label={`Raise ${signal.label}`}
          disabled={current >= source.max}
          onClick={() => onSet({ delta: source.step })}
        >
          +
        </button>
      </div>
    </li>
  );
};

// The show's shared signals: sliders for the ones the crew sets, live readings for the ones that move by
// themselves. Ambient signals are left out: every display works those out alone.
export const SignalControls = ({
  signals,
  store,
  onSet,
}: {
  signals: readonly SignalDef[];
  store: SignalStore;
  onSet: (signalId: string, change: { value: number } | { delta: number }) => void;
}) => {
  const values = useSignalValues(store);
  const settable = signals.filter(isSettable);
  const ticking = signals.filter(isTicking);

  if (settable.length === 0 && ticking.length === 0) {
    return <p className="operator__hint">This show has no shared values. Add them in the editor's signals list.</p>;
  }

  return (
    <ul className="signal-list">
      {settable.map((signal) => (
        <ManualSignal
          key={signal.id}
          signal={signal}
          value={values[signal.id]}
          onSet={(change) => onSet(signal.id, change)}
        />
      ))}
      {ticking.map((signal) => (
        <li key={signal.id} className="signal-control signal-control--reading">
          <div className="signal-control__head">
            <span className="signal-control__label">{signal.label}</span>
            <output className="signal-control__value">{shown(values[signal.id], 1, signal.unit)}</output>
          </div>
        </li>
      ))}
    </ul>
  );
};
