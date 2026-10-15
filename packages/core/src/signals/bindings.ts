import type { Binding, Bindings, SignalDef, SignalValue } from "../schema/signal.ts";
import { ambientInState, isServerOwned, sampleAmbient, sampleSource, seedOf, sourceInState } from "./sample.ts";

// Everything needed to turn a binding into a value at one moment.
export interface SignalEnvironment {
  signals: readonly SignalDef[];
  // The server's values for shared signals, by id.
  values: Readonly<Record<string, SignalValue>>;
  state: string;
  now: number;
}

const findDef = (signals: readonly SignalDef[], id: string): SignalDef | undefined =>
  signals.find((signal) => signal.id === id);

// The live value for one bound prop. Inline ambient sources are seeded by node and prop, so two gauges
// on one screen wander differently but the same gauge looks the same on every display.
export const bindingValue = (
  binding: Binding,
  nodeId: string,
  prop: string,
  environment: SignalEnvironment,
): SignalValue | undefined => {
  if ("ambient" in binding) {
    return sampleAmbient(ambientInState(binding, environment.state), seedOf(`${nodeId}/${prop}`), environment.now);
  }
  const signal = findDef(environment.signals, binding.signal);
  if (!signal) return undefined;
  if (isServerOwned(signal)) {
    const value = environment.values[signal.id];
    if (value !== undefined) return value;
  }
  // Not heard from the server yet (or never will be): work it out locally, the same way the server does.
  return sampleSource(sourceInState(signal, environment.state), seedOf(signal.id), environment.now);
};

// Whether a binding changes as time passes on this display (and so needs a ticking clock to redraw).
export const bindingTicks = (binding: Binding, signals: readonly SignalDef[]): boolean => {
  if ("ambient" in binding) return true;
  const signal = findDef(signals, binding.signal);
  if (!signal || isServerOwned(signal)) return false;
  return signal.source.kind !== "static" && signal.source.kind !== "manual";
};

// A bound value adapted to the type of the prop it replaces: a manual signal (a number) can drive a toggle,
// a numeric text can drive a gauge. Anything that still does not fit is left to prop validation.
export const coerceTo = (value: SignalValue, like: unknown): unknown => {
  if (typeof like === "boolean") return typeof value === "number" ? value !== 0 : value === "true" || value === "on";
  if (typeof like === "number" && typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (typeof like === "string" && typeof value === "number") return String(value);
  return value;
};

// Props with their bound values filled in. `fixed` are the node's own props (after per-state overrides).
// `fits` says whether props are valid for the widget: a bound value that already fits is used as it is and
// only one that does not is coerced, so a readout taking numbers or text keeps a number a number (and its
// precision) even when its own value is text, and a stardate keeps its decimals.
export const bindProps = (
  fixed: Record<string, unknown>,
  bindings: Bindings | undefined,
  nodeId: string,
  environment: SignalEnvironment,
  fits?: (props: Record<string, unknown>) => boolean,
): Record<string, unknown> => {
  if (!bindings) return fixed;
  let props = { ...fixed };
  for (const [prop, binding] of Object.entries(bindings)) {
    const value = bindingValue(binding, nodeId, prop, environment);
    if (value === undefined) continue;
    const raw = { ...props, [prop]: value };
    props = fits?.(raw) ? raw : { ...props, [prop]: coerceTo(value, fixed[prop]) };
  }
  return props;
};
