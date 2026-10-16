import { random, seedOf } from "@interactive-displays/core";

// Geometry for the scan, tactical and navigation widgets, shared by every theme. Everything is seeded from the
// node id, so a chart or a trace looks the same on every display and every render.

export const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

const round = (value: number): string => value.toFixed(2);

export type WaveShape = "sine" | "pulse" | "noise" | "heartbeat";

const SAMPLES = 120;

// One beat of an ECG trace (P wave, QRS spike, T wave) at phase 0..1, from -1 to 1.
const beat = (phase: number): number => {
  const bump = (centre: number, width: number, height: number) => height * Math.exp(-(((phase - centre) / width) ** 2));
  return bump(0.18, 0.035, 0.18) + bump(0.36, 0.012, -0.22) + bump(0.4, 0.014, 1) + bump(0.44, 0.012, -0.35) + bump(0.66, 0.06, 0.3);
};

// A trace that repeats exactly every 100 units of x, drawn twice (0 to 200), so scrolling it by half loops
// without a seam. `amplitude` is a share of half the height.
export const wavePath = (shape: WaveShape, seedKey: string, amplitude: number): string => {
  const seed = seedOf(seedKey);
  const next = (index: number) => random(seed, index);
  const cycles = 2 + Math.floor(next(1) * 4);
  const phase = next(2) * Math.PI * 2;
  const harmonics = [1, 2 + Math.floor(next(3) * 3), 5 + Math.floor(next(4) * 6)];
  const weights = [1, 0.35 + next(5) * 0.3, 0.15 + next(6) * 0.2];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const beats = 2 + Math.floor(next(7) * 2);

  const at = (x: number): number => {
    const t = x / 100;
    switch (shape) {
      case "sine":
        return Math.sin(t * Math.PI * 2 * cycles + phase);
      case "pulse": {
        const s = Math.sin(t * Math.PI * 2 * cycles + phase);
        return Math.tanh(s * 6);
      }
      case "noise":
        return harmonics.reduce((sum, harmonic, index) => sum + (weights[index] ?? 0) * Math.sin(t * Math.PI * 2 * harmonic * cycles + phase * (index + 1)), 0) / total;
      case "heartbeat":
        return beat((t * beats) % 1) * 1.1 - 0.15;
    }
  };

  const points: string[] = [];
  for (let index = 0; index <= SAMPLES * 2; index += 1) {
    const x = (index / SAMPLES) * 100;
    const y = 50 - at(x % 100) * 45 * amplitude;
    points.push(`${round(x)},${round(Math.min(99, Math.max(1, y)))}`);
  }
  return `M${points.join(" L")}`;
};

// Resting levels of a spectrum: two or three humps over a noise floor, the way an emission spectrum reads.
export const spectrumLevels = (seedKey: string, bands: number): number[] => {
  const seed = seedOf(seedKey);
  const next = (index: number) => random(seed, index);
  const humps = Array.from({ length: 2 + Math.floor(next(0) * 2) }, (_, index) => ({
    centre: next(index * 3 + 1),
    width: 0.04 + next(index * 3 + 2) * 0.12,
    height: 0.45 + next(index * 3 + 3) * 0.5,
  }));
  return Array.from({ length: bands }, (_, band) => {
    const x = (band + 0.5) / bands;
    const floor = 0.08 + next(100 + band) * 0.14;
    const peak = humps.reduce((sum, hump) => sum + hump.height * Math.exp(-(((x - hump.centre) / hump.width) ** 2)), 0);
    return Math.min(0.97, floor + peak);
  });
};

// A point on an ellipse centred at (cx, cy), with angle 0 straight up and growing clockwise.
const onEllipse = (cx: number, cy: number, rx: number, ry: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + Math.sin(radians) * rx, y: cy - Math.cos(radians) * ry };
};

// An arc of an ellipse from one angle to another (clockwise), for shield facings.
export const ellipseArc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number): string => {
  const start = onEllipse(cx, cy, rx, ry, from);
  const end = onEllipse(cx, cy, rx, ry, to);
  const large = (to - from + 360) % 360 > 180 ? 1 : 0;
  return `M${round(start.x)} ${round(start.y)} A${rx} ${ry} 0 ${large} 1 ${round(end.x)} ${round(end.y)}`;
};

export interface Point {
  x: number;
  y: number;
}

// A course across a chart: waypoints from left to right, wandering up and down, inside the band that stays in
// view whatever the box's shape.
export const coursePoints = (seedKey: string, count: number): Point[] => {
  const seed = seedOf(seedKey);
  return Array.from({ length: count }, (_, index) => ({
    x: 12 + (76 * index) / Math.max(1, count - 1) + (index > 0 && index < count - 1 ? (random(seed, index) - 0.5) * 8 : 0),
    y: 34 + random(seed, index + 50) * 32,
  }));
};

// Where the ship is after `fraction` of the course (by length), and which way it is heading in degrees.
export const alongCourse = (points: readonly Point[], fraction: number): Point & { angle: number; leg: number } => {
  const legs = points.slice(1).map((point, index) => {
    const from = points[index] ?? point;
    return { from, to: point, length: Math.hypot(point.x - from.x, point.y - from.y) };
  });
  const total = legs.reduce((sum, leg) => sum + leg.length, 0);
  let left = clamp(fraction, 0, 1) * total;
  for (const [index, leg] of legs.entries()) {
    if (left <= leg.length || index === legs.length - 1) {
      const share = leg.length === 0 ? 0 : Math.min(1, left / leg.length);
      const angle = (Math.atan2(leg.to.y - leg.from.y, leg.to.x - leg.from.x) * 180) / Math.PI;
      return { x: leg.from.x + (leg.to.x - leg.from.x) * share, y: leg.from.y + (leg.to.y - leg.from.y) * share, angle, leg: index };
    }
    left -= leg.length;
  }
  const only = points[0] ?? { x: 50, y: 50 };
  return { ...only, angle: 0, leg: 0 };
};

// Stars scattered over a chart: position, size and whether it is one of the bright ones.
export const starField = (seedKey: string, count: number): (Point & { size: number; bright: boolean })[] => {
  const seed = seedOf(seedKey);
  return Array.from({ length: count }, (_, index) => ({
    x: random(seed, index * 3) * 100,
    y: random(seed, index * 3 + 1) * 100,
    size: 0.18 + random(seed, index * 3 + 2) ** 3 * 0.6,
    bright: random(seed, index * 3 + 2) > 0.9,
  }));
};

// Bearings read as three digits (007), marks with their sign only below the plane.
export const bearingText = (bearing: number): string => String(Math.round(((bearing % 360) + 360) % 360)).padStart(3, "0");

export const markText = (mark: number): string => String(Math.round(mark));

// Shield and weapon readiness by level.
export const levelTone = (level: number, warningBelow: number, dangerBelow: number, tone: string): string =>
  level < dangerBelow ? "danger" : level < warningBelow ? "warning" : tone;

export type BankState = "armed" | "ready" | "charging" | "offline";

export const bankState = (charge: number, armed: boolean): BankState =>
  charge < 5 ? "offline" : armed ? "armed" : charge >= 99.5 ? "ready" : "charging";

export const BANK_STATE_TEXT: Record<BankState, string> = {
  armed: "ARMED",
  ready: "READY",
  charging: "CHARGING",
  offline: "OFFLINE",
};

// Each bank sits a little below the show's charge while it is charging, so they do not read in lockstep.
export const bankCharge = (charge: number, seedKey: string, index: number): number =>
  charge >= 99.5 ? 100 : clamp(charge - random(seedOf(seedKey), index) * 9);

// How far a scan that runs on its own has got: `seconds` to 100%, a short hold on the result, then again.
export const SCAN_HOLD_MS = 2500;

export const scanAt = (now: number, seconds: number, seedKey: string): number => {
  const cycle = seconds * 1000 + SCAN_HOLD_MS;
  const offset = random(seedOf(seedKey), 0) * cycle;
  const elapsed = (now + offset) % cycle;
  return Math.min(100, (elapsed / (seconds * 1000)) * 100);
};
