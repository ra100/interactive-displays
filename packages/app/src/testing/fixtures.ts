import { PROTOCOL_VERSION, type Screen, ScreenSchema, type ShowOverview, ShowSchema } from "@interactive-displays/core";

export const sampleScreen = (id: string, name: string, extra: Record<string, unknown> = {}): Screen =>
  ScreenSchema.parse({
    schemaVersion: 2,
    id,
    name,
    revision: 0,
    published: 0,
    root: {
      id: "root",
      type: "container",
      layout: { kind: "stack", direction: "column" },
      children: [{ node: { id: "title", type: "widget", kind: "title", props: { text: name.toUpperCase() } } }],
    },
    ...extra,
  });

export const sampleOverview = (overrides: Partial<ShowOverview> = {}): ShowOverview => ({
  protocol: PROTOCOL_VERSION,
  show: ShowSchema.parse({
    schemaVersion: 1,
    id: "demo",
    name: "Demo Show",
    theme: { id: "base" },
    defaultScreen: "bridge",
    states: [
      { id: "normal", label: "Normal" },
      { id: "red-alert", label: "Red alert", effect: "alert", banner: "BATTLE STATIONS" },
      { id: "blackout", label: "Blackout", effect: "blackout" },
    ],
    displays: [{ id: "eng-1", name: "Engineering 1", screen: "engineering" }],
  }),
  state: "normal",
  cue: null,
  signals: {},
  screens: [
    { id: "bridge", name: "Bridge", tags: [], profile: { aspect: "16:9", fit: "fluid" }, revision: 0, published: 0 },
    { id: "engineering", name: "Engineering", tags: [], profile: { aspect: "16:9", fit: "fluid" }, revision: 2, published: 1 },
    { id: "draft", name: "Draft only", tags: [], profile: { aspect: "16:9", fit: "fluid" }, revision: 0, published: null },
  ],
  displays: [
    {
      id: "eng-1",
      name: "Engineering 1",
      assigned: "engineering",
      showing: "engineering",
      preview: null,
      navigated: null,
      videos: [],
      connected: true,
      lastSeen: "2026-10-15T10:00:00.000Z",
    },
    { id: "lobby", showing: "bridge", preview: null, navigated: null, videos: [], connected: false, lastSeen: null },
  ],
  ...overrides,
});
