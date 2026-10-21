// Slow motion for the showcase recording: time runs `rate` times as fast (a third, say) for the server and every
// page, so a busy machine still captures enough frames; the video is then played back at full speed. Clocks
// (Date, performance.now), timers, animation frames and videos slow down here; the recorder slows CSS animations
// and transitions through the DevTools protocol. `epoch` (ms since 1970) is the moment both clocks agree on, so
// the server and the displays keep the same time. The function is self-contained: it also runs in the browser,
// before any page script.
export const warpTime = ({ rate, epoch }: { rate: number; epoch: number }): void => {
  if (rate === 1) return;
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  // Whole milliseconds, as Date.now always gives.
  const now = () => Math.floor(epoch + (realNow() - epoch) * rate);
  globalThis.Date = new Proxy(RealDate, {
    construct: (target, args, newTarget) => Reflect.construct(target, args.length ? args : [now()], newTarget),
    apply: () => new RealDate(now()).toString(),
    get: (target, key, receiver) => (key === "now" ? now : Reflect.get(target, key, receiver)),
  });

  const clock = globalThis.performance;
  const realPerformanceNow = clock.now.bind(clock);
  clock.now = () => realPerformanceNow() * rate;

  const realSetTimeout = globalThis.setTimeout;
  const realSetInterval = globalThis.setInterval;
  globalThis.setTimeout = ((handler: () => void, delay = 0, ...args: unknown[]) =>
    realSetTimeout(handler, delay / rate, ...args)) as typeof setTimeout;
  globalThis.setInterval = ((handler: () => void, delay = 0, ...args: unknown[]) =>
    realSetInterval(handler, delay / rate, ...args)) as typeof setInterval;

  if (typeof globalThis.requestAnimationFrame === "function") {
    const realFrame = globalThis.requestAnimationFrame.bind(globalThis);
    globalThis.requestAnimationFrame = (callback) => realFrame((time) => callback(time * rate));
  }
  // Videos play slowly too.
  if (typeof document !== "undefined") {
    document.addEventListener(
      "play",
      (event) => {
        if (event.target instanceof HTMLMediaElement) event.target.playbackRate = rate;
      },
      true,
    );
  }
};
