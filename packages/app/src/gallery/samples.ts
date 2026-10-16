import {
  ARCHETYPES,
  type ArchetypeId,
  type ChildEntryInput,
  type NodeInput,
  type Screen,
  ScreenSchema,
  type SlotName,
  type WidgetKind,
  widgets,
} from "@interactive-displays/core";
import type { AnyDecorDefinition } from "@interactive-displays/core";

// Sample screens for the gallery, built from the catalog so a new widget, archetype or decor shows up
// without touching this file.

const screen = (id: string, root: NodeInput): Screen =>
  ScreenSchema.parse({ schemaVersion: 2, id, name: id, root });

const column = (id: string, children: ChildEntryInput[]): NodeInput => ({
  id,
  type: "container",
  layout: { kind: "stack", direction: "column", gap: "medium" },
  children,
});

const row = (id: string, children: ChildEntryInput[]): NodeInput => ({
  id,
  type: "container",
  layout: { kind: "stack", direction: "row", gap: "medium" },
  children,
});

const button = (id: string, label: string, tone: string): ChildEntryInput => ({
  node: { id, type: "widget", kind: "button", props: { label, tone } },
});

const text = (id: string, value: string, extra: Record<string, unknown> = {}): ChildEntryInput => ({
  node: { id, type: "widget", kind: "text", props: { text: value, ...extra } },
});

const SLOT_SAMPLES: Record<SlotName, (archetype: string) => ChildEntryInput[]> = {
  title: (archetype) => [
    { node: { id: "title", type: "widget", kind: "title", props: { text: archetype, code: "01-1701" } } },
  ],
  nav: () => [
    button("nav-1", "Helm", "primary"),
    button("nav-2", "Tactical", "danger"),
    button("nav-3", "Science", "info"),
    button("nav-4", "Comms", "accent"),
  ],
  toolbar: () => [
    button("tool-1", "Scan", "primary"),
    button("tool-2", "Analyse", "secondary"),
    button("tool-3", "Record", "accent"),
  ],
  main: () => [
    {
      node: column("main", [
        { weight: 1, node: { id: "main-title", type: "widget", kind: "title", props: { text: "Sensors", tone: "info" } } },
        { weight: 2, ...text("main-text", "Long range sensors report no contacts within two light years.") },
        { weight: 1, node: row("main-row", [button("main-1", "Sweep", "info"), button("main-2", "Lock", "warning")]) },
      ]),
    },
  ],
  aside: () => [
    {
      node: column("aside", [
        text("aside-1", "Forward 100%", { size: "small", tone: "success" }),
        text("aside-2", "Aft 98%", { size: "small", tone: "success" }),
        text("aside-3", "Port 87%", { size: "small", tone: "warning" }),
      ]),
    },
  ],
  status: () => [text("status", "All systems nominal", { size: "small" })],
};

export const frameSample = (archetype: ArchetypeId): Screen =>
  screen(`frame-${archetype}`, {
    id: "root",
    type: "container",
    layout: { kind: "frame", archetype },
    children: ARCHETYPES[archetype].slots.flatMap((slot) =>
      SLOT_SAMPLES[slot](ARCHETYPES[archetype].label).map((child) => ({ ...child, slot })),
    ),
  });

export const widgetSample = (kind: WidgetKind): Screen =>
  screen(`widget-${kind}`, column("root", [{ node: { id: kind, type: "widget", kind, props: widgets[kind].example } }]));

export const decorSample = (definition: AnyDecorDefinition): Screen =>
  screen(
    `decor-${definition.kind.replace(".", "-")}`,
    column("root", [{ node: { id: "decor", type: "decor", kind: definition.kind, props: definition.example } }]),
  );
