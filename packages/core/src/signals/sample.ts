import type { AmbientSource, SignalDef, SignalValue, Source, SourceOverride } from "../schema/signal.ts";

// Signal values are pure functions of a seed and the time, so every display (and the server) can compute an
// ambient value on its own, a display keeps animating when the server is away, and tests are deterministic.

// FNV-1a: a stable 32-bit seed from a signal or node id.
export const seedOf = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

// A well-mixed pseudo-random number in [0, 1) for a seed and an integer step.
export const random = (seed: number, step: number): number => {
  let hash = (seed ^ Math.imul(step | 0, 0x27d4eb2d)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

// Smooth 1D value noise in [0, 1].
const noise = (seed: number, x: number): number => {
  const left = Math.floor(x);
  const t = smooth(x - left);
  const a = random(seed, left);
  const b = random(seed, left + 1);
  return a + (b - a) * t;
};

// Two octaves: a slow drift with a little restlessness on top, which reads as "a real instrument".
export const wander = (seed: number, x: number): number => 0.75 * noise(seed, x) + 0.25 * noise(seed ^ 0x9e3779b9, x * 3.7 + 11);

// Knots per second: how often the walk picks a new direction.
const walkRate = (volatility: number): number => 0.08 + volatility * 1.2;

const STARDATE_EPOCH = Date.UTC(2026, 0, 1);
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, "0");

// TNG-style stardates that move like the show's: about 1000 per year, one decimal.
export const stardate = (now: number): string => (47000 + ((now - STARDATE_EPOCH) / YEAR_MS) * 1000).toFixed(1);

export const formatClock = (format: "time" | "date" | "stardate", now: number): string => {
  const date = new Date(now);
  if (format === "stardate") return stardate(now);
  if (format === "date") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const sampleAmbient = (source: AmbientSource, seed: number, now: number): number => {
  const span = source.max - source.min;
  if (source.kind === "wave") {
    const phase = (now % source.periodMs) / source.periodMs;
    return source.min + span * ((1 - Math.cos(2 * Math.PI * phase)) / 2);
  }
  return source.min + span * wander(seed, (now / 1000) * walkRate(source.volatility));
};

// The value of a source at a time. Manual sources answer their initial value; the server holds the real one.
export const sampleSource = (source: Source, seed: number, now: number): SignalValue => {
  switch (source.kind) {
    case "static":
      return source.value;
    case "walk":
    case "wave":
      return sampleAmbient(source, seed, now);
    case "clock":
      return formatClock(source.format, now);
    case "manual":
      return manualStart(source);
  }
};

// The signal's source with its per-state override applied, e.g. a warp output that runs hotter in red alert.
// An override that would make the source invalid (min above max) is ignored.
export const sourceInState = (signal: Pick<SignalDef, "source" | "byState">, state: string): Source => {
  const override: SourceOverride | undefined = signal.byState?.[state];
  if (!override) return signal.source;
  const { source } = signal;
  switch (source.kind) {
    case "static":
      return override.value === undefined ? source : { ...source, value: override.value };
    case "walk": {
      const next = {
        ...source,
        min: override.min ?? source.min,
        max: override.max ?? source.max,
        volatility: override.volatility ?? source.volatility,
      };
      return next.min < next.max ? next : source;
    }
    case "wave": {
      const next = {
        ...source,
        min: override.min ?? source.min,
        max: override.max ?? source.max,
        periodMs: override.periodMs ?? source.periodMs,
      };
      return next.min < next.max ? next : source;
    }
    default:
      return source;
  }
};

// Shared signals whose value the server works out as time passes; manual ones change only when told.
export const isTicking = (signal: Pick<SignalDef, "scope" | "source">): boolean =>
  signal.scope === "shared" && (signal.source.kind === "walk" || signal.source.kind === "wave");

// Shared signals whose value the operator or a display control sets.
export const isSettable = (signal: Pick<SignalDef, "scope" | "source">): boolean =>
  signal.scope === "shared" && signal.source.kind === "manual";

// Signals whose live value comes from the server rather than from the display's own clock.
export const isServerOwned = (signal: Pick<SignalDef, "scope" | "source">): boolean =>
  isSettable(signal) || isTicking(signal);

type ManualSource = Extract<Source, { kind: "manual" }>;

// The nearest value on the step grid from min, or the range's top when that is nearer: a range that the step
// does not divide evenly (0 to 100 in steps of 30) can still reach and keep its maximum.
const snapToStep = (source: ManualSource, raw: number): number => {
  const clamped = Math.min(source.max, Math.max(source.min, raw));
  const below = Math.min(source.max, source.min + Math.round((clamped - source.min) / source.step) * source.step);
  const snapped = Math.abs(source.max - clamped) < Math.abs(below - clamped) ? source.max : below;
  return Number(snapped.toFixed(6));
};

// A manual signal's value before anyone sets it: its initial value, kept in its range and on its step.
export const manualStart = (source: ManualSource): number => snapToStep(source, source.initial);

// Applies a setSignal to a manual signal: clamped to its range and snapped to its step. A delta moves by
// whole steps and always at least one in its direction, so "up by 1" on a signal stepping by 5 still moves.
export const nextManualValue = (
  signal: Pick<SignalDef, "source">,
  current: number,
  change: { value?: number; delta?: number },
): number | undefined => {
  const { source } = signal;
  if (source.kind !== "manual") return undefined;
  if (change.value !== undefined) return snapToStep(source, change.value);
  const delta = change.delta ?? 0;
  if (delta === 0) return snapToStep(source, current);
  const steps = Math.max(1, Math.round(Math.abs(delta) / source.step));
  // Count whole steps along the grid from min; the range's top counts as one more stop above the last one.
  const position = (snapToStep(source, current) - source.min) / source.step;
  const index = delta > 0 ? Math.floor(position + 1e-9) + steps : Math.ceil(position - 1e-9) - steps;
  const next = Math.min(source.max, Math.max(source.min, source.min + index * source.step));
  return Number(next.toFixed(6));
};

// Rounded for the wire and for change detection: two decimals are plenty for anything on a screen.
export const roundValue = (value: SignalValue): SignalValue =>
  typeof value === "number" ? Math.round(value * 100) / 100 : value;
