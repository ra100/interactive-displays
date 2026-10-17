import { describe, expect, it } from "vitest";
import { catalog, widgets } from "../catalog/index.ts";
import { lintScreen } from "../lint/lintScreen.ts";
import { applyOps } from "../ops/applyOps.ts";
import type { Op } from "../ops/ops.ts";
import { ARCHETYPE_IDS } from "../schema/archetypes.ts";
import { ContentPackSchema } from "../schema/content.ts";
import type { Screen } from "../schema/screen.ts";
import { SignalDefSchema } from "../schema/signal.ts";
import type { Node } from "../schema/node.ts";
import { findNode, walkNodes } from "../tree/tree.ts";
import { validateScreen } from "../validate/validateScreen.ts";
import { type GenerateOptions, generateScreen, generateSuite, generateVariants, regenerateOps, rerollable, rerollOps } from "./generate.ts";

const pack = ContentPackSchema.parse({
  id: "test",
  name: "Test pack",
  vocab: {
    codeFormats: ["##-####", "@@-###"],
    statuses: ["NOMINAL", "STANDBY"],
    alertStatuses: ["CRITICAL"],
    phrases: ["{system} {word} aligned", "Recalibrating {word}"],
    words: ["plasma", "subspace", "tachyon"],
    logColumns: ["CODE", "VALUE", "STATUS"],
  },
  blocks: [
    {
      id: "gauge-panel",
      label: "Gauge panel",
      fits: ["main"],
      size: "large",
      needs: { metrics: 2 },
      tags: ["output"],
      layout: {
        part: "stack",
        direction: "column",
        children: [{ part: "heading" }, { part: "metric", show: ["gauge"], weight: 3 }, { part: "metrics", show: ["readout"], max: 2, direction: "row" }],
      },
    },
    {
      id: "controls",
      label: "Controls",
      fits: ["main", "aside"],
      size: "medium",
      needs: { actions: 1 },
      tags: ["controls"],
      layout: { part: "stack", direction: "column", children: [{ part: "heading" }, { part: "actions", max: 3 }] },
    },
    {
      id: "trend",
      label: "Trend",
      fits: ["main", "aside"],
      size: "small",
      needs: { metrics: 1 },
      tags: ["trend"],
      layout: { part: "stack", direction: "column", children: [{ part: "metric", show: ["sparkline"] }, { part: "notes" }] },
    },
    {
      id: "busy",
      label: "Busy",
      fits: ["main", "aside"],
      size: "small",
      layout: {
        part: "stack",
        direction: "row",
        children: [{ part: "ambient", show: ["data-cascade", "status-matrix", "bar-graph"] }, { part: "lights", max: 3 }, { part: "log", rows: 3 }, { part: "clock" }],
      },
    },
  ],
  recipes: [
    {
      id: "engineering",
      label: "Engineering",
      code: "ENG",
      archetypes: { sidebar: 2, dashboard: 1, "header-main": 1 },
      titles: ["MAIN ENGINEERING"],
      nav: ["WARP", "IMPULSE", "EPS", "SIF", "DAMAGE", "STATUS", "LOGS"],
      status: ["ALL SYSTEMS NOMINAL"],
      systems: [
        {
          id: "warp",
          label: "Warp core",
          short: "WARP",
          metrics: [
            { id: "output", label: "OUTPUT", unit: "%", range: [60, 80], alertRange: [85, 100] },
            { id: "matter", label: "MATTER FLOW", range: [1, 2], motion: "wave" },
            { id: "temp", label: "TEMPERATURE", unit: "K", range: [300, 400] },
          ],
          actions: [{ label: "EJECT CORE", danger: true, actions: [{ do: "setState", state: "red-alert" }] }, { label: "PURGE" }],
          notes: ["Containment field stable"],
        },
        {
          id: "impulse",
          label: "Impulse engines",
          short: "IMPULSE",
          metrics: [{ id: "thrust", label: "THRUST", range: [10, 40] }],
          actions: [{ label: "FULL STOP", actions: [{ do: "setSignal", signal: "speed", value: 0 }] }],
        },
        {
          id: "eps",
          label: "EPS grid",
          metrics: [
            { id: "load", label: "LOAD", unit: "%", range: [30, 50] },
            { id: "flow", label: "FLOW", range: [5, 9] },
          ],
        },
      ],
      alert: { emphasise: ["output"], status: ["CORE BREACH IMMINENT"] },
    },
  ],
});

const apply = (screen: Screen, ops: readonly Op[], respectLocks = false) => applyOps(screen, ops, { catalog, respectLocks });

const recipe = pack.recipes[0];
if (!recipe) throw new Error("fixture");

const show = {
  states: [
    { id: "normal", effect: "none" as const },
    { id: "yellow-alert", effect: "warning" as const },
    { id: "red-alert", effect: "alert" as const },
  ],
  signals: [SignalDefSchema.parse({ id: "speed", label: "Speed", scope: "shared", source: { kind: "manual" } })],
  screens: ["bridge"],
};

const base: GenerateOptions = {
  pack,
  recipe,
  theme: { archetypes: ARCHETYPE_IDS, tones: { nav: ["primary", "secondary"], panels: ["primary", "info", "accent"] } },
  show,
  seed: 42,
  id: "eng",
};

const nodes = (root: Node): Node[] => {
  const all: Node[] = [];
  walkNodes(root, (node) => all.push(node));
  return all;
};

const kinds = (root: Node) => nodes(root).flatMap((node) => (node.type === "widget" ? [node.kind] : []));

describe("generateScreen", () => {
  it("makes a valid, lint-clean screen that remembers how it was made", () => {
    const screen = generateScreen(base);
    expect(validateScreen(screen, catalog).ok).toBe(true);
    expect(lintScreen(screen).filter((issue) => issue.level !== "info")).toEqual([]);
    expect(screen.generator).toEqual({ recipe: "test/engineering", seed: 42, density: "normal" });
    expect(screen.section).toBe("engineering");
  });

  it("gives the same screen for the same seed and another for another seed", () => {
    expect(generateScreen(base)).toEqual(generateScreen(base));
    const others = [1, 2, 3, 4, 5].map((seed) => JSON.stringify(generateScreen({ ...base, seed }).root));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it("makes more panels and buttons on a denser screen", () => {
    const count = (density: "sparse" | "dense") =>
      nodes(generateScreen({ ...base, archetype: "sidebar", density }).root).filter((node) => node.type === "widget" && node.kind === "button").length;
    expect(count("dense")).toBeGreaterThan(count("sparse"));
  });

  it("only uses the layouts the theme draws", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const screen = generateScreen({ ...base, seed, theme: { ...base.theme, archetypes: ["dashboard"] } });
      expect(screen.root.type === "container" && screen.root.layout.kind === "frame" && screen.root.layout.archetype).toBe("dashboard");
    }
  });

  it("makes readings swing and the banner show in an alert", () => {
    const screen = generateScreen({ ...base, archetype: "header-main" });
    const banner = nodes(screen.root).find((node) => node.type === "widget" && node.kind === "alert-banner");
    expect(banner?.hidden).toBe(true);
    expect(banner?.when?.map((entry) => entry.state)).toEqual(["yellow-alert", "red-alert"]);
    const swinging = nodes(screen.root).filter(
      (node) => node.type === "widget" && Object.values(node.bind ?? {}).some((binding) => "ambient" in binding && binding.byState?.["red-alert"]),
    );
    expect(swinging.length).toBeGreaterThan(0);
  });

  it("leaves out actions the show cannot do", () => {
    const screen = generateScreen({ ...base, show: { states: [{ id: "normal", effect: "none" }] }, density: "dense" });
    for (const node of nodes(screen.root)) {
      for (const action of node.type === "widget" ? (node.actions ?? []) : []) expect(["setState", "setSignal"]).not.toContain(action.do);
    }
  });

  it("has no banner or alert ranges in a show without alerts", () => {
    const screen = generateScreen({ ...base, show: { states: [{ id: "normal", effect: "none" }] } });
    expect(kinds(screen.root)).not.toContain("alert-banner");
    expect(JSON.stringify(screen.root)).not.toContain("byState");
  });

  it("stacks panels on a portrait display", () => {
    const screen = generateScreen({ ...base, profile: { aspect: "9:16", fit: "fluid", rearrange: true }, archetype: "header-main", density: "sparse" });
    const grid = nodes(screen.root).find((node) => node.type === "container" && node.layout.kind === "grid");
    expect(grid?.type === "container" && grid.layout.kind === "grid" && grid.layout.columns).toEqual(["1fr"]);
  });
});

describe("generateVariants", () => {
  it("gives distinct takes on different layouts", () => {
    const variants = generateVariants(base);
    expect(variants).toHaveLength(3);
    const layouts = variants.map((screen) => (screen.root.type === "container" && screen.root.layout.kind === "frame" ? screen.root.layout.archetype : ""));
    expect(new Set(layouts).size).toBe(3);
    expect(variants.map((screen) => screen.generator?.seed)).toEqual([42, 43, 44]);
  });
});

describe("layouts on a portrait display", () => {
  it("leads with the stacked layout most of the time", () => {
    const firsts = Array.from({ length: 20 }, (_, seed) => generateVariants({ ...base, seed, profile: { aspect: "9:16", fit: "fluid", rearrange: true } })[0]);
    const stacked = firsts.filter((screen) => screen?.root.type === "container" && screen.root.layout.kind === "frame" && screen.root.layout.archetype === "header-main");
    expect(stacked.length).toBeGreaterThanOrEqual(12);
  });
});

describe("generateSuite", () => {
  it("makes an overview and a screen per system, linked by nav buttons", () => {
    const suite = generateSuite({ ...base, takenIds: new Set(["eng-warp"]) });
    expect(suite.map((screen) => screen.id)).toEqual(["eng", "eng-warp-2", "eng-impulse", "eng-eps"]);
    const ids = new Set(suite.map((screen) => screen.id));
    for (const screen of suite) {
      expect(validateScreen(screen, catalog).ok).toBe(true);
      expect(screen.generator?.suite).toBe("eng");
      const targets = nodes(screen.root).flatMap((node) =>
        node.type === "widget" ? (node.actions ?? []).flatMap((action) => (action.do === "navigate" ? [action.screen] : [])) : [],
      );
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) expect(ids.has(target) || target === "bridge").toBe(true);
    }
    expect(suite[1]?.generator?.system).toBe("warp");
    const layouts = suite.map((screen) => (screen.root.type === "container" && screen.root.layout.kind === "frame" ? screen.root.layout.archetype : ""));
    expect(new Set(layouts).size).toBe(1);
    expect(layouts[0]).not.toBe("dashboard");
    expect(suite[1]?.name).toBe("Engineering: Warp core");
  });
});

describe("regenerating", () => {
  const lockFirstPanel = () => {
    const screen = generateScreen({ ...base, archetype: "sidebar" });
    const grid = nodes(screen.root).find((node) => node.type === "container" && node.layout.kind === "grid");
    const panel = grid?.type === "container" ? grid.children[0]?.node : undefined;
    if (!panel) throw new Error("no panel");
    const locked = apply(screen, [{ op: "set", id: panel.id, locked: true }]);
    if (!locked.ok) throw new Error(JSON.stringify(locked.issues));
    return { screen: locked.screen, panel: { ...panel, locked: true } };
  };

  it("keeps locked parts unchanged and changes the rest", () => {
    const { screen, panel } = lockFirstPanel();
    const ops = regenerateOps(screen, { ...base, seed: 7 });
    const result = apply(screen, ops, true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(findNode(result.screen.root, panel.id)?.node).toEqual(panel);
    expect(result.screen.generator?.seed).toBe(7);
    expect(JSON.stringify(result.screen.root)).not.toEqual(JSON.stringify(screen.root));
    const undone = apply(result.screen, result.inverse);
    expect(undone.ok && undone.screen.root).toEqual(screen.root);
  });

  it("fills placeholders with a panel about what they ask for", () => {
    const screen = generateScreen({ ...base, archetype: "sidebar" });
    const grid = nodes(screen.root).find((node) => node.type === "container" && node.layout.kind === "grid");
    if (grid?.type !== "container") throw new Error("no grid");
    const withPlaceholder = apply(screen, [
      { op: "insert", parent: grid.id, child: { node: { id: "hole", type: "widget", kind: "placeholder", props: { intent: "Impulse thrust controls" } } } },
    ]);
    if (!withPlaceholder.ok) throw new Error(JSON.stringify(withPlaceholder.issues));
    const result = apply(withPlaceholder.screen, regenerateOps(withPlaceholder.screen, { ...base, seed: 9 }), true);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(kinds(result.screen.root)).not.toContain("placeholder");
    expect(JSON.stringify(result.screen.root)).toContain("Impulse engines");
  });

  it("leaves a locked screen alone", () => {
    const screen = generateScreen(base);
    const locked = { ...screen, root: { ...screen.root, locked: true } };
    expect(generateScreen({ ...base, from: locked, seed: 3 })).toBe(locked);
  });
});

describe("rerolling a panel", () => {
  it("replaces one panel in place and keeps its id", () => {
    const screen = generateScreen({ ...base, archetype: "sidebar" });
    const grid = nodes(screen.root).find((node) => node.type === "container" && node.layout.kind === "grid");
    const panel = grid?.type === "container" ? grid.children[1]?.node : undefined;
    if (!panel || grid?.type !== "container") throw new Error("no panel");
    expect(rerollable(screen, panel.id)).toBe(true);
    expect(rerollable(screen, grid.id)).toBe(false);
    const changed = [1, 2, 3, 4, 5].some((seed) => {
      const ops = rerollOps(screen, panel.id, { ...base, seed });
      const result = apply(screen, ops, true);
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      expect(findNode(result.screen.root, panel.id)).toBeDefined();
      expect(validateScreen(result.screen, catalog).ok).toBe(true);
      return JSON.stringify(findNode(result.screen.root, panel.id)?.node) !== JSON.stringify(panel);
    });
    expect(changed).toBe(true);
  });
});

describe("instruments and panels", () => {
  const tacticalPack = ContentPackSchema.parse({
    ...pack,
    id: "tac",
    blocks: [
      {
        id: "instrument-panel",
        label: "Instrument panel",
        fits: ["main", "aside"],
        size: "large",
        needs: { instruments: 1 },
        layout: { part: "panel", children: [{ part: "heading" }, { part: "instrument", weight: 3 }, { part: "metrics", show: ["readout"], max: 1 }] },
      },
      {
        id: "pair",
        label: "Pair",
        fits: ["main"],
        size: "large",
        needs: { instruments: 2 },
        layout: { part: "panel", shape: "sweep-right", children: [{ part: "heading" }, { part: "stack", direction: "row", children: [{ part: "instrument" }, { part: "instrument" }] }] },
      },
    ],
    recipes: [
      {
        id: "tactical",
        label: "Tactical",
        code: "TAC",
        archetypes: { dashboard: 1 },
        titles: ["TACTICAL"],
        nav: ["SHIELDS", "PHASERS", "TARGETING"],
        status: ["WEAPONS ON STANDBY"],
        systems: [
          {
            id: "shields",
            label: "Shields",
            metrics: [{ id: "strength", label: "STRENGTH", unit: "%", range: [95, 100], alertRange: [20, 60] }],
            instruments: ["shield-status", "ship-schematic"],
          },
          {
            id: "weapons",
            label: "Phasers",
            metrics: [{ id: "charge", label: "CHARGE", unit: "%", range: [80, 100] }],
            instruments: ["weapons", "target-lock"],
          },
          {
            id: "helm",
            label: "Helm",
            metrics: [{ id: "warp", label: "WARP", range: [5, 7] }],
            instruments: ["speed-ladder", "heading", "star-chart", "reactor"],
          },
        ],
      },
    ],
  });
  const tactical = tacticalPack.recipes[0];
  if (!tactical) throw new Error("fixture");
  const screens = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => generateScreen({ ...base, pack: tacticalPack, recipe: tactical, seed, density: "dense", archetype: "dashboard" }));
  const all = screens.flatMap((screen) => nodes(screen.root));
  const widget = (kind: string) => all.find((node) => node.type === "widget" && node.kind === kind);

  it("stays valid and lint-clean", () => {
    for (const screen of screens) {
      expect(validateScreen(screen, catalog).ok).toBe(true);
      expect(lintScreen(screen).filter((issue) => issue.level !== "info")).toEqual([]);
    }
  });

  it("builds the systems' instruments with live values that run to their alert range", () => {
    const shields = widget("shield-status");
    expect(shields?.type === "widget" && Object.keys(shields.bind ?? {})).toEqual(["forward", "aft", "port", "starboard"]);
    expect(JSON.stringify(shields?.type === "widget" ? shields.bind : {})).toContain('"red-alert":{"min":20,"max":60');
    const ladder = widget("speed-ladder");
    expect(ladder?.type === "widget" && ladder.props["label"]).toBe("WARP");
  });

  it("arms the weapons and locks the target in an alert", () => {
    const weapons = widget("weapons");
    expect(weapons?.when?.find((entry) => entry.state === "red-alert")?.props).toEqual({ armed: true });
    const lock = widget("target-lock");
    expect(lock?.when?.find((entry) => entry.state === "red-alert")?.props).toMatchObject({ locked: true });
  });

  it("draws the ship for tactical: shields live, weapons armed in an alert, damage control when damaged", () => {
    const damagedShow = { ...show, states: [...show.states, { id: "hull-breach", effect: "damaged" as const }] };
    const ships = [1, 2, 3, 4, 5, 6, 7, 8]
      .map((seed) => generateScreen({ ...base, show: damagedShow, pack: tacticalPack, recipe: tactical, seed, density: "dense", archetype: "dashboard" }))
      .flatMap((screen) => nodes(screen.root))
      .filter((node) => node.type === "widget" && node.kind === "ship-schematic");
    expect(ships.length).toBeGreaterThan(0);
    for (const ship of ships) {
      if (ship.type !== "widget") continue;
      expect(ship.props).toMatchObject({ mode: "tactical", label: "Shields" });
      expect(["top", "turn"]).toContain(ship.props["view"]);
      expect(Object.keys(ship.bind ?? {})).toEqual(["shields"]);
      expect(ship.when?.find((entry) => entry.state === "red-alert")?.props).toEqual({ armed: true });
      const breach = ship.when?.find((entry) => entry.state === "hull-breach")?.props;
      expect(breach).toMatchObject({ mode: "damage", damaged: expect.any(Array) });
      expect(widgets["ship-schematic"].props.safeParse({ ...ship.props, ...breach }).success).toBe(true);
    }
  });

  it("puts each block in a panel frame with its heading in the title slot", () => {
    const panels = all.filter((node) => node.type === "container" && node.layout.kind === "frame" && node.layout.archetype === "panel");
    expect(panels.length).toBeGreaterThan(0);
    for (const panel of panels) {
      if (panel.type !== "container") continue;
      expect(panel.children.map((child) => child.slot)).toEqual(["title", "main"]);
      expect(panel.children[0]?.node.type === "widget" && panel.children[0].node.kind).toBe("title");
    }
    expect(panels.some((panel) => panel.type === "container" && panel.layout.kind === "frame" && panel.layout.variant === "sweep-right")).toBe(true);
  });
});
