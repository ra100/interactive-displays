import { describe, expect, it } from "vitest";
import { createRandom, subSeed } from "./random.ts";

describe("createRandom", () => {
  it("repeats itself for the same seed and differs for another", () => {
    const run = (seed: number) => Array.from({ length: 5 }, createRandom(seed).next);
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it("keeps ints inside their bounds and reaches both ends", () => {
    const random = createRandom(1);
    const seen = new Set(Array.from({ length: 200 }, () => random.int(2, 4)));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it("never picks an entry with no weight", () => {
    const random = createRandom(3);
    const picks = new Set(Array.from({ length: 100 }, () => random.weighted([["a", 1], ["b", 0], ["c", 2]] as const)));
    expect(picks.has("b")).toBe(false);
    expect(picks.size).toBe(2);
  });

  it("shuffles without losing anything", () => {
    expect(createRandom(5).shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });

  it("forks streams that do not depend on how much the parent was used", () => {
    const a = createRandom(9);
    const b = createRandom(9);
    b.next();
    expect(a.fork("panel").next()).toBe(b.fork("panel").next());
    expect(subSeed(9, "a")).not.toBe(subSeed(9, "b"));
  });
});
