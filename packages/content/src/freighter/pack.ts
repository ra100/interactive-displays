import type { ContentPackInput } from "@interactive-displays/core";
import blocks from "../trek/blocks.json" with { type: "json" };
import airlock from "./recipes/airlock.json" with { type: "json" };
import cargo from "./recipes/cargo.json" with { type: "json" };
import cryo from "./recipes/cryo.json" with { type: "json" };
import flight from "./recipes/flight.json" with { type: "json" };
import lifeSupport from "./recipes/life-support.json" with { type: "json" };
import mainframe from "./recipes/mainframe.json" with { type: "json" };
import reactor from "./recipes/reactor.json" with { type: "json" };
import vocab from "./vocab.json" with { type: "json" };

// The freighter pack: a working deep-space hauler with a terminal for a computer. It shares the starship
// pack's blocks, which describe layouts, not a setting.
export const freighter: ContentPackInput = {
  id: "freighter",
  name: "Deep-space freighter",
  description: "Sections of a commercial hauler: flight deck, reactor, cargo, life support, cryo bay, mainframe and airlock.",
  theme: "crt",
  vocab,
  blocks: blocks as ContentPackInput["blocks"],
  // JSON imports type ranges as number[], not pairs; ContentPackSchema checks the real shape when packs load.
  recipes: [flight, reactor, cargo, lifeSupport, cryo, mainframe, airlock] as unknown[] as ContentPackInput["recipes"],
};
