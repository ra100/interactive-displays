import type { WidgetNode } from "@interactive-displays/core";
import { createMediaBus } from "@interactive-displays/themes/react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSignalStore, type Live, runControl, useSignalValues } from "./live.ts";

const control = (actions: WidgetNode["actions"]): WidgetNode => ({
  id: "go",
  type: "widget",
  kind: "button",
  props: { label: "GO" },
  ...(actions ? { actions } : {}),
});

const liveWith = (overrides: Partial<Live> = {}): Live & { sent: Array<[string, string]> } => {
  const media = createMediaBus();
  const sent: Array<[string, string]> = [];
  media.subscribe("feed", (command) => sent.push(["feed", command]));
  return { signals: [], store: null, media, sent, ...overrides };
};

describe("signal store", () => {
  it("replaces, merges and tells subscribers", () => {
    const store = createSignalStore({ shields: 40 });
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    store.merge({ hull: 90 });
    expect(store.get()).toEqual({ shields: 40, hull: 90 });
    store.replace({ hull: 10 });
    expect(store.get()).toEqual({ hull: 10 });
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    store.merge({ shields: 1 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("re-renders a component when values change, and nothing without a store", () => {
    const store = createSignalStore({ shields: 40 });
    const { result } = renderHook(() => useSignalValues(store));
    expect(result.current).toEqual({ shields: 40 });
    act(() => store.merge({ shields: 80 }));
    expect(result.current).toEqual({ shields: 80 });

    const none = renderHook(() => useSignalValues(null));
    expect(none.result.current).toEqual({});
  });
});

describe("runControl", () => {
  it("plays the press sound and the control's own sounds and video commands on the display", () => {
    const playSound = vi.fn();
    const press = vi.fn();
    const live = liveWith({ playSound, press });

    runControl(
      live,
      control([
        { do: "sound", sound: "hail" },
        { do: "video", target: "feed", command: "restart" },
      ]),
    );

    expect(playSound.mock.calls).toEqual([["press"], ["hail"]]);
    expect(live.sent).toEqual([["feed", "restart"]]);
    // Nothing for the server to do.
    expect(press).not.toHaveBeenCalled();
  });

  it("sends the press to the server when an action changes more than this display", () => {
    const press = vi.fn();
    runControl(liveWith({ press }), control([{ do: "setSignal", signal: "shields" }]), 70);
    runControl(liveWith({ press }), control([{ do: "navigate", screen: "tactical" }]));
    expect(press.mock.calls).toEqual([
      ["go", 70],
      ["go", undefined],
    ]);
  });

  it("only moves shared values while a control is still moving", () => {
    const playSound = vi.fn();
    const press = vi.fn();
    const live = liveWith({ playSound, press });
    const slider = control([
      { do: "setSignal", signal: "shields" },
      { do: "video", target: "feed", command: "toggle" },
    ]);
    runControl(live, slider, 40, true);
    runControl(live, slider, 60, true);
    runControl(live, control([{ do: "navigate", screen: "tactical" }]), 60, true);
    expect(playSound).not.toHaveBeenCalled();
    expect(live.sent).toEqual([]);
    expect(press.mock.calls).toEqual([
      ["go", 40],
      ["go", 60],
    ]);

    runControl(live, slider, 70);
    expect(playSound.mock.calls).toEqual([["press"]]);
    expect(live.sent).toEqual([["feed", "toggle"]]);
    expect(press).toHaveBeenLastCalledWith("go", 70);
  });

  it("does nothing more than the press sound for a control without actions or a server", () => {
    const playSound = vi.fn();
    runControl(liveWith({ playSound }), control(undefined));
    runControl(liveWith(), control([{ do: "back" }]));
    expect(playSound.mock.calls).toEqual([["press"]]);
  });
});
