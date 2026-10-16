import { PANEL_SHAPES, random, seedOf } from "@interactive-displays/core";

// Which shape a panel's chrome takes: the layout's hint when it names one, otherwise a shape picked from the
// node id, so neighbouring panels differ and every display draws the same one.

export type PanelShape = "sweep" | "top" | "bottom" | "bracket" | "rails";

export interface PanelLook {
  shape: PanelShape;
  side: "left" | "right";
  // A seeded pick of 0..1, for the panel's tones and codes.
  pick: (index: number) => number;
}

// Shapes drawn when no hint is given; rails and brackets are kept for when they are asked for.
const SEEDED: readonly (typeof PANEL_SHAPES)[number][] = ["sweep", "sweep-right", "top", "bottom", "top-right", "sweep"];

const isShape = (value: string): value is (typeof PANEL_SHAPES)[number] => (PANEL_SHAPES as readonly string[]).includes(value);

export const panelLook = (variant: string | undefined, nodeId: string): PanelLook => {
  const seed = seedOf(`${nodeId}/panel`);
  const pick = (index: number) => random(seed, index);
  const named = variant && isShape(variant) ? variant : (SEEDED[Math.floor(pick(0) * SEEDED.length)] ?? "sweep");
  const right = named.endsWith("-right");
  return { shape: named.replace(/-right$/, "") as PanelShape, side: right ? "right" : "left", pick };
};
