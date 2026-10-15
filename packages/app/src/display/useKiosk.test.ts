import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURSOR_IDLE_MS, useKiosk } from "./useKiosk.ts";

const release = vi.fn(() => Promise.resolve());
const request = vi.fn(() => Promise.resolve({ release }));

beforeEach(() => {
  vi.useFakeTimers();
  request.mockClear();
  release.mockClear();
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("useKiosk", () => {
  it("keeps the screen awake, asks again when the tab comes back, and lets go on unmount", async () => {
    const { unmount } = renderHook(() => useKiosk());
    expect(request).toHaveBeenCalledWith("screen");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    expect(release).toHaveBeenCalled();
  });

  it("hides the cursor once the pointer rests and shows it when it moves", () => {
    const { unmount } = renderHook(() => useKiosk());
    expect(document.body.dataset["kiosk"]).toBe("true");
    expect(document.body.dataset["idle"]).toBeUndefined();
    act(() => vi.advanceTimersByTime(CURSOR_IDLE_MS));
    expect(document.body.dataset["idle"]).toBe("true");
    fireEvent.pointerMove(window);
    expect(document.body.dataset["idle"]).toBeUndefined();
    unmount();
    expect(document.body.dataset["kiosk"]).toBeUndefined();
  });

  it("opens no menu on a long press", () => {
    renderHook(() => useKiosk());
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("goes fullscreen on the first touch when asked", () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = requestFullscreen;
    renderHook(() => useKiosk({ fullscreen: true }));
    fireEvent.pointerDown(window);
    fireEvent.pointerDown(window);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
