import { isRemoteAction, isServerAction, type SignalDef, type SignalValues, type WidgetNode } from "@interactive-displays/core";
import { createMediaBus, type MediaBus } from "@interactive-displays/themes/react";
import { createContext, useContext, useSyncExternalStore } from "react";

// Shared signal values from the server. Kept outside React state so a value ticking four times a second
// re-renders the widgets bound to it, not the whole page.
export interface SignalStore {
  get: () => SignalValues;
  replace: (values: SignalValues) => void;
  merge: (values: SignalValues) => void;
  subscribe: (listener: () => void) => () => void;
}

export const createSignalStore = (initial: SignalValues = {}): SignalStore => {
  let values = initial;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    get: () => values,
    replace: (next) => {
      values = next;
      notify();
    },
    merge: (changed) => {
      values = { ...values, ...changed };
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const EMPTY: SignalValues = {};
const noSubscription = () => () => undefined;

// The store's values, re-rendering when they change; null subscribes to nothing (unbound widgets).
export const useSignalValues = (store: SignalStore | null): SignalValues =>
  useSyncExternalStore(store?.subscribe ?? noSubscription, () => store?.get() ?? EMPTY);

// Everything a screen needs to come alive. Displays get all of it; the editor preview gets values but no
// server; thumbnails and the gallery get the defaults.
export interface Live {
  signals: readonly SignalDef[];
  store: SignalStore | null;
  media: MediaBus;
  // Sends a control's use to the server, which runs navigation, state and shared signal actions.
  press?: ((nodeId: string, value?: number, moving?: boolean) => void) | undefined;
  // Plays a theme sound; the player decides whether sounds are on.
  playSound?: ((soundId: string) => void) | undefined;
}

export const LiveContext = createContext<Live>({ signals: [], store: null, media: createMediaBus() });

export const useLive = (): Live => useContext(LiveContext);

// What a display does itself when an actor uses a control: a press sound, the control's own sounds and
// video commands, and the rest goes to the server. While a control is still `moving` (a slider being dragged)
// only its shared values follow it; the sounds, video and other actions run once, where the actor lets go.
export const runControl = (live: Live, node: WidgetNode, value?: number, moving = false): void => {
  const actions = node.actions ?? [];
  if (moving) {
    if (live.press && actions.some((action) => action.do === "setSignal")) live.press(node.id, value, true);
    return;
  }
  runLocal(live, node);
  if (live.press && actions.some(isServerAction)) live.press(node.id, value);
};

// What a display does itself for a control used here or, through a trigger, from another display: the press
// sound, and the control's sounds and video commands that are for this display and run at once. The server
// runs the rest, including the delayed ones and those for other displays.
export const runLocal = (live: Live, node: WidgetNode): void => {
  live.playSound?.("press");
  for (const action of node.actions ?? []) {
    if (isRemoteAction(action)) continue;
    if (action.do === "sound") live.playSound?.(action.sound);
    if (action.do === "video") live.media.send(action.target, action.command);
  }
};
