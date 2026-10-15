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
// of clocks redraws once a second, together. Thumbnails use a frozen ticker and never redraw.
export interface Ticker {
  now: () => number;
  subscribe: (intervalMs: number, listener: () => void) => () => void;
}

export const createTicker = (clock: () => number = Date.now): Ticker => {
  const groups = new Map<number, { listeners: Set<() => void>; timer: ReturnType<typeof setInterval> }>();
  return {
    now: clock,
    subscribe: (intervalMs, listener) => {
      let group = groups.get(intervalMs);
      if (!group) {
        const listeners = new Set<() => void>();
        const timer = setInterval(() => {
          for (const each of listeners) each();
        }, intervalMs);
        group = { listeners, timer };
        groups.set(intervalMs, group);
      }
      group.listeners.add(listener);
      return () => {
        const current = groups.get(intervalMs);
        if (!current) return;
        current.listeners.delete(listener);
        if (current.listeners.size === 0) {
          clearInterval(current.timer);
          groups.delete(intervalMs);
        }
      };
    },
  };
};

export const frozenTicker = (at: number): Ticker => ({ now: () => at, subscribe: () => () => undefined });

export const TickerContext = createContext<Ticker>(createTicker());

// The current time, refreshed every `intervalMs` (never when null).
export const useNow = (intervalMs: number | null): number => {
  const ticker = useContext(TickerContext);
  const [now, setNow] = useState(() => ticker.now());
  useEffect(() => {
    setNow(ticker.now());
    if (intervalMs === null) return undefined;
    return ticker.subscribe(intervalMs, () => setNow(ticker.now()));
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
