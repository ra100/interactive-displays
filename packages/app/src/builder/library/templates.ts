import { ARCHETYPES, type ChildEntryInput, type Profile, type Screen, ScreenSchema } from "@interactive-displays/core";

// Starting points for a new screen. Each one is a valid, lint-clean screen with placeholder content the crew
// replaces; the frame ones use the archetypes every theme draws.
export const TEMPLATE_IDS = ["sidebar", "header-main", "dashboard", "split", "console", "stack", "canvas"] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATES: Record<TemplateId, { label: string; description: string }> = {
  sidebar: { label: ARCHETYPES.sidebar.label, description: ARCHETYPES.sidebar.description },
  "header-main": { label: ARCHETYPES["header-main"].label, description: ARCHETYPES["header-main"].description },
  dashboard: { label: ARCHETYPES.dashboard.label, description: ARCHETYPES.dashboard.description },
  split: { label: ARCHETYPES.split.label, description: ARCHETYPES.split.description },
  console: { label: ARCHETYPES.console.label, description: ARCHETYPES.console.description },
  stack: { label: "Blank column", description: "A title over one column, to fill with anything." },
  canvas: { label: "Free canvas", description: "Place everything by hand, for art and schematics." },
};

export interface NewScreen {
  template: TemplateId;
  id: string;
  name: string;
  section?: string | undefined;
  aspect: Profile["aspect"];
}

const widget = (id: string, kind: string, props: Record<string, unknown>) => ({ id, type: "widget" as const, kind, props });

const buttons = (slot: "nav" | "toolbar", labels: string[]): ChildEntryInput[] =>
  labels.map((label) => ({ slot, node: widget(`${slot}-${label.toLowerCase()}`, "button", { label }) }));

const placeholder = (id: string, text: string) => widget(id, "text", { text });

const frame = (archetype: keyof typeof ARCHETYPES, title: string): ChildEntryInput[] => {
  const head: ChildEntryInput = { slot: "title", node: widget("title", "title", { text: title }) };
  const status: ChildEntryInput = { slot: "status", node: placeholder("status", "STATUS NOMINAL") };
  const main: ChildEntryInput = { slot: "main", node: placeholder("main-text", "Main content goes here.") };
  const aside: ChildEntryInput = { slot: "aside", node: placeholder("aside-text", "Secondary readouts.") };
  switch (archetype) {
    case "sidebar":
      return [head, ...buttons("nav", ["SYSTEMS", "DIAGNOSTICS", "LOGS"]), main, status];
    case "header-main":
      return [head, ...buttons("toolbar", ["SCAN", "ANALYSE", "REPORT"]), main, status];
    case "dashboard":
      return [head, main, aside, status];
    case "split":
      return [head, aside, ...buttons("nav", ["SYSTEMS", "DIAGNOSTICS", "LOGS"]), main, status];
    case "console":
      return [head, ...buttons("nav", ["SYSTEMS", "DIAGNOSTICS", "LOGS"]), ...buttons("toolbar", ["SCAN", "ANALYSE", "REPORT"]), main, aside, status];
    case "panel":
      return [head, main];
  }
};

export const buildScreen = ({ template, id, name, section, aspect }: NewScreen): Screen => {
  const title = name.toUpperCase().slice(0, 80);
  const root = (() => {
    switch (template) {
      case "stack":
        return {
          id: "root",
          type: "container" as const,
          layout: { kind: "stack" as const, direction: "column" as const },
          children: [
            { node: widget("title", "title", { text: title }) },
            { weight: 4, node: placeholder("main-text", "Main content goes here.") },
          ],
        };
      case "canvas":
        return {
          id: "root",
          type: "container" as const,
          layout: { kind: "canvas" as const },
          children: [{ rect: { x: 0.05, y: 0.05, w: 0.6, h: 0.15 }, node: widget("title", "title", { text: title }) }],
        };
      default:
        return {
          id: "root",
          type: "container" as const,
          layout: { kind: "frame" as const, archetype: template },
          children: frame(template, title),
        };
    }
  })();

  return ScreenSchema.parse({
    schemaVersion: 2,
    id,
    name,
    ...(section ? { section } : {}),
    profile: { aspect, fit: "fluid" },
    revision: 0,
    root,
  });
};
