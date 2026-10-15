import {
  isSettable,
  isTicking,
  nextManualValue,
  roundValue,
  sampleSource,
  seedOf,
  type Show,
  type SignalDef,
  type SignalValue,
  type SignalValues,
  sourceInState,
} from "@interactive-displays/core";

// The server's half of the live values. Manual signals hold the value someone set (or their initial value);
// ticking ones are worked out from the clock, and only changes go out. Ambient signals never reach the
// server: every display computes its own.
export const createSignals = (saved: Readonly<Record<string, number>>) => {
  const manual = new Map(Object.entries(saved));
  const lastTicked = new Map<string, SignalValue>();

  const manualValue = (signal: SignalDef): number => {
    const stored = manual.get(signal.id);
    if (signal.source.kind !== "manual") return 0;
    return stored === undefined ? signal.source.initial : (nextManualValue(signal, stored, { value: stored }) ?? stored);
  };

  const tickedValue = (signal: SignalDef, state: string, now: number): SignalValue =>
    roundValue(sampleSource(sourceInState(signal, state), seedOf(signal.id), now));

  return {
    // Every server-owned value right now, for snapshots and overviews.
    values: (show: Show, state: string, now: number): SignalValues => {
      const values: SignalValues = {};
      for (const signal of show.signals) {
        if (isSettable(signal)) values[signal.id] = manualValue(signal);
        else if (isTicking(signal)) values[signal.id] = lastTicked.get(signal.id) ?? tickedValue(signal, state, now);
      }
      return values;
    },

    // Moves the ticking signals on to `now`; returns the ones that changed.
    tick: (show: Show, state: string, now: number): SignalValues => {
      const changed: SignalValues = {};
      for (const signal of show.signals) {
        if (!isTicking(signal)) continue;
        const value = tickedValue(signal, state, now);
        if (lastTicked.get(signal.id) === value) continue;
        lastTicked.set(signal.id, value);
        changed[signal.id] = value;
      }
      return changed;
    },

    // Sets a manual signal, clamped to its range and snapped to its step; undefined when nothing changed.
    set: (signal: SignalDef, change: { value?: number; delta?: number }): number | undefined => {
      const current = manualValue(signal);
      const next = nextManualValue(signal, current, change);
      if (next === undefined || next === current) return undefined;
      manual.set(signal.id, next);
      return next;
    },

    current: (signal: SignalDef): number => manualValue(signal),

    // After the show's signals were redefined: forget values of signals that are gone or no longer manual.
    prune: (show: Show): void => {
      const settable = new Set(show.signals.filter(isSettable).map((signal) => signal.id));
      for (const id of manual.keys()) if (!settable.has(id)) manual.delete(id);
      lastTicked.clear();
    },

    // What runtime.json keeps.
    saved: (show: Show): Record<string, number> =>
      Object.fromEntries(show.signals.filter(isSettable).flatMap((signal) => (manual.has(signal.id) ? [[signal.id, manualValue(signal)]] : []))),
  };
};
