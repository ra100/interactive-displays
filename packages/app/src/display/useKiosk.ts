import { useEffect } from "react";

// How long the pointer may rest before the cursor hides, so a mouse left on a set panel never shows on camera.
export const CURSOR_IDLE_MS = 3000;

type WakeLock = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLock> };

const wakeLockApi = (): WakeLockApi | undefined => (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;

const toggleFullscreen = () => {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void document.documentElement.requestFullscreen?.().catch(() => undefined);
};

// Makes a browser tab behave like a set panel: the screen never sleeps (re-asked whenever the tab comes back),
// the cursor hides when the pointer rests, long presses open no menu, F toggles fullscreen, and with
// `fullscreen` the first touch goes fullscreen (browsers only allow it after a touch or click).
export const useKiosk = ({ fullscreen = false }: { fullscreen?: boolean } = {}) => {
  useEffect(() => {
    const api = wakeLockApi();
    let lock: WakeLock | null = null;
    let active = true;
    const requestLock = () => {
      if (!api || document.visibilityState !== "visible") return;
      api.request("screen").then(
        (granted) => {
          if (active) lock = granted;
          else void granted.release();
        },
        () => undefined,
      );
    };
    requestLock();
    document.addEventListener("visibilitychange", requestLock);

    const body = document.body;
    body.dataset["kiosk"] = "true";
    let idle: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      delete body.dataset["idle"];
      clearTimeout(idle);
      idle = setTimeout(() => {
        body.dataset["idle"] = "true";
      }, CURSOR_IDLE_MS);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);

    const noMenu = (event: Event) => event.preventDefault();
    window.addEventListener("contextmenu", noMenu);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);

    const enterFullscreen = () => {
      if (!document.fullscreenElement) toggleFullscreen();
    };
    if (fullscreen) window.addEventListener("pointerdown", enterFullscreen, { once: true });

    return () => {
      active = false;
      void lock?.release().catch(() => undefined);
      document.removeEventListener("visibilitychange", requestLock);
      clearTimeout(idle);
      delete body.dataset["idle"];
      delete body.dataset["kiosk"];
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("contextmenu", noMenu);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", enterFullscreen);
    };
  }, [fullscreen]);
};
