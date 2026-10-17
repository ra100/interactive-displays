import type { ShipSystem, WidgetPropsOf } from "@interactive-displays/core";
import type { FlatView, Ship } from "./model.ts";

// Where everything goes in a ship schematic: which systems a mode draws and names, the page box of a flat
// view with room for the shield and the labels, labels spread along the bands above and below the ship, and
// the turning view's projection.

type ShipProps = WidgetPropsOf<"ship-schematic">;
export type ShipMode = ShipProps["mode"];

export type Point = readonly [number, number];

const n = (value: number): string => value.toFixed(1);

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SYSTEM_NAMES: Record<ShipSystem, string> = {
  bridge: "BRIDGE",
  deflector: "DEFLECTOR",
  "warp-core": "WARP CORE",
  nacelles: "NACELLES",
  impulse: "IMPULSE",
  phasers: "PHASERS",
  torpedoes: "TORPEDOES",
  shuttlebay: "SHUTTLEBAY",
};

// What each mode is about, in the order it names them.
export const MODE_SYSTEMS: Record<ShipMode, readonly ShipSystem[]> = {
  schematic: ["bridge", "deflector", "nacelles", "shuttlebay"],
  tactical: ["phasers", "torpedoes"],
  engineering: ["warp-core", "nacelles", "impulse", "deflector"],
  damage: [],
};

export type PartState = "damaged" | "offline" | "marked" | "active" | "quiet";

type Marks = Pick<ShipProps, "mode" | "highlight" | "damaged" | "offline">;

// How a system is drawn; undefined leaves it to the line art.
export const systemState = (system: ShipSystem, marks: Marks): PartState | undefined => {
  if (marks.damaged.includes(system)) return "damaged";
  if (marks.offline.includes(system)) return "offline";
  if (marks.highlight.includes(system)) return "marked";
  if (marks.mode !== "schematic" && MODE_SYSTEMS[marks.mode].includes(system)) return "active";
  return marks.mode === "damage" ? "quiet" : undefined;
};

const ACTIVE_TONES: Partial<Record<ShipSystem, string>> = {
  phasers: "danger",
  torpedoes: "danger",
  "warp-core": "accent",
  nacelles: "accent",
  impulse: "secondary",
  deflector: "secondary",
};

export const stateTone = (system: ShipSystem, state: PartState): string => {
  switch (state) {
    case "damaged":
      return "danger";
    case "offline":
    case "quiet":
      return "neutral";
    case "marked":
      return "accent";
    case "active":
      return ACTIVE_TONES[system] ?? "accent";
  }
};

// The systems to name, most important first: trouble, then what the screen marks, then what the mode is about.
export const taggedSystems = (props: Marks & Pick<ShipProps, "labels">): ShipSystem[] =>
  props.labels ? [...new Set([...props.damaged, ...props.offline, ...props.highlight, ...MODE_SYSTEMS[props.mode]])] : [];

// Points of path data written as tools/ships writes it: an absolute move, then relative steps.
export const parsePath = (data: string): Point[][] => {
  const loops: Point[][] = [];
  for (const piece of data.split("M").slice(1)) {
    const [head = "", tail = ""] = piece.replace(/z$/i, "").split("l");
    const start = (head.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    const steps = (tail.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    let x = start[0] ?? 0;
    let y = start[1] ?? 0;
    const points: Point[] = [[x, y]];
    for (let index = 0; index + 1 < steps.length; index += 2) {
      x += steps[index] ?? 0;
      y += steps[index + 1] ?? 0;
      points.push([x, y]);
    }
    loops.push(points);
  }
  return loops;
};

// The top view turned a quarter clockwise, bow up, for boxes taller than wide.
export const turnPoint = (rotated: boolean, [x, y]: Point): Point => (rotated ? [-y, x] : [x, y]);

const turnFrame = (rotated: boolean, frame: Frame): Frame =>
  rotated ? { x: -(frame.y + frame.height), y: frame.x, width: frame.height, height: frame.width } : frame;

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const shields = new Map<string, Ellipse>();

// The shield bubble of a flat view: an ellipse a little wider than the hull that holds all of its outline.
const shieldOf = (ship: Ship, view: FlatView): Ellipse => {
  const key = `${ship.id}:${view}`;
  const known = shields.get(key);
  if (known) return known;
  const [x, y, width, height] = ship.views[view].box;
  const margin = Math.max(width, height) * 0.05;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2 + margin;
  const ry = height / 2 + margin;
  let reach = 1;
  for (const loop of parsePath(ship.views[view].outline)) {
    for (const [px, py] of loop) reach = Math.max(reach, Math.hypot((px - cx) / rx, (py - cy) / ry));
  }
  const ellipse = { cx, cy, rx: rx * reach * 1.03, ry: ry * reach * 1.03 };
  shields.set(key, ellipse);
  return ellipse;
};

export interface Tag {
  system: ShipSystem;
  text: string;
  anchor: Point;
  x: number;
  y: number;
  band: "above" | "below";
  leader: string;
}

// The drawing area and the size labels should be on screen, in pixels, when the renderer could measure them.
export interface Fit {
  width: number;
  height: number;
  text: number;
}

// Label size in page metres, so labels come out `fit.text` pixels tall once the stage is scaled into the area.
// `bands` is how many font sizes the label bands add to the stage's height.
export const fitFont = (frame: Frame, bands: number, fit: Fit | undefined): number => {
  if (!fit || fit.width <= 0 || fit.height <= 0 || fit.text <= 0) return Math.max(frame.width, frame.height) * 0.032;
  const across = fit.width / frame.width;
  const font = fit.text / across;
  if ((frame.height + bands * font) * across <= fit.height) return font;
  return (fit.text * frame.height) / Math.max(fit.height - bands * fit.text, fit.height * 0.2);
};

export interface FlatLayout {
  stage: Frame;
  box: Frame;
  shield: Ellipse | undefined;
  font: number;
  tags: Tag[];
}

// Text is about this many font sizes wide per character, in the condensed capitals themes use.
const CHARACTER = 0.62;

const tagWidth = (text: string, font: number): number => (text.length * CHARACTER + 1.2) * font;

// Spreads tags along a band so none overlap, keeping each as close to its anchor as it can. Returns undefined
// when they cannot all fit.
const spread = (tags: Tag[], font: number, from: number, to: number): Tag[] | undefined => {
  const sorted = [...tags].sort((a, b) => a.anchor[0] - b.anchor[0]);
  const widths = sorted.map((tag) => tagWidth(tag.text, font));
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total > to - from) return undefined;
  const xs = sorted.map((tag, index) => Math.min(Math.max(tag.anchor[0], from + (widths[index] ?? 0) / 2), to - (widths[index] ?? 0) / 2));
  for (let index = 1; index < xs.length; index += 1) {
    const gap = ((widths[index - 1] ?? 0) + (widths[index] ?? 0)) / 2;
    xs[index] = Math.max(xs[index] ?? 0, (xs[index - 1] ?? 0) + gap);
  }
  for (let index = xs.length - 1; index >= 0; index -= 1) {
    const limit = index === xs.length - 1 ? to - (widths[index] ?? 0) / 2 : (xs[index + 1] ?? 0) - ((widths[index] ?? 0) + (widths[index + 1] ?? 0)) / 2;
    xs[index] = Math.min(xs[index] ?? 0, limit);
  }
  return sorted.map((tag, index) => ({ ...tag, x: xs[index] ?? tag.x }));
};

const BAND = 2.4;

export const flatLayout = (
  ship: Ship,
  view: FlatView,
  systems: readonly ShipSystem[],
  rotated: boolean,
  withShield: boolean,
  fit?: Fit,
): FlatLayout => {
  const [bx, by, bw, bh] = ship.views[view].box;
  const box = turnFrame(rotated, { x: bx, y: by, width: bw, height: bh });
  const plain = shieldOf(ship, view);
  const shield = withShield
    ? rotated
      ? { cx: -plain.cy, cy: plain.cx, rx: plain.ry, ry: plain.rx }
      : plain
    : undefined;
  const pad = Math.max(box.width, box.height) * 0.03;
  const reach = shield ? { x: shield.rx - box.width / 2, y: shield.ry - box.height / 2 } : { x: 0, y: 0 };
  const width = box.width + 2 * (pad + reach.x);
  const font = fitFont({ x: 0, y: 0, width, height: box.height + 2 * (pad + reach.y) }, systems.length > 0 ? 2 * BAND : 0, fit);
  const band = systems.length > 0 ? font * BAND : 0;
  const stage: Frame = {
    x: box.x - pad - reach.x,
    y: box.y - pad - reach.y - band,
    width,
    height: box.height + 2 * (pad + reach.y + band),
  };

  const wanted = systems.flatMap((system): Tag[] => {
    const candidates = ship.parts
      .filter((part) => part.system === system)
      .map((part) => ({ at: turnPoint(rotated, part.views[view].anchor), hidden: part.views[view].hidden === true }));
    const visible = candidates.filter((candidate) => !candidate.hidden);
    const pool = visible.length > 0 ? visible : candidates;
    const reachOf = (at: Point) => Math.min(at[1] - box.y, box.y + box.height - at[1]);
    const best = pool.reduce<(typeof pool)[number] | undefined>((chosen, candidate) => (!chosen || reachOf(candidate.at) < reachOf(chosen.at) ? candidate : chosen), undefined);
    if (!best) return [];
    const band = best.at[1] - box.y <= box.y + box.height - best.at[1] ? "above" : "below";
    return [{ system, text: SYSTEM_NAMES[system], anchor: best.at, x: best.at[0], y: 0, band, leader: "" }];
  });

  const placed: Tag[] = [];
  for (const side of ["above", "below"] as const) {
    let tags = wanted.filter((tag) => tag.band === side);
    let spaced = spread(tags, font, stage.x, stage.x + stage.width);
    // Too many to fit: the least important go first.
    while (!spaced && tags.length > 0) {
      tags = tags.slice(0, -1);
      spaced = spread(tags, font, stage.x, stage.x + stage.width);
    }
    const textY = side === "above" ? stage.y + band * 0.45 : stage.y + stage.height - band * 0.45;
    const elbow = side === "above" ? box.y - pad - reach.y * 0.5 : box.y + box.height + pad + reach.y * 0.5;
    const end = side === "above" ? stage.y + band * 0.8 : stage.y + stage.height - band * 0.8;
    for (const tag of spaced ?? []) {
      const [ax, ay] = tag.anchor;
      placed.push({ ...tag, y: textY, leader: `M${n(ax)} ${n(ay)}V${n(elbow)}H${n(tag.x)}V${n(end)}` });
    }
  }
  return { stage, box, shield, font, tags: placed };
};

// ---- The turning view: the lines plan spun about the vertical axis, seen from a little above ----

export const PITCH = (20 * Math.PI) / 180;

export interface Projected {
  x: number;
  y: number;
  // Towards the viewer; larger is nearer.
  depth: number;
}

export const projectTurn = (yaw: number, x: number, y: number, z: number): Projected => {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const across = x * sin + y * cos;
  return { x: x * cos - y * sin, y: across * Math.sin(PITCH) - z * Math.cos(PITCH), depth: across * Math.cos(PITCH) + z * Math.sin(PITCH) };
};

export interface TurnGeometry {
  stage: Frame;
  // Semi-axes of the shield ellipsoid along x, y and z.
  shield: readonly [number, number, number];
}

const turns = new Map<string, TurnGeometry>();

// A stage that holds the ship (and its shield) at every angle, so the drawing never jumps as it turns.
export const turnGeometry = (ship: Ship): TurnGeometry => {
  const known = turns.get(ship.id);
  if (known) return known;
  const margin = ship.size.length * 0.05;
  const axes = [ship.size.length / 2 + margin, ship.size.beam / 2 + margin, ship.size.height / 2 + margin] as const;
  let reach = 1;
  for (const loop of ship.loops) {
    for (let index = 0; index + 2 < loop.length; index += 3) {
      reach = Math.max(reach, Math.hypot((loop[index] ?? 0) / axes[0], (loop[index + 1] ?? 0) / axes[1], (loop[index + 2] ?? 0) / axes[2]));
    }
  }
  const shield = [axes[0] * reach * 1.02, axes[1] * reach * 1.02, axes[2] * reach * 1.02] as const;
  const radius = Math.max(shield[0], shield[1]);
  const top = radius * Math.sin(PITCH) + shield[2] * Math.cos(PITCH);
  const geometry = { stage: { x: -radius, y: -top, width: 2 * radius, height: 2 * top }, shield };
  turns.set(ship.id, geometry);
  return geometry;
};

// The lines plan at one angle, split into the loops on the far side and the near side, so the far ones can be
// drawn fainter.
export const turnHull = (ship: Ship, yaw: number): { far: string; near: string } => {
  let far = "";
  let near = "";
  for (const loop of ship.loops) {
    let path = "";
    let depth = 0;
    const count = Math.floor(loop.length / 3);
    for (let index = 0; index < count; index += 1) {
      const point = projectTurn(yaw, loop[index * 3] ?? 0, loop[index * 3 + 1] ?? 0, loop[index * 3 + 2] ?? 0);
      path += `${index === 0 ? "M" : "L"}${n(point.x)} ${n(point.y)}`;
      depth += point.depth;
    }
    if (count === 0) continue;
    if (depth / count >= 0) near += `${path}Z`;
    else far += `${path}Z`;
  }
  return { far, near };
};

export const turnPolyline = (yaw: number, points: readonly (readonly [number, number, number])[]): string =>
  points
    .map(([x, y, z], index) => {
      const point = projectTurn(yaw, x, y, z);
      return `${index === 0 ? "M" : "L"}${n(point.x)} ${n(point.y)}`;
    })
    .join("");

// Three rings of the shield ellipsoid: around the waist and over the top both ways.
export const turnShield = (axes: readonly [number, number, number], yaw: number): string => {
  const [a, b, c] = axes;
  const ring = (at: (angle: number) => readonly [number, number, number]) =>
    `${turnPolyline(
      yaw,
      Array.from({ length: 64 }, (_, index) => at((index / 64) * Math.PI * 2)),
    )}Z`;
  return (
    ring((angle) => [a * Math.cos(angle), b * Math.sin(angle), 0]) +
    ring((angle) => [a * Math.cos(angle), 0, c * Math.sin(angle)]) +
    ring((angle) => [0, b * Math.cos(angle), c * Math.sin(angle)])
  );
};

export const turnFont = (stage: Frame, fit: Fit | undefined): number =>
  fit && fit.width > 0 && fit.height > 0 && fit.text > 0
    ? fit.text / Math.min(fit.width / stage.width, fit.height / stage.height)
    : stage.width * 0.03;

export interface TurnTag {
  system: ShipSystem;
  text: string;
  side: "left" | "right";
  x: number;
  y: number;
  leader: string;
}

// Labels of the turning view stand still in two columns at the sides, each on a leader to its system's marker
// as the ship turns under them; systems alternate between the columns in the order given.
export const turnTags = (systems: readonly { system: ShipSystem; at: Point }[], stage: Frame, font: number): TurnTag[] => {
  const columns = { left: systems.filter((_, index) => index % 2 === 0), right: systems.filter((_, index) => index % 2 === 1) };
  return (["left", "right"] as const).flatMap((side) =>
    columns[side].map(({ system, at }, index, column): TurnTag => {
      const y = stage.y + font * 1.5 + ((stage.height - font * 3) * (index + 0.5)) / column.length;
      const x = side === "left" ? stage.x + font * 0.3 : stage.x + stage.width - font * 0.3;
      const end = side === "left" ? x + tagWidth(SYSTEM_NAMES[system], font) - font * 0.6 : x - tagWidth(SYSTEM_NAMES[system], font) + font * 0.6;
      const elbow = side === "left" ? end + font * 1.5 : end - font * 1.5;
      return { system, text: SYSTEM_NAMES[system], side, x, y, leader: `M${n(at[0])} ${n(at[1])}L${n(elbow)} ${n(y)}H${n(end)}` };
    }),
  );
};
