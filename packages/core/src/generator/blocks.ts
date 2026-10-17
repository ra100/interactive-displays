import { SHIP_SYSTEMS } from "../catalog/shipSchematic.ts";
import type { Block, InstrumentWidget, Metric, MetricWidget, Part, System } from "../schema/content.ts";
import type { ChildEntry, Node, When, WidgetNode } from "../schema/node.ts";
import type { Binding } from "../schema/signal.ts";
import type { Tone } from "../schema/tone.ts";
import { alertStates, type Context, code, freshId, phrase, toneAt, usableActions } from "./context.ts";
import type { Random } from "./random.ts";

// Turns blocks (data) into widgets for one system: a heading, its readings, its buttons and some busy filler.

const round = (value: number, precision: number) => Number(value.toFixed(precision));

const precisionOf = (metric: Metric): number => {
  if (metric.precision !== undefined) return metric.precision;
  const span = metric.range[1] - metric.range[0];
  return span >= 20 ? 0 : span >= 2 ? 1 : 2;
};

// The scale a gauge shows: room for both the resting and the alert range, and 0 to 100 for percentages.
const scaleOf = (metric: Metric): { min: number; max: number } => {
  const low = Math.min(metric.range[0], metric.alertRange?.[0] ?? metric.range[0]);
  const high = Math.max(metric.range[1], metric.alertRange?.[1] ?? metric.range[1]);
  const pad = (high - low) * 0.1;
  if (metric.unit === "%" && low >= 0 && high <= 100) return { min: 0, max: 100 };
  const min = low >= 0 && low - pad < 0 ? 0 : Math.floor(low - pad);
  const max = Math.ceil(high + pad);
  return { min, max: max > min ? max : min + 1 };
};

// Where a gauge turns danger: halfway between the resting range and an alert range on one side of it.
const dangerOf = (metric: Metric): { dangerBelow?: number; dangerAbove?: number } => {
  const alert = metric.alertRange;
  if (!alert) return {};
  const precision = precisionOf(metric);
  if (alert[1] <= metric.range[0]) return { dangerBelow: round((alert[1] + metric.range[0]) / 2, precision) };
  if (alert[0] >= metric.range[1]) return { dangerAbove: round((alert[0] + metric.range[1]) / 2, precision) };
  return {};
};

const bindingOf = (metric: Metric, context: Context, random: Random): Binding => {
  if (metric.signal && (context.show.signals ?? []).some((signal) => signal.id === metric.signal)) {
    return { signal: metric.signal };
  }
  const [min, max] = metric.range;
  const ambient =
    metric.motion === "wave"
      ? ({ kind: "wave", min, max, periodMs: random.int(4, 12) * 1000 } as const)
      : ({ kind: "walk", min, max, volatility: round(0.2 + random.next() * 0.3, 2) } as const);
  const alert = metric.alertRange;
  const states = alertStates(context.show);
  if (!alert || states.length === 0) return { ambient };
  const swing = metric.motion === "wave" ? { periodMs: random.int(2, 4) * 1000 } : { volatility: 0.85 };
  return { ambient, byState: Object.fromEntries(states.map((state) => [state, { min: alert[0], max: alert[1], ...swing }])) };
};

// A value that wanders inside a range on its own, and to an alert range in the show's alert states.
const wandering = (range: readonly [number, number], alert: readonly [number, number] | undefined, context: Context, random: Random, volatility = 0.3): Binding => {
  const ambient = { kind: "walk", min: range[0], max: range[1], volatility: round(volatility + random.next() * 0.2, 2) } as const;
  const states = alertStates(context.show);
  if (!alert || states.length === 0) return { ambient };
  return { ambient, byState: Object.fromEntries(states.map((state) => [state, { min: alert[0], max: alert[1], volatility: 0.85 }])) };
};

const emphasised = (metric: Metric, context: Context) => context.recipe.alert.emphasise.includes(metric.id);

const inAlert = (context: Context, props: Record<string, unknown>): When | undefined => {
  const states = alertStates(context.show);
  return states.length > 0 ? states.map((state) => ({ state, props })) : undefined;
};

const widget = (
  id: string,
  kind: string,
  props: Record<string, unknown>,
  extra: Partial<Pick<WidgetNode, "bind" | "actions" | "when">> = {},
): WidgetNode => ({
  id,
  type: "widget",
  kind,
  props,
  ...(extra.bind ? { bind: extra.bind } : {}),
  ...(extra.actions && extra.actions.length > 0 ? { actions: extra.actions } : {}),
  ...(extra.when ? { when: extra.when } : {}),
});

const metricWidget = (show: MetricWidget, metric: Metric, system: System, tone: Tone, context: Context, random: Random) => {
  const id = freshId(context, `${system.id}-${metric.id}`);
  const unit = metric.unit ? { unit: metric.unit } : {};
  const middle = round((metric.range[0] + metric.range[1]) / 2, precisionOf(metric));
  const bind = { value: bindingOf(metric, context, random) };
  const when = emphasised(metric, context) ? inAlert(context, { tone: "danger" }) : undefined;
  const extra = when ? { bind, when } : { bind };
  switch (show) {
    case "gauge":
      return widget(
        id,
        "gauge",
        {
          label: metric.label,
          value: middle,
          ...scaleOf(metric),
          ...unit,
          precision: precisionOf(metric),
          variant: random.pick(["bar", "segmented", "arc"] as const),
          tone,
          ...dangerOf(metric),
        },
        extra,
      );
    case "sparkline":
      return widget(id, "sparkline", { label: metric.label, ...scaleOf(metric), points: random.pick([36, 48, 60]), tone }, extra);
    case "readout":
      return widget(id, "readout", { label: metric.label, value: middle, ...unit, precision: precisionOf(metric), tone }, extra);
  }
};

const percentOf = (metric: Metric | undefined): { range: [number, number]; alert?: [number, number] } => {
  if (metric && metric.unit === "%" && metric.range[0] >= 0 && metric.range[1] <= 100) {
    return metric.alertRange ? { range: metric.range, alert: metric.alertRange } : { range: metric.range };
  }
  return { range: [88, 100], alert: [25, 70] };
};

const word = (context: Context, random: Random, max = 24): string => random.pick(context.pack.vocab.words).toUpperCase().slice(0, max);

// The ship schematic as each section sees it, and the views that suit it.
const SHIP_MODES = { tactical: "tactical", engineering: "engineering" } as const;
const SHIP_VIEWS = {
  tactical: ["top", "top", "turn"],
  engineering: ["side", "side", "turn"],
  schematic: ["top", "side", "front", "turn"],
} as const;

// An instrument stands for the system as a whole. Its live parts follow the system's first reading where that
// fits (a level in percent, a speed), and otherwise wander in believable ranges; alerts arm, lock and swing them.
const instrumentWidget = (kind: InstrumentWidget, system: System, tone: Tone, context: Context, random: Random): WidgetNode => {
  const id = freshId(context, `${system.id}-${kind}`);
  const label = system.label;
  const lead = system.metrics[0];
  const level = percentOf(lead);
  switch (kind) {
    case "shield-status": {
      const facings = ["forward", "aft", "port", "starboard"] as const;
      const bind = Object.fromEntries(facings.map((facing) => [facing, wandering(level.range, level.alert, context, random)]));
      return widget(id, kind, { label, tone }, { bind });
    }
    case "weapons": {
      const when = inAlert(context, { armed: true });
      const bind = { charge: wandering([70, 100], [40, 100], context, random, 0.4) };
      const props = { label, ordnance: random.int(40, 250), tubes: random.int(1, 3), tone };
      return widget(id, kind, props, when ? { bind, when } : { bind });
    }
    case "target-lock": {
      const bearing = random.int(0, 359);
      const when = inAlert(context, { locked: true, target: word(context, random, 32) });
      const bind = { bearing: wandering([bearing - 6, bearing + 6], undefined, context, random, 0.1), range: wandering([18000, 60000], [2000, 9000], context, random) };
      return widget(id, kind, { label, bearing, mark: random.int(-12, 12), range: 40000, tone }, when ? { bind, when } : { bind });
    }
    case "heading": {
      const bearing = random.int(0, 359);
      const bind = { bearing: wandering([bearing - 3, bearing + 3], undefined, context, random, 0.05), mark: wandering([-2, 4], undefined, context, random, 0.05) };
      return widget(id, kind, { label, bearing, mark: 2, variant: random.pick(["tape", "tape", "rose"] as const), tone }, { bind });
    }
    case "speed-ladder": {
      const fits = lead && lead.range[1] <= 12 && lead.range[0] >= 0;
      const value = fits ? round((lead.range[0] + lead.range[1]) / 2, 1) : random.int(4, 8);
      const extra = fits ? { bind: { value: bindingOf(lead, context, random) } } : {};
      return widget(id, kind, { label: fits ? lead.label.slice(0, 40) : label, value, steps: 9, tone }, extra);
    }
    case "star-chart":
      return widget(
        id,
        kind,
        { label, destination: word(context, random, 32), waypoints: random.int(3, 6), stars: random.int(40, 90), tone },
        { bind: { progress: wandering([25, 65], undefined, context, random, 0.05) } },
      );
    case "reactor": {
      const extra = lead ? { bind: { level: wandering(percentOf(lead).range, percentOf(lead).alert, context, random) } } : {};
      return widget(id, kind, { label, segments: random.int(10, 18), tone }, extra);
    }
    case "waveform": {
      const when = inAlert(context, { speed: "fast" });
      const props = { label: `${word(context, random, 20)} ${label}`.slice(0, 40), shape: lead?.unit === "bpm" ? "heartbeat" : random.pick(["sine", "noise", "pulse"] as const), traces: random.int(1, 3), tone };
      return widget(id, kind, props, when ? { when } : {});
    }
    case "spectrum": {
      const when = inAlert(context, { activity: "busy" });
      return widget(id, kind, { label, bands: random.pick([24, 32, 48]), tone }, when ? { when } : {});
    }
    case "globe":
      return widget(id, kind, { label, sites: random.int(2, 5), tone });
    case "scan-progress":
      return widget(id, kind, { label: `${label} SCAN`.slice(0, 40), seconds: random.int(8, 20), tone });
    case "ship-schematic": {
      // Tactical follows the shields and arms in an alert, engineering the power from the core; a system the
      // ship marks (its shuttlebay, its deflector) is picked out; a damaged state turns to damage control.
      const mode = context.recipe.id === "tactical" || context.recipe.id === "engineering" ? SHIP_MODES[context.recipe.id] : "schematic";
      const highlight = SHIP_SYSTEMS.filter((each) => each === system.id);
      const live = wandering(level.range, level.alert, context, random);
      const bind = mode === "tactical" ? { shields: live } : mode === "engineering" ? { power: live } : undefined;
      const hit = random.shuffle(SHIP_SYSTEMS).slice(0, 2);
      const when: When = context.show.states.flatMap((state): When => {
        if (state.effect === "damaged") return [{ state: state.id, props: { mode: "damage", damaged: hit } }];
        if (state.effect === "alert" && mode === "tactical") return [{ state: state.id, props: { armed: true } }];
        return [];
      });
      const props = { label, view: random.pick(SHIP_VIEWS[mode]), mode, ...(highlight.length > 0 ? { highlight } : {}), tone };
      return widget(id, kind, props, { ...(bind ? { bind } : {}), ...(when.length > 0 ? { when } : {}) });
    }
  }
};

// The widget a reading shows as: one the part allows, preferring what the reading asks for.
const showAs = (allowed: readonly MetricWidget[], metric: Metric, random: Random): MetricWidget => {
  const preferred = metric.prefer.filter((each) => allowed.includes(each));
  return random.pick(preferred.length > 0 ? preferred : allowed);
};

// One system's material while a block is built: readings and buttons are used up in order, so a panel never
// shows the same reading twice.
interface Supply {
  system: System;
  metrics: Metric[];
  actions: System["actions"];
  instruments: InstrumentWidget[];
  tone: Tone;
  offset: number;
}

const take = <T,>(items: T[], count: number): T[] => items.splice(0, count);

type Built = { node: Node; weight?: number } | undefined;

const buildPart = (part: Part, supply: Supply, context: Context, random: Random): Built => {
  const { system, tone } = supply;
  const weight = part.weight === undefined ? {} : { weight: part.weight };
  const vocab = context.pack.vocab;
  switch (part.part) {
    case "heading":
      return {
        node: widget(freshId(context, `${system.id}-title`), "title", { text: system.label, code: code(vocab, random), tone }),
        ...weight,
      };
    case "metric": {
      const [metric] = take(supply.metrics, 1);
      if (!metric) return undefined;
      return { node: metricWidget(showAs(part.show, metric, random), metric, system, tone, context, random), ...weight };
    }
    case "metrics": {
      const metrics = take(supply.metrics, part.max);
      if (metrics.length === 0) return undefined;
      const children = metrics.map((metric, index) => ({
        node: metricWidget(showAs(part.show, metric, random), metric, system, toneAt(context.tones.panels, supply.offset + index + 1), context, random),
      }));
      return { node: stack(context, `${system.id}-readings`, part.direction, children), ...weight };
    }
    case "lights": {
      const lit = system.metrics.slice(0, part.max);
      const children = lit.map((metric) => {
        const when = emphasised(metric, context)
          ? inAlert(context, { status: "danger", blink: true })
          : inAlert(context, { status: "warning" });
        return {
          node: widget(freshId(context, `${system.id}-${metric.id}-light`), "status-light", { label: metric.label, status: "ok" }, when ? { when } : {}),
        };
      });
      return { node: stack(context, `${system.id}-lights`, "column", children), ...weight };
    }
    case "actions": {
      const actions = take(supply.actions, part.max);
      if (actions.length === 0) return undefined;
      const children = actions.map((action, index) => ({
        node: widget(
          freshId(context, `${system.id}-${action.label}`),
          "button",
          { label: action.label, tone: action.danger ? "danger" : toneAt(context.tones.panels, supply.offset + index + 1) },
          { actions: usableActions(action.actions, context.show) },
        ),
      }));
      return { node: stack(context, `${system.id}-actions`, part.direction, children), ...weight };
    }
    case "ambient": {
      const kind = random.pick(part.show);
      const id = freshId(context, `${system.id}-${kind}`);
      const activity = random.pick(["calm", "busy"] as const);
      const label = random.pick(vocab.words).toUpperCase().slice(0, 24);
      const props = (() => {
        switch (kind) {
          case "data-cascade":
            return { columns: random.int(4, 8), speed: random.pick(["slow", "normal", "fast"] as const), tone };
          case "status-matrix":
            return { label, columns: random.int(6, 10), rows: random.int(2, 4), activity, tone };
          case "bar-graph":
            return { label, bars: random.int(8, 14), activity, tone };
          case "waveform":
            return { label, shape: random.pick(["sine", "noise"] as const), traces: random.int(1, 3), tone };
          case "spectrum":
            return { label, bands: random.pick([24, 32]), activity, tone };
        }
      })();
      return { node: widget(id, kind, props), ...weight };
    }
    case "instrument": {
      const [kind] = take(supply.instruments, 1);
      if (!kind) return undefined;
      return { node: instrumentWidget(kind, system, tone, context, random), ...weight };
    }
    case "panel": {
      const built = part.children
        .map((child) => ({ child, built: buildPart(child, supply, context, random) }))
        .filter((each): each is { child: Part; built: NonNullable<Built> } => each.built !== undefined);
      const heading = built.find((each) => each.child.part === "heading");
      const body = built.filter((each) => each !== heading).map(({ built: each }) => ({ node: each.node, ...(each.weight === undefined ? {} : { weight: each.weight }) }));
      if (body.length === 0) return undefined;
      const main = body.length === 1 && body[0] ? body[0].node : stack(context, `${system.id}-panel-body`, "column", body);
      const children: ChildEntry[] = [...(heading ? [{ slot: "title" as const, node: heading.built.node }] : []), { slot: "main" as const, node: main }];
      const layout = { kind: "frame", archetype: "panel", ...(part.shape ? { variant: part.shape } : {}) } as const;
      return { node: { id: freshId(context, `${system.id}-panel`), type: "container", layout, children }, ...weight };
    }
    case "notes": {
      const text = system.notes.length > 0 && random.next() < 0.6 ? random.pick(system.notes) : phrase(vocab, system.label, random);
      return { node: widget(freshId(context, `${system.id}-notes`), "text", { text, size: "small", tone: "secondary" }), ...weight };
    }
    case "log": {
      const columns = vocab.logColumns;
      const rows = Array.from({ length: part.rows }, () =>
        columns.map((_, index) =>
          index === 0 ? code(vocab, random) : index === columns.length - 1 ? random.pick(vocab.statuses) : String(random.int(10, 999)),
        ),
      );
      return {
        node: widget(freshId(context, `${system.id}-log`), "data-grid", { columns: [...columns], rows, highlight: random.int(1, part.rows), tone }),
        ...weight,
      };
    }
    case "clock":
      return {
        node: widget(freshId(context, `${system.id}-clock`), "clock", { format: "stardate", label: "STARDATE", tone }),
        ...weight,
      };
    case "stack": {
      const children = part.children
        .map((child) => buildPart(child, supply, context, random))
        .filter((built): built is NonNullable<Built> => built !== undefined)
        .map((built) => ({ node: built.node, ...(built.weight === undefined ? {} : { weight: built.weight }) }));
      if (children.length === 0) return undefined;
      return { node: stack(context, `${system.id}-group`, part.direction, children, part.gap), ...weight };
    }
  }
};

const stack = (
  context: Context,
  stem: string,
  direction: "row" | "column",
  children: ChildEntry[],
  gap: "none" | "small" | "medium" | "large" = "small",
): Node => ({
  id: freshId(context, stem),
  type: "container",
  layout: { kind: "stack", direction, gap },
  children,
});

// Whether a block makes sense for a system in a slot.
export const blockFits = (block: Block, system: System, slot: "main" | "aside"): boolean =>
  block.fits.includes(slot) &&
  block.needs.metrics <= system.metrics.length &&
  block.needs.actions <= system.actions.length &&
  block.needs.instruments <= system.instruments.length;

// Picks a block for a system: preferred ones more often, avoided ones never, repeats on one screen rarely.
export const chooseBlock = (
  context: Context,
  system: System,
  slot: "main" | "aside",
  random: Random,
  options: { used?: ReadonlySet<string>; size?: Block["size"]; tags?: readonly string[] } = {},
): Block | undefined => {
  const { prefer, avoid } = context.recipe.blocks;
  const candidates = context.pack.blocks.filter((block) => blockFits(block, system, slot) && !avoid.includes(block.id));
  if (candidates.length === 0) return undefined;
  return random.weighted(
    candidates.map((block) => {
      let weight = prefer.includes(block.id) ? 3 : 1;
      if (options.used?.has(block.id)) weight *= 0.25;
      if (options.size && block.size === options.size) weight *= 3;
      if (options.tags?.some((tag) => block.tags.includes(tag))) weight *= 8;
      return [block, weight] as const;
    }),
  );
};

// One panel: the block's parts filled from a system, inside a column with a fresh id (or the id given).
export const buildBlock = (
  block: Block,
  system: System,
  tone: Tone,
  offset: number,
  context: Context,
  random: Random,
  id?: string,
): Node | undefined => {
  const supply: Supply = { system, metrics: [...system.metrics], actions: [...system.actions], instruments: [...system.instruments], tone, offset };
  const built = buildPart(block.layout, supply, context, random);
  if (!built) return undefined;
  const node = built.node;
  if (node.type === "container" && node.layout.kind === "stack") {
    return { ...node, id: id ?? freshId(context, `${system.id}-${block.id}`) };
  }
  return { id: id ?? freshId(context, `${system.id}-${block.id}`), type: "container", layout: { kind: "stack", direction: "column", gap: "small" }, children: [{ node }] };
};
