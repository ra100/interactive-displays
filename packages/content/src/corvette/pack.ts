import type { ContentPackInput } from "@interactive-displays/core";
import blocks from "../trek/blocks.json" with { type: "json" };
import cockpit from "./recipes/cockpit.json" with { type: "json" };
import damageControl from "./recipes/damage-control.json" with { type: "json" };
import drive from "./recipes/drive.json" with { type: "json" };
import ops from "./recipes/ops.json" with { type: "json" };
import sensors from "./recipes/sensors.json" with { type: "json" };
import weapons from "./recipes/weapons.json" with { type: "json" };
import vocab from "./vocab.json" with { type: "json" };

// The corvette pack: a hard science-fiction patrol ship whose displays are heads-up overlays. It shares the
// starship pack's blocks, which describe layouts, not a setting.
export const corvette: ContentPackInput = {
  id: "corvette",
  name: "Patrol corvette",
  description: "Sections of a hard science-fiction warship: cockpit, weapons, sensors, drive room, damage control and ops.",
  theme: "hud",
  vocab,
  blocks: blocks as ContentPackInput["blocks"],
  // JSON imports type ranges as number[], not pairs; ContentPackSchema checks the real shape when packs load.
  recipes: [cockpit, weapons, sensors, drive, damageControl, ops] as unknown[] as ContentPackInput["recipes"],
};
