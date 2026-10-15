import { catalog } from "../catalog/index.ts";
import type { Op } from "../ops/ops.ts";
import { ARCHETYPE_IDS, type ArchetypeId, archetypeSlots, isArchetype, type SlotName } from "../schema/archetypes.ts";
import type { ContentPack, Recipe, System } from "../schema/content.ts";
import type { ChildEntry, GridArea, Node, WidgetNode } from "../schema/node.ts";
import { type Density, type GeneratorInfo, type Profile, SCREEN_SCHEMA_VERSION, type Screen } from "../schema/screen.ts";
import { collectIds, findNode, lockedParts, walkNodes } from "../tree/tree.ts";
import { validateScreen } from "../validate/validateScreen.ts";
import { blockFits, buildBlock, chooseBlock } from "./blocks.ts";
import { bannerStates, type Context, code, freshId, type ShowContext, type ToneRules, toneAt } from "./context.ts";
import { createRandom, type Random, subSeed } from "./random.ts";

export interface SuiteLink {
  // The suite's overview screen id; every screen of a suite carries it.
  suite: string;
  // The system this screen is about; absent on the overview.
  system?: string;
  // Screen ids by system id, and the overview's, for nav buttons that navigate between them.
  screens: Readonly<Record<string, string>>;
}

export interface GenerateOptions {
  pack: ContentPack;
  recipe: Recipe;
  theme: { archetypes: readonly ArchetypeId[]; tones: ToneRules };
  show: ShowContext;
  seed: number;
  id: string;
  name?: string;
  profile?: Profile;
  density?: Density;
  // Forces a layout; otherwise it comes from the recipe's weights (or the screen being regenerated).
  archetype?: ArchetypeId;
  // Regenerating: its locked parts stay in their slots and its placeholders are filled.
  from?: Screen;
  suite?: SuiteLink;
}

const COUNTS: Record<Density, { panels: number; aside: number; nav: number; toolbar: number }> = {
  sparse: { panels: 2, aside: 1, nav: 4, toolbar: 3 },
  normal: { panels: 3, aside: 1, nav: 5, toolbar: 4 },
  dense: { panels: 4, aside: 2, nav: 7, toolbar: 5 },
};

const PORTRAIT = new Set<Profile["aspect"]>(["9:16"]);

// Layouts the recipe allows and the theme draws, weighted; a portrait display leans towards stacked layouts.
export const archetypeWeights = (recipe: Recipe, theme: GenerateOptions["theme"], profile: Profile): [ArchetypeId, number][] => {
  const drawn = theme.archetypes.length > 0 ? theme.archetypes : ARCHETYPE_IDS;
  const entries = drawn
    .map((id): [ArchetypeId, number] => {
      const weight = recipe.archetypes[id] ?? 0;
      if (!PORTRAIT.has(profile.aspect)) return [id, weight];
      return [id, id === "header-main" ? weight * 3 + 1 : weight * 0.3];
    })
    .filter(([, weight]) => weight > 0);
  return entries.length > 0 ? entries : [["header-main", 1]];
};

// What a screen being regenerated keeps: per slot, its locked parts and placeholders in the order they appear.
type Kept = { kind: "locked"; node: Node } | { kind: "placeholder"; node: WidgetNode; intent: string; size: "small" | "large" };

const keptFrom = (screen: Screen | undefined): Map<SlotName, Kept[]> => {
  const kept = new Map<SlotName, Kept[]>();
  if (!screen) return kept;
  const add = (slot: SlotName, item: Kept) => kept.set(slot, [...(kept.get(slot) ?? []), item]);
  const collect = (node: Node, slot: SlotName) => {
    if (node.locked) return add(slot, { kind: "locked", node });
    if (node.type === "widget" && node.kind === "placeholder") {
      const intent = typeof node.props["intent"] === "string" ? node.props["intent"] : "";
      return add(slot, { kind: "placeholder", node, intent, size: node.props["size"] === "large" ? "large" : "small" });
    }
    if (node.type === "container") for (const child of node.children) collect(child.node, slot);
  };
  const { root } = screen;
  if (root.type === "container" && root.layout.kind === "frame") {
    for (const child of root.children) collect(child.node, child.slot ?? "main");
  } else {
    collect(root, "main");
  }
  return kept;
};

const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);

// The system a placeholder's intent is about, by the words they share; a random one when nothing matches.
const systemFor = (intent: string, systems: readonly System[], random: Random): System => {
  const wanted = new Set(words(intent));
  const scored = systems.map((system) => {
    const vocabulary = [system.label, system.short ?? "", ...system.metrics.map((metric) => metric.label), ...system.actions.map((action) => action.label)];
    const score = vocabulary.flatMap(words).filter((word) => wanted.has(word)).length;
    return [system, score] as const;
  });
  const best = Math.max(...scored.map(([, score]) => score));
  if (best > 0) return random.pick(scored.filter(([, score]) => score === best).map(([system]) => system));
  return random.pick(systems);
};

const widget = (id: string, kind: string, props: Record<string, unknown>, extra: Partial<WidgetNode> = {}): WidgetNode => ({
  id,
  type: "widget",
  kind,
  props,
  ...extra,
});

// Cells of the main grid for n panels: the first one is the largest.
const gridPlan = (count: number, portrait: boolean): { columns: string[]; rows: string[]; areas: GridArea[] } => {
  const cell = (col: number, row: number, colSpan?: number, rowSpan?: number): GridArea => ({
    col,
    row,
    ...(colSpan ? { colSpan } : {}),
    ...(rowSpan ? { rowSpan } : {}),
  });
  if (portrait) {
    if (count <= 3) return { columns: ["1fr"], rows: Array(count).fill("1fr"), areas: Array.from({ length: count }, (_, i) => cell(1, i + 1)) };
    const rows = Math.ceil((count + 1) / 2);
    const areas = [cell(1, 1, 2)];
    for (let index = 1; index < count; index += 1) areas.push(cell(((index - 1) % 2) + 1, Math.floor((index - 1) / 2) + 2));
    return { columns: ["1fr", "1fr"], rows: Array(rows).fill("1fr"), areas };
  }
  switch (count) {
    case 1:
      return { columns: ["1fr"], rows: ["1fr"], areas: [cell(1, 1)] };
    case 2:
      return { columns: ["3fr", "2fr"], rows: ["1fr"], areas: [cell(1, 1), cell(2, 1)] };
    case 3:
      return { columns: ["2fr", "1fr"], rows: ["1fr", "1fr"], areas: [cell(1, 1, undefined, 2), cell(2, 1), cell(2, 2)] };
    case 4:
      return { columns: ["1fr", "1fr"], rows: ["1fr", "1fr"], areas: [cell(1, 1), cell(2, 1), cell(1, 2), cell(2, 2)] };
    case 5:
      return {
        columns: ["2fr", "1fr", "1fr"],
        rows: ["1fr", "1fr"],
        areas: [cell(1, 1, undefined, 2), cell(2, 1), cell(3, 1), cell(2, 2), cell(3, 2)],
      };
    default: {
      const rows = Math.ceil(count / 3);
      return {
        columns: ["1fr", "1fr", "1fr"],
        rows: Array(rows).fill("1fr"),
        areas: Array.from({ length: count }, (_, i) => cell((i % 3) + 1, Math.floor(i / 3) + 1)),
      };
    }
  }
};

interface PanelPlan {
  kept?: Node;
  system?: System;
  tags?: string[];
  size?: "large";
}

// Fills a content slot (main or aside) with panels: kept parts and filled placeholders where they were,
// generated panels around them.
const panels = (
  slot: "main" | "aside",
  count: number,
  kept: readonly Kept[],
  systems: System[],
  context: Context,
  random: Random,
  used: Set<string>,
  toneOffset: number,
): Node[] => {
  const plans: PanelPlan[] = kept.map((item) =>
    item.kind === "locked"
      ? { kept: item.node }
      : {
          system: systemFor(item.intent, context.recipe.systems, random),
          tags: words(item.intent),
          ...(item.size === "large" ? { size: "large" as const } : {}),
        },
  );
  while (plans.length < count) {
    const system = systems.shift() ?? random.pick(context.recipe.systems);
    plans.push({ system });
  }
  return plans.flatMap((plan, index) => {
    if (plan.kept) return [plan.kept];
    const system = plan.system ?? random.pick(context.recipe.systems);
    const panelRandom = random.fork(`${slot}-${index}`);
    const block =
      chooseBlock(context, system, slot, panelRandom, {
        used,
        ...(plan.size ? { size: plan.size } : index === 0 && slot === "main" ? { size: "large" } : {}),
        ...(plan.tags ? { tags: plan.tags } : {}),
      }) ?? context.pack.blocks.find((each) => blockFits(each, system, slot));
    if (!block) return [];
    used.add(block.id);
    const node = buildBlock(block, system, toneAt(context.tones.panels, toneOffset + index), toneOffset + index, context, panelRandom);
    return node ? [node] : [];
  });
};

const buttons = (
  labels: readonly { label: string; screen?: string }[],
  count: number,
  kept: readonly Kept[],
  context: Context,
  random: Random,
): Node[] => {
  const keptNodes = kept.filter((item) => item.kind === "locked").map((item) => item.node);
  const keptLabels = new Set<string>();
  for (const node of keptNodes) walkNodes(node, (each) => {
    if (each.type === "widget" && typeof each.props["label"] === "string") keptLabels.add(each.props["label"].toLowerCase());
  });
  const offset = random.int(0, context.tones.nav.length - 1);
  const fresh = labels
    .filter((entry) => !keptLabels.has(entry.label.toLowerCase()))
    .slice(0, Math.max(0, count - keptNodes.length))
    .map((entry, index) =>
      widget(
        freshId(context, `nav-${entry.label}`),
        "button",
        { label: entry.label, tone: toneAt(context.tones.nav, offset + index) },
        entry.screen && (context.show.screens ?? []).includes(entry.screen) ? { actions: [{ do: "navigate", screen: entry.screen }] } : {},
      ),
    );
  return [...keptNodes, ...fresh];
};

const navLabels = (options: GenerateOptions, focus: System | undefined): { label: string; screen?: string }[] => {
  const { recipe, suite } = options;
  if (!suite) return recipe.nav.map((label) => ({ label }));
  const systemEntry = (system: System) => {
    const screen = suite.screens[system.id];
    return { label: system.short ?? system.label.slice(0, 18), ...(screen ? { screen } : {}) };
  };
  if (!focus) return recipe.systems.map(systemEntry);
  const overview = suite.screens[suite.suite] ?? suite.suite;
  return [{ label: "Overview", screen: overview }, ...recipe.systems.filter((system) => system.id !== focus.id).map(systemEntry)];
};

const buildRoot = (options: GenerateOptions, random: Random, archetype: ArchetypeId, context: Context): Node => {
  const { recipe, pack, show } = options;
  const counts = COUNTS[options.density ?? "normal"];
  const profile = options.profile ?? { aspect: "16:9", fit: "fluid" };
  const kept = keptFrom(options.from);
  const keptIn = (slot: SlotName) => kept.get(slot) ?? [];
  const focus = options.suite?.system ? recipe.systems.find((system) => system.id === options.suite?.system) : undefined;
  const children: ChildEntry[] = [];
  const slots = archetypeSlots(archetype);
  const used = new Set<string>();
  const toneOffset = random.int(0, context.tones.panels.length - 1);

  // Locked parts whose slot this layout lacks go to main, so nothing locked is ever dropped.
  for (const [slot, items] of kept) {
    if (!slots.includes(slot)) kept.set("main", [...keptIn("main"), ...items]);
  }

  const systems = focus ? [] : random.shuffle(recipe.systems);
  // A system screen fills every panel from its own system.
  const supply = (count: number) => (focus ? Array(count).fill(focus) : systems);

  for (const slot of slots) {
    switch (slot) {
      case "title": {
        const locked = keptIn("title").filter((item) => item.kind === "locked");
        if (locked.length > 0) {
          for (const item of locked) children.push({ slot, node: item.node });
          break;
        }
        const text = focus ? focus.label : random.pick(recipe.titles);
        children.push({ slot, node: widget(freshId(context, "title"), "title", { text, code: `${recipe.code} ${code(pack.vocab, random)}`, tone: "primary" }) });
        break;
      }
      case "nav":
      case "toolbar": {
        const count = slot === "nav" ? counts.nav : counts.toolbar;
        const labels = navLabels(options, focus);
        for (const node of buttons(labels, Math.min(count + (options.suite ? 2 : 0), 8), keptIn(slot), context, random.fork(slot))) {
          children.push({ slot, node });
        }
        break;
      }
      case "status": {
        const locked = keptIn("status").filter((item) => item.kind === "locked");
        if (locked.length > 0) {
          for (const item of locked) children.push({ slot, node: item.node });
          break;
        }
        const states = bannerStates(show);
        const alertText = recipe.alert.status.length > 0 ? random.pick(recipe.alert.status) : `${recipe.label.toUpperCase()} ${random.pick(pack.vocab.alertStatuses)}`;
        children.push({
          slot,
          node: widget(
            freshId(context, "status-line"),
            "text",
            { text: random.pick(recipe.status), size: "small", tone: "neutral" },
            states.length > 0 ? { when: states.map((state) => ({ state, props: { text: alertText, tone: "danger" } })) } : {},
          ),
        });
        break;
      }
      case "main": {
        const states = bannerStates(show);
        if (recipe.alert.banner && states.length > 0) {
          children.push({
            slot,
            weight: 1,
            node: widget(freshId(context, "alert-banner"), "alert-banner", { tone: "danger" }, {
              hidden: true,
              when: states.map((state) => ({ state, hidden: false })),
            }),
          });
        }
        const count = Math.max(counts.panels - (archetype === "dashboard" ? 1 : 0), keptIn("main").length);
        const made = panels("main", count, keptIn("main"), supply(count), context, random.fork("main"), used, toneOffset);
        const plan = gridPlan(made.length, PORTRAIT.has(profile.aspect));
        children.push({
          slot,
          weight: 8,
          node: {
            id: freshId(context, "main-grid"),
            type: "container",
            layout: { kind: "grid", columns: plan.columns, rows: plan.rows, gap: "medium" },
            children: made.map((node, index) => ({ node, ...(plan.areas[index] ? { area: plan.areas[index] } : {}) })),
          },
        });
        break;
      }
      case "aside": {
        const count = Math.max(counts.aside, keptIn("aside").length);
        const made = panels("aside", count, keptIn("aside"), supply(count), context, random.fork("aside"), used, toneOffset + 3);
        for (const node of made) children.push({ slot, node });
        break;
      }
    }
  }

  return { id: options.from?.root.id ?? "root", type: "container", layout: { kind: "frame", archetype }, children };
};

const pickArchetype = (options: GenerateOptions, random: Random): ArchetypeId => {
  if (options.archetype) return options.archetype;
  const root = options.from?.root;
  if (root?.type === "container" && root.layout.kind === "frame" && isArchetype(root.layout.archetype)) return root.layout.archetype;
  return random.weighted(archetypeWeights(options.recipe, options.theme, options.profile ?? { aspect: "16:9", fit: "fluid" }));
};

export const generatorInfo = (options: GenerateOptions): GeneratorInfo => ({
  recipe: `${options.pack.id}/${options.recipe.id}`,
  seed: options.seed >>> 0,
  density: options.density ?? "normal",
  ...(options.suite ? { suite: options.suite.suite } : {}),
  ...(options.suite?.system ? { system: options.suite.system } : {}),
});

const ATTEMPTS = 4;

// One screen from a recipe, the same every time for the same options. The result is schema-valid; if a
// choice would make it invalid, it tries again with a sub-seed.
export const generateScreen = (options: GenerateOptions): Screen => {
  const fromRoot = options.from?.root;
  if (fromRoot?.locked && options.from) return options.from;
  const problems: string[] = [];
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const seed = attempt === 0 ? options.seed : subSeed(options.seed, `attempt-${attempt}`);
    const random = createRandom(seed);
    const keptIds = new Set(lockedParts(fromRoot ?? { id: "root", type: "container", layout: { kind: "canvas" }, children: [] }).flatMap((node) => [...collectIds(node)]));
    const context: Context = { pack: options.pack, recipe: options.recipe, show: options.show, tones: options.theme.tones, taken: new Set([...keptIds, fromRoot?.id ?? "root"]) };
    const archetype = pickArchetype(options, random.fork("archetype"));
    const root = buildRoot(options, random, archetype, context);
    const focus = options.suite?.system ? options.recipe.systems.find((system) => system.id === options.suite?.system) : undefined;
    const screen = {
      schemaVersion: SCREEN_SCHEMA_VERSION,
      id: options.id,
      name: options.name ?? (focus ? `${options.recipe.label}: ${focus.label}` : options.recipe.label),
      section: options.recipe.id,
      tags: ["generated"],
      profile: options.profile ?? { aspect: "16:9", fit: "fluid" },
      revision: 0,
      generator: generatorInfo(options),
      root,
    };
    const result = validateScreen(screen, catalog);
    if (result.ok) return result.value;
    problems.push(...result.issues.map((issue) => `${issue.path}: ${issue.message}`));
  }
  throw new Error(`Could not generate a valid screen: ${problems.slice(0, 5).join("; ")}`);
};

// Several different takes on one section: consecutive seeds, each on another layout when the recipe allows.
export const generateVariants = (options: Omit<GenerateOptions, "archetype" | "from">, count = 3): Screen[] => {
  const profile = options.profile ?? { aspect: "16:9", fit: "fluid" };
  const order = createRandom(options.seed).shuffle(archetypeWeights(options.recipe, options.theme, profile).map(([id]) => id));
  return Array.from({ length: count }, (_, index) =>
    generateScreen({ ...options, seed: (options.seed + index) >>> 0, archetype: order[index % order.length] ?? "header-main" }),
  );
};

// An overview screen plus one screen per system, with nav buttons that navigate between them.
export const generateSuite = (options: Omit<GenerateOptions, "suite" | "from" | "id"> & { id: string; takenIds?: ReadonlySet<string> }): Screen[] => {
  const taken = new Set(options.takenIds ?? []);
  taken.add(options.id);
  const screens: Record<string, string> = { [options.id]: options.id };
  for (const system of options.recipe.systems) {
    let id = `${options.id}-${system.id}`.slice(0, 64);
    for (let n = 2; taken.has(id); n += 1) id = `${options.id}-${system.id}-${n}`.slice(0, 64);
    taken.add(id);
    screens[system.id] = id;
  }
  const show = { ...options.show, screens: [...(options.show.screens ?? []), ...Object.values(screens)] };
  // Every screen of a suite needs somewhere for its nav buttons.
  const drawn = options.theme.archetypes.length > 0 ? options.theme.archetypes : ARCHETYPE_IDS;
  const navigable = drawn.filter((id) => archetypeSlots(id).some((slot) => slot === "nav" || slot === "toolbar"));
  const theme = { ...options.theme, archetypes: navigable.length > 0 ? navigable : (["sidebar"] as const) };
  const overview = generateScreen({ ...options, theme, show, suite: { suite: options.id, screens } });
  const systemScreens = options.recipe.systems.map((system, index) =>
    generateScreen({
      ...options,
      theme,
      show,
      id: screens[system.id] ?? `${options.id}-${index}`,
      seed: subSeed(options.seed, system.id),
      suite: { suite: options.id, system: system.id, screens },
    }),
  );
  return [overview, ...systemScreens];
};

// Ops that regenerate a screen around its locked parts with a new seed: one replace of the root, so one undo
// brings the old screen back.
export const regenerateOps = (screen: Screen, options: Omit<GenerateOptions, "from" | "id" | "name" | "profile">): Op[] => {
  const next = generateScreen({
    ...options,
    from: screen,
    id: screen.id,
    name: screen.name,
    profile: screen.profile,
    density: options.density ?? screen.generator?.density ?? "normal",
  });
  return [
    { op: "replace", id: screen.root.id, node: next.root },
    { op: "meta", generator: next.generator ?? null },
  ];
};

// Whether a node can be rerolled on its own: a panel in main or aside with nothing locked inside.
export const rerollable = (screen: Screen, nodeId: string): boolean => {
  const location = findNode(screen.root, nodeId);
  if (!location?.parent || location.node.type !== "container" || lockedParts(location.node).length > 0) return false;
  // A panel is an aside child of the frame, or a child of the container in main.
  const slot = slotOf(screen, nodeId);
  return (slot === "aside" && location.ancestors.length === 1) || (slot === "main" && location.ancestors.length === 2);
};

const slotOf = (screen: Screen, nodeId: string): "main" | "aside" | undefined => {
  const { root } = screen;
  const location = findNode(root, nodeId);
  if (!location || root.type !== "container" || root.layout.kind !== "frame") return undefined;
  const top = location.ancestors[1] ?? nodeId;
  const entry = root.children.find((child) => child.node.id === top);
  return entry?.slot === "main" || entry?.slot === "aside" ? entry.slot : undefined;
};

// Ops that replace one panel with a fresh one for the same slot, keeping its place.
export const rerollOps = (screen: Screen, nodeId: string, options: Omit<GenerateOptions, "from" | "id">): Op[] => {
  const slot = slotOf(screen, nodeId);
  if (!slot || !rerollable(screen, nodeId)) return [];
  const random = createRandom(subSeed(options.seed, nodeId));
  const taken = collectIds(screen.root);
  const location = findNode(screen.root, nodeId);
  if (location) for (const id of collectIds(location.node)) taken.delete(id);
  taken.add(nodeId);
  const context: Context = { pack: options.pack, recipe: options.recipe, show: options.show, tones: options.theme.tones, taken };
  const focus = options.suite?.system ?? screen.generator?.system;
  const system = options.recipe.systems.find((each) => each.id === focus) ?? random.pick(options.recipe.systems);
  const block = chooseBlock(context, system, slot, random);
  if (!block) return [];
  const offset = random.int(0, context.tones.panels.length - 1);
  const node = buildBlock(block, system, toneAt(context.tones.panels, offset), offset, context, random, nodeId);
  return node ? [{ op: "replace", id: nodeId, node }] : [];
};
