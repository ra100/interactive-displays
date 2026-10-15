import type { Effect, VideoCommand } from "@interactive-displays/core";
import { createContext, useContext, useEffect, useRef, useState } from "react";

// What renderers may know about the world around them, provided by the display runtime. Renderers stay
// plain components: tests and galleries render them without any of this and get sensible defaults.

// The current show state, for widgets that show it (an alert banner shows the state's banner text).
export interface ShowStateInfo {
  id: string;
  label: string;
  effect: Effect;
  banner?: string;
}

const NORMAL: ShowStateInfo = { id: "normal", label: "Normal", effect: "none" };

export const ShowStateInfoContext = createContext<ShowStateInfo>(NORMAL);

export const useShowStateInfo = (): ShowStateInfo => useContext(ShowStateInfoContext);

// Time for clocks and traces. One timer per interval drives every widget that asks for it, so a screen full
// of clocks redraws once a second, together. Ticks land on whole multiples of the interval by the wall clock,
// so displays whose clocks agree (set by the network) redraw together and, with useNow, work out the same
// values for things that wander. Thumbnails use a frozen ticker and never redraw.
export interface Ticker {
  now: () => number;
  subscribe: (intervalMs: number, listener: () => void) => () => void;
}

export const createTicker = (clock: () => number = Date.now): Ticker => {
  const groups = new Map<number, { listeners: Set<() => void>; timer: ReturnType<typeof setTimeout> | undefined }>();
  return {
    now: clock,
    subscribe: (intervalMs, listener) => {
      let group = groups.get(intervalMs);
      if (!group) {
        const created: { listeners: Set<() => void>; timer: ReturnType<typeof setTimeout> | undefined } = {
          listeners: new Set(),
          timer: undefined,
        };
        const schedule = () => {
          const into = ((clock() % intervalMs) + intervalMs) % intervalMs;
          created.timer = setTimeout(() => {
            for (const each of created.listeners) each();
            schedule();
          }, intervalMs - into);
        };
        schedule();
        group = created;
        groups.set(intervalMs, group);
      }
      group.listeners.add(listener);
      return () => {
        const current = groups.get(intervalMs);
        if (!current) return;
        current.listeners.delete(listener);
        if (current.listeners.size === 0) {
          clearTimeout(current.timer);
          groups.delete(intervalMs);
        }
      };
    },
  };
};

export const frozenTicker = (at: number): Ticker => ({ now: () => at, subscribe: () => () => undefined });

export const TickerContext = createContext<Ticker>(createTicker());

// The current time, refreshed every `intervalMs` (never when null) and rounded down to a whole interval, so two
// displays drawing the same moment draw the same thing.
const timeIn = (ticker: Ticker, intervalMs: number | null): number =>
  intervalMs === null ? ticker.now() : Math.floor(ticker.now() / intervalMs) * intervalMs;

export const useNow = (intervalMs: number | null): number => {
  const ticker = useContext(TickerContext);
  const [now, setNow] = useState(() => timeIn(ticker, intervalMs));
  useEffect(() => {
    setNow(timeIn(ticker, intervalMs));
    if (intervalMs === null) return undefined;
    return ticker.subscribe(intervalMs, () => setNow(timeIn(ticker, intervalMs)));
  }, [ticker, intervalMs]);
  return now;
};

// True in thumbnails and screenshots: time stands still, so videos stay on their first frame.
export const StillContext = createContext(false);

export const useStill = (): boolean => useContext(StillContext);

// Commands for video widgets, from display buttons and the operator console, addressed by node id.
export type MediaListener = (command: VideoCommand) => void;

export interface MediaBus {
  send: (target: string, command: VideoCommand) => void;
  subscribe: (target: string, listener: MediaListener) => () => void;
}

export const createMediaBus = (): MediaBus => {
  const listeners = new Map<string, Set<MediaListener>>();
  return {
    send: (target, command) => {
      for (const listener of listeners.get(target) ?? []) listener(command);
    },
    subscribe: (target, listener) => {
      const set = listeners.get(target) ?? new Set<MediaListener>();
      set.add(listener);
      listeners.set(target, set);
      return () => set.delete(listener);
    },
  };
};

export const MediaBusContext = createContext<MediaBus | null>(null);

// Calls `listener` for every command sent to this node; the latest listener wins without resubscribing.
export const useMediaCommands = (nodeId: string, listener: MediaListener): void => {
  const bus = useContext(MediaBusContext);
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => bus?.subscribe(nodeId, (command) => latest.current(command)), [bus, nodeId]);
};

// A short, camera-visible flash on press: :active alone can be too brief to see on a quick tap.
export const usePressFlash = (): { flashing: boolean; flash: () => void } => {
  const [flashing, setFlashing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    flashing,
    flash: () => {
      clearTimeout(timer.current);
      setFlashing(true);
      timer.current = setTimeout(() => setFlashing(false), 180);
    },
  };
};

// How long a control keeps showing what the actor chose before it shows its props again.
export const CONTROL_SETTLE_MS = 1500;

// A control's value: answers a touch at once, then follows its props. While the actor is using it, prop
// changes wait (they are mostly the server echoing values this control sent a moment ago, which would make a
// dragged thumb jump back). Once the control settles, a bound control shows its props again even if they never
// changed, so a change the server refused or ignored does not leave it out of step with every other display;
// an unbound control keeps the actor's choice unless its props changed meanwhile.
export const useControlValue = <T,>(value: T, bound: boolean): [T, (next: T) => void] => {
  const [local, setLocal] = useState(value);
  const latest = useRef(value);
  const before = useRef(value);
  const settling = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    latest.current = value;
    if (settling.current === undefined) setLocal(value);
  }, [value]);
  useEffect(() => () => clearTimeout(settling.current), []);
  const use = (next: T) => {
    if (settling.current === undefined) before.current = latest.current;
    setLocal(next);
    clearTimeout(settling.current);
    settling.current = setTimeout(() => {
      settling.current = undefined;
      if (bound || !Object.is(latest.current, before.current)) setLocal(latest.current);
    }, CONTROL_SETTLE_MS);
  };
  return [local, use];
};
