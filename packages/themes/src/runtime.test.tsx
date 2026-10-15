import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMediaBus, createTicker, frozenTicker, MediaBusContext, TickerContext, useMediaCommands, useNow, usePressFlash } from "./runtime.ts";

afterEach(() => {
  vi.useRealTimers();
});

const Now = ({ every }: { every: number | null }) => <span data-testid="now">{useNow(every)}</span>;

describe("ticker", () => {
  it("shares one timer per interval and stops it when the last listener leaves", () => {
    vi.useFakeTimers();
    const ticker = createTicker(() => 0);
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = ticker.subscribe(1000, first);
    const stopSecond = ticker.subscribe(1000, second);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);

    stopFirst();
    expect(vi.getTimerCount()).toBe(1);
    stopSecond();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("redraws useNow on each tick", () => {
    vi.useFakeTimers();
    let clock = 1000;
    const ticker = createTicker(() => clock);
    render(
      <TickerContext.Provider value={ticker}>
        <Now every={500} />
      </TickerContext.Provider>,
    );
    expect(screen.getByTestId("now")).toHaveTextContent("1000");
    clock = 1500;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId("now")).toHaveTextContent("1500");
  });

  it("never moves a frozen ticker, so thumbnails stay still", () => {
    render(
      <TickerContext.Provider value={frozenTicker(42)}>
        <Now every={100} />
      </TickerContext.Provider>,
    );
    expect(screen.getByTestId("now")).toHaveTextContent("42");
  });
});

describe("media bus", () => {
  const Listener = ({ nodeId, onCommand }: { nodeId: string; onCommand: (command: string) => void }) => {
    useMediaCommands(nodeId, onCommand);
    return null;
  };

  it("delivers commands to the addressed node only", () => {
    const bus = createMediaBus();
    const screenVideo = vi.fn();
    const other = vi.fn();
    render(
      <MediaBusContext.Provider value={bus}>
        <Listener nodeId="viewscreen" onCommand={screenVideo} />
        <Listener nodeId="other" onCommand={other} />
      </MediaBusContext.Provider>,
    );
    bus.send("viewscreen", "pause");
    expect(screenVideo).toHaveBeenCalledWith("pause");
    expect(other).not.toHaveBeenCalled();
  });

  it("stops delivering after unmount", () => {
    const bus = createMediaBus();
    const listener = vi.fn();
    const { unmount } = render(
      <MediaBusContext.Provider value={bus}>
        <Listener nodeId="viewscreen" onCommand={listener} />
      </MediaBusContext.Provider>,
    );
    unmount();
    bus.send("viewscreen", "play");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("usePressFlash", () => {
  const Flash = () => {
    const { flashing, flash } = usePressFlash();
    return (
      <button type="button" data-flash={flashing} onClick={flash}>
        press
      </button>
    );
  };

  it("flashes briefly on press", () => {
    vi.useFakeTimers();
    render(<Flash />);
    const button = screen.getByRole("button");
    act(() => button.click());
    expect(button).toHaveAttribute("data-flash", "true");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(button).toHaveAttribute("data-flash", "false");
  });
});
