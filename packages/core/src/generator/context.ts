import type { Action } from "../schema/action.ts";
import type { ContentPack, Recipe, Vocab } from "../schema/content.ts";
import type { Effect, StateDef } from "../schema/show.ts";
import type { SignalDef } from "../schema/signal.ts";
import type { Tone } from "../schema/tone.ts";
import { isSettable } from "../signals/sample.ts";
import { uniqueId } from "../tree/ids.ts";
import type { Random } from "./random.ts";

// What the generator knows about the show it generates for: its states (red alert makes generated gauges swing),
// signals (a reading can follow one) and screens (buttons may navigate to them).
export interface ShowContext {
  states: readonly Pick<StateDef, "id" | "effect">[];
  signals?: readonly SignalDef[];
  screens?: readonly string[];
}

export interface ToneRules {
  nav: readonly Tone[];
  panels: readonly Tone[];
}

// Shared by every step of one generation.
export interface Context {
  pack: ContentPack;
  recipe: Recipe;
  show: ShowContext;
  tones: ToneRules;
  // Ids already used on the screen, including the locked parts it keeps.
  taken: Set<string>;
}

const ALERTING: readonly Effect[] = ["alert", "damaged"];
const BANNERED: readonly Effect[] = ["warning", "alert", "damaged"];

// States in which readings run to their alert range and emphasised parts turn danger.
export const alertStates = (show: ShowContext): string[] =>
  show.states.filter((state) => ALERTING.includes(state.effect)).map((state) => state.id);

// States in which an alert banner shows.
export const bannerStates = (show: ShowContext): string[] =>
  show.states.filter((state) => BANNERED.includes(state.effect)).map((state) => state.id);

export const freshId = (context: Context, stem: string): string => {
  const id = uniqueId(stem, context.taken);
  context.taken.add(id);
  return id;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// "##-####" → "04-7731": # is a digit, @ a capital letter.
export const makeCode = (format: string, random: Random): string =>
  format.replace(/[#@]/g, (mark) => (mark === "#" ? String(random.int(0, 9)) : (LETTERS[random.int(0, 25)] ?? "A")));

export const code = (vocab: Vocab, random: Random): string => makeCode(random.pick(vocab.codeFormats), random);

// A line of technobabble about a system.
export const phrase = (vocab: Vocab, system: string, random: Random): string =>
  random
    .pick(vocab.phrases)
    .replace(/\{system\}/g, system)
    .replace(/\{word\}/g, () => random.pick(vocab.words));

// Actions a generated button may carry: only what this show can do, so nothing points at a missing state,
// signal or screen. Video actions need a video on the same screen, which generated screens do not have.
export const usableActions = (actions: readonly Action[] | undefined, show: ShowContext): Action[] =>
  (actions ?? []).filter((action) => {
    switch (action.do) {
      case "setState":
        return show.states.some((state) => state.id === action.state);
      case "setSignal":
        return (show.signals ?? []).some((signal) => signal.id === action.signal && isSettable(signal));
      case "navigate":
        return (show.screens ?? []).includes(action.screen);
      case "video":
        return false;
      default:
        return true;
    }
  });

export const toneAt = (tones: readonly Tone[], index: number): Tone => tones[index % tones.length] ?? "primary";

