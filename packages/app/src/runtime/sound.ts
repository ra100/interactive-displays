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

// Plays theme sounds. The audio context is made on first use: browsers only let a page make sound after a
// touch, unless the kiosk browser allows autoplay (see the deployment guide).
export const createSoundPlayer = (makeContext: () => AudioTarget | null = browserAudio) => {
  let context: AudioTarget | null = null;
  return {
    play: (themeId: string, soundId: string): void => {
      const sound = getThemeSound(themeId, soundId);
      if (!sound) return;
      context ??= makeContext();
      if (!context) return;
      if (context.state === "suspended") context.resume().catch(() => undefined);
      scheduleSound(context, sound);
    },
  };
};

export type SoundPlayer = ReturnType<typeof createSoundPlayer>;
