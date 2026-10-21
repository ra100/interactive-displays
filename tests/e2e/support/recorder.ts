import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

// Records a page in slow motion for the showcase video: its CSS animations and transitions run at `rate` (the
// clocks and timers slow down through warpTime, see slowmo.ts), and Chrome's screencast frames are played back at
// full speed.

// Picks the frames of a video at `fps` from screencast frames stamped with the moment they were drawn (seconds).
// Each frame is on screen until the next, so only the one on screen at a tick is kept, once. Frames can arrive a
// little out of order: one drawn before a frame already seen is dropped, so the picture never steps back.
export const frameTicker = <Frame>(fps: number, rate: number, keep: (frame: Frame, tick: number) => void) => {
  let first: number | undefined;
  let newest = Number.NEGATIVE_INFINITY;
  let latest: { frame: Frame; tick: number } | undefined;
  return {
    add: (frame: Frame, time: number) => {
      if (time <= newest) return;
      newest = time;
      first ??= time;
      const tick = Math.ceil((time - first) * rate * fps);
      if (latest && latest.tick < tick) keep(latest.frame, latest.tick);
      latest = { frame, tick };
    },
    // The last frame, at the end of the recording.
    flush: () => {
      if (latest) keep(latest.frame, latest.tick);
      latest = undefined;
    },
  };
};

// An ffmpeg concat list that holds each kept frame until the next one's tick. Every entry says its frame rate:
// without it ffmpeg reads each picture at 25 fps and drops or doubles a frame in every six.
export const concatList = (kept: { name: string; tick: number }[], fps: number): string => {
  const lines = ["ffconcat version 1.0"];
  kept.forEach((frame, index) => {
    const ticks = (kept[index + 1]?.tick ?? frame.tick + 1) - frame.tick;
    lines.push(`file ${frame.name}`, `option framerate ${fps}`, `duration ${(ticks / fps).toFixed(6)}`);
  });
  const last = kept.at(-1);
  if (last) lines.push(`file ${last.name}`, `option framerate ${fps}`);
  return `${lines.join("\n")}\n`;
};

// Encodes a concat list into an H.264 video at `fps` (ffmpeg with libx264 on the PATH); `output` swaps the
// encoder's settings for others (raw frames in the tests).
const H264 = ["-c:v", "libx264", "-preset", "slow", "-crf", "26", "-tune", "animation", "-movflags", "+faststart"];
export const encode = (list: string, out: string, fps: number, output = H264): SpawnSyncReturns<Buffer> =>
  spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", `fps=${fps},format=yuv420p`, ...output, out],
    { stdio: "inherit" },
  );

// Slows the page's animations down, then records it from record() to stop(). One DevTools session does both: a
// second session puts the animations back to full speed as soon as a frame loads a page.
export const slowMotion = async (page: Page, rate: number) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
  return {
    // How fast the page's animations run now (`rate` while all is well).
    playbackRate: async () => (await cdp.send("Animation.getPlaybackRate")).playbackRate,
    // Records into `dir` at `fps`; stop() writes an ffmpeg concat list and returns its path.
    record: async (dir: string, fps: number) => {
      const kept: { name: string; tick: number }[] = [];
      let stopped = false;
      const ticker = frameTicker<string>(fps, rate, (data, tick) => {
        const name = `frame-${String(kept.length).padStart(6, "0")}.jpg`;
        writeFileSync(path.join(dir, name), Buffer.from(data, "base64"));
        kept.push({ name, tick });
      });
      cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
        cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
        // Frames still in flight after stop() are dropped: their folder may already be gone.
        if (!stopped) ticker.add(data, metadata.timestamp ?? 0);
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
      return {
        stop: async () => {
          stopped = true;
          await cdp.send("Page.stopScreencast");
          ticker.flush();
          const list = path.join(dir, "frames.txt");
          writeFileSync(list, concatList(kept, fps));
          console.log(`${kept.length} frames for ${((kept.at(-1)?.tick ?? 0) / fps).toFixed(1)} s of video`);
          return list;
        },
      };
    },
  };
};
