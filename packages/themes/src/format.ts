import { random, seedOf } from "@interactive-displays/core";

// Small helpers shared by renderers of every theme.

export const formatValue = (value: number | string, precision: number): string =>
  typeof value === "number" ? value.toFixed(precision) : value;

// Where a value sits between min and max, from 0 to 1.
export const fractionOf = (value: number, min: number, max: number): number =>
  Math.min(1, Math.max(0, (value - min) / (max - min)));

// Stable pseudo-random numbers for a node, so decorative noise looks the same on every display and render.
export const noiseFor = (nodeId: string): ((index: number) => number) => {
  const seed = seedOf(nodeId);
  return (index) => random(seed, index);
};

// Speeds for self-animating widgets, in seconds per cycle.
export const ACTIVITY_PERIOD = { still: 0, calm: 2.6, busy: 1.1 } as const;

// Digits for data cascades: numbers of 2 to 6 digits, like a console listing.
export const cascadeLines = (nodeId: string, column: number, count: number): string[] => {
  const next = noiseFor(`${nodeId}/${column}`);
  return Array.from({ length: count }, (_, index) => {
    const digits = 2 + Math.floor(next(index * 2) * 5);
    return String(Math.floor(next(index * 2 + 1) * 10 ** digits)).padStart(digits, "0");
  });
};

// Gauge and status tones: a threshold turns the gauge danger, a status picks its tone.
export const STATUS_TONE = {
  ok: "success",
  info: "info",
  warning: "warning",
  danger: "danger",
  off: "neutral",
} as const;
