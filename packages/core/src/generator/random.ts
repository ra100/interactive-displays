import { seedOf } from "../signals/sample.ts";

// A seeded random source: the same seed always gives the same screen, so generation is reproducible,
// testable and diffable. `fork` gives an independent stream, so changing one part leaves the others alone.
export interface Random {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
  weighted: <T>(entries: readonly (readonly [T, number])[]) => T;
  fork: (label: string) => Random;
}

// Mulberry32: small, fast and good enough for picking layouts.
const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// A new seed from a seed and a label, such as the seed for one panel of a screen.
export const subSeed = (seed: number, label: string): number => (Math.imul(seed >>> 0, 0x9e3779b1) ^ seedOf(label)) >>> 0;

// A fresh seed for a new screen or a reroll.
export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff) >>> 0;

export const createRandom = (seed: number): Random => {
  const next = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("Nothing to pick from");
    return items[int(0, items.length - 1)] as T;
  };
  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = int(0, index);
      [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
    }
    return copy;
  };
  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const usable = entries.filter(([, weight]) => weight > 0);
    if (usable.length === 0) return pick(entries.map(([item]) => item));
    let roll = next() * usable.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [item, weight] of usable) {
      roll -= weight;
      if (roll < 0) return item;
    }
    return (usable.at(-1) as readonly [T, number])[0];
  };
  return { next, int, pick, shuffle, weighted, fork: (label) => createRandom(subSeed(seed, label)) };
};
