// Screen skeletons with named slots. Every theme draws its own chrome for an archetype but keeps the
// slot names, which is what lets a screen move between themes and lets the generator fill it.
export const SLOTS = ["title", "nav", "toolbar", "main", "aside", "status"] as const;

export type SlotName = (typeof SLOTS)[number];

// The direction a slot lays out several children in.
export const SLOT_DIRECTION: Record<SlotName, "row" | "column"> = {
  title: "row",
  nav: "column",
  toolbar: "row",
  main: "column",
  aside: "column",
  status: "row",
};

export const ARCHETYPES = {
  sidebar: {
    label: "Sidebar",
    description: "Navigation column on the left, content on the right.",
    slots: ["title", "nav", "main", "status"],
  },
  "header-main": {
    label: "Header and main",
    description: "Title and a row of tools across the top, one large content area.",
    slots: ["title", "toolbar", "main", "status"],
  },
  dashboard: {
    label: "Dashboard",
    description: "Large content area with a side panel for secondary readouts.",
    slots: ["title", "main", "aside", "status"],
  },
  split: {
    label: "Split frame",
    description: "A short upper panel for summaries above a large lower panel with a navigation column.",
    slots: ["title", "aside", "nav", "main", "status"],
  },
  console: {
    label: "Console",
    description: "Navigation down one side, tools across the top and a side panel around one main area.",
    slots: ["title", "nav", "toolbar", "main", "aside", "status"],
  },
} as const satisfies Record<string, { label: string; description: string; slots: readonly SlotName[] }>;

export type ArchetypeId = keyof typeof ARCHETYPES;

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export const isArchetype = (id: string): id is ArchetypeId => Object.hasOwn(ARCHETYPES, id);

export const archetypeSlots = (id: string): readonly SlotName[] => (isArchetype(id) ? ARCHETYPES[id].slots : []);
