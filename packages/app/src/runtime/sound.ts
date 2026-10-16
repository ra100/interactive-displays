import type { Sound } from "@interactive-displays/core";
import { getThemeSound } from "@interactive-displays/themes/manifest";

// The part of the Web Audio API the player uses, so tests can pass a fake.
export type AudioTarget = Pick<AudioContext, "currentTime" | "destination" | "state" | "resume" | "createOscillator" | "createGain">;

const FADE_S = 0.005;

// Schedules a theme sound: each step is one oscillator with a tiny fade in and out, so nothing clicks.
// Returns when it ends.
export const scheduleSound = (context: AudioTarget, sound: Sound, start: number = context.currentTime + 0.01): number => {
  let at = start;
  for (let round = 0; round < sound.repeat; round += 1) {
    for (const step of sound.steps) {
      const end = at + step.ms / 1000;
      if (step.gain > 0) {
        const oscillator = context.createOscillator();
        oscillator.type = step.wave;
        oscillator.frequency.setValueAtTime(step.freq, at);
        if (step.to !== undefined) oscillator.frequency.linearRampToValueAtTime(step.to, end);
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(step.gain, at + FADE_S);
        gain.gain.setValueAtTime(step.gain, Math.max(at + FADE_S, end - FADE_S));
        gain.gain.linearRampToValueAtTime(0, end);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(end + 0.02);
      }
      at = end;
    }
  }
  return at;
};

const browserAudio = (): AudioTarget | null => (typeof AudioContext === "undefined" ? null : new AudioContext());

// A sound that cannot start within this long is dropped rather than played late.
const LATE_MS = 150;

// Plays theme sounds. The audio context is made on first use: browsers only let a page make sound after a
// touch, unless the kiosk browser allows autoplay (see the deployment guide). Until then the context stays
// suspended and its clock stands still, so a sound scheduled on it would wait and then play together with
// every other one at the first touch; such sounds are dropped instead.
export const createSoundPlayer = (makeContext: () => AudioTarget | null = browserAudio, clock: () => number = Date.now) => {
  let context: AudioTarget | null = null;
  return {
    play: (themeId: string, soundId: string): void => {
      const sound = getThemeSound(themeId, soundId);
      if (!sound) return;
      context ??= makeContext();
      const target = context;
      if (!target) return;
      if (target.state === "running") {
        scheduleSound(target, sound);
        return;
      }
      const asked = clock();
      target.resume().then(
        () => {
          if (target.state === "running" && clock() - asked <= LATE_MS) scheduleSound(target, sound);
        },
        () => undefined,
      );
    },
  };
};

export type SoundPlayer = ReturnType<typeof createSoundPlayer>;
