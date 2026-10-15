import type { ContentPackInput } from "@interactive-displays/core";
import blocks from "./blocks.json" with { type: "json" };
import communications from "./recipes/communications.json" with { type: "json" };
import engineering from "./recipes/engineering.json" with { type: "json" };
import environmental from "./recipes/environmental.json" with { type: "json" };
import helm from "./recipes/helm.json" with { type: "json" };
import medical from "./recipes/medical.json" with { type: "json" };
import operations from "./recipes/operations.json" with { type: "json" };
import science from "./recipes/science.json" with { type: "json" };
import security from "./recipes/security.json" with { type: "json" };
import tactical from "./recipes/tactical.json" with { type: "json" };
import vocab from "./vocab.json" with { type: "json" };

// The starship pack: nine sections of a Star Trek style ship. Plain JSON, so a new section is a data change.
export const trek: ContentPackInput = {
  id: "trek",
  name: "Starship",
  description: "Sections of a Star Trek style starship: engineering, bridge stations, sickbay and more.",
  theme: "lcars",
  vocab,
  blocks: blocks as ContentPackInput["blocks"],
  recipes: [engineering, environmental, tactical, helm, science, medical, communications, security, operations] as ContentPackInput["recipes"],
};
