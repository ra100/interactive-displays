import type { Sound } from "@interactive-displays/core";
import { describe, expect, it, vi } from "vitest";
import { type AudioTarget, createSoundPlayer, scheduleSound } from "./sound.ts";

interface Recorded {
  oscillators: Array<{ type: string; start: number; stop: number; freq: Array<[string, number, number]> }>;
  resumed: number;
}

// Records what the player asks Web Audio for, without making any sound.
const fakeAudio = (state: AudioContextState = "running"): AudioTarget & { recorded: Recorded } => {
  const recorded: Recorded = { oscillators: [], resumed: 0 };
  const param = (log: Array<[string, number, number]>) => ({
    setValueAtTime: (value: number, at: number) => log.push(["set", value, at]),
    linearRampToValueAtTime: (value: number, at: number) => log.push(["ramp", value, at]),
  });
  const context = {
    currentTime: 10,
    destination: {},
    state: state as AudioContextState,
    resume: () => {
      recorded.resumed += 1;
      context.state = "running";
      return Promise.resolve();
    },
    createOscillator: () => {
      const entry = { type: "", start: 0, stop: 0, freq: [] as Array<[string, number, number]> };
      recorded.oscillators.push(entry);
      return {
        set type(value: string) {
          entry.type = value;
        },
        frequency: param(entry.freq),
        connect: (node: unknown) => node,
        start: (at: number) => {
          entry.start = at;
        },
        stop: (at: number) => {
          entry.stop = at;
        },
      };
    },
    createGain: () => ({ gain: param([]), connect: (node: unknown) => node }),
    recorded,
  };
  return context as unknown as AudioTarget & { recorded: Recorded };
};

const round = (seconds: number) => Math.round(seconds * 1000) / 1000;

const twoTone: Sound = {
  steps: [
    { freq: 880, ms: 200, wave: "square", gain: 0.1 },
    { freq: 0, ms: 100, wave: "sine", gain: 0 },
    { freq: 440, to: 660, ms: 100, wave: "sine", gain: 0.1 },
  ],
  repeat: 2,
};

describe("scheduleSound", () => {
  it("plays each audible step in turn, rests on silent ones and repeats", () => {
    const audio = fakeAudio();
    const end = scheduleSound(audio, twoTone, 0);

    expect(end).toBeCloseTo(0.8);
    expect(audio.recorded.oscillators.map((each) => [each.type, round(each.start)])).toEqual([
      ["square", 0],
      ["sine", 0.3],
      ["square", 0.4],
      ["sine", 0.7],
    ]);
    // The glide ramps to its target by the end of the step.
    expect(audio.recorded.oscillators[1]?.freq.map(([kind, value, at]) => [kind, value, round(at)])).toEqual([
      ["set", 440, 0.3],
      ["ramp", 660, 0.4],
    ]);
  });
});

describe("createSoundPlayer", () => {
  it("makes the audio context on first use, starts it when the page may and ignores unknown sounds", async () => {
    const audio = fakeAudio("suspended");
    const make = vi.fn(() => audio);
    const player = createSoundPlayer(make);
    expect(make).not.toHaveBeenCalled();

    player.play("base", "nope");
    expect(make).not.toHaveBeenCalled();

    player.play("base", "confirm");
    await Promise.resolve();
    player.play("lcars", "hail");
    expect(make).toHaveBeenCalledTimes(1);
    expect(audio.recorded.resumed).toBe(1);
    expect(audio.recorded.oscillators.length).toBeGreaterThan(1);
  });

  it("drops sounds asked for before the page may play audio, instead of playing them all on the first touch", async () => {
    const audio = fakeAudio("suspended");
    let allow = () => {};
    // A browser keeps resume() waiting until the first touch.
    (audio as unknown as { resume: () => Promise<void> }).resume = () =>
      new Promise<void>((resolve) => {
        allow = () => {
          (audio as unknown as { state: AudioContextState }).state = "running";
          resolve();
        };
      });
    let now = 0;
    const player = createSoundPlayer(() => audio, () => now);

    player.play("base", "warning");
    player.play("base", "alert");
    now = 60_000;
    allow();
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.recorded.oscillators).toHaveLength(0);

    player.play("base", "press");
    expect(audio.recorded.oscillators.length).toBeGreaterThan(0);
  });

  it("stays quiet where the browser has no Web Audio", () => {
    const player = createSoundPlayer(() => null);
    expect(() => player.play("base", "press")).not.toThrow();
  });
});
