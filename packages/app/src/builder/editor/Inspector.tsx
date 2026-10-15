import {
  ARCHETYPE_IDS,
  ARCHETYPES,
  archetypeSlots,
  catalog,
  type ContainerNode,
  describeFields,
  type Field,
  findNode,
  findState,
  type Layout,
  type Node,
  type NodeLocation,
  type NormRect,
  canReroll,
  randomSeed,
  rerollScreenOps,
  resolveTokens,
  SpaceSchema,
  type SlotName,
  type ThemeTokens,
  type When,
} from "@interactive-displays/core";
import { decorCatalog, getThemeManifest } from "@interactive-displays/themes/manifest";
import { useEffect, useId, useMemo, useState } from "react";
import {
  clampRect,
  duplicateOps,
  indexAfterSlot,
  layoutOps,
  moveOps,
  nodeLabel,
  removeOps,
  setHiddenIn,
  setOverride,
  shiftOps,
} from "./editing.ts";
import { useEditor } from "./EditorContext.ts";
import { FieldInput } from "./FieldInput.tsx";
import { generationBase } from "../generation.ts";
import { usePacks } from "../usePacks.ts";
import { NumberBox, Section } from "./inspectorParts.tsx";
import { ActionsEditor, LiveValues } from "./LiveSection.tsx";

const fieldsCache = new Map<string, Field[]>();

const fieldsFor = (node: Node): Field[] => {
  if (node.type === "container") return [];
  const cached = fieldsCache.get(node.kind);
  if (cached) return cached;
  const definition = node.type === "widget" ? catalog.get(node.kind) : decorCatalog.get(node.kind);
  const fields = definition ? describeFields(definition.props) : [];
  fieldsCache.set(node.kind, fields);
  return fields;
};

const Placement = ({ location }: { location: NodeLocation }) => {
  const { screen, apply } = useEditor();
  const { parent, entry, node } = location;
  if (!parent || !entry) return null;
  const layout = parent.layout;
  const place = (patch: Record<string, unknown>) => apply([{ op: "place", id: node.id, ...patch }]);

  if (layout.kind === "canvas") {
    const rect: NormRect = entry.rect ?? { x: 0, y: 0, w: 1, h: 1 };
    const set = (key: keyof NormRect) => (value: number | undefined) =>
      value !== undefined && place({ rect: clampRect({ ...rect, [key]: value / 100 }) });
    return (
      <Section title="Position on canvas (%)">
        <div className="number-row">
          <NumberBox label="X" value={Math.round(rect.x * 100)} min={0} max={100} onCommit={set("x")} />
          <NumberBox label="Y" value={Math.round(rect.y * 100)} min={0} max={100} onCommit={set("y")} />
          <NumberBox label="W" value={Math.round(rect.w * 100)} min={2} max={100} onCommit={set("w")} />
          <NumberBox label="H" value={Math.round(rect.h * 100)} min={2} max={100} onCommit={set("h")} />
        </div>
        <p className="panel-note">Drag the box in the preview, or nudge it with the arrow keys (Shift for 5%).</p>
      </Section>
    );
  }

  if (layout.kind === "grid") {
    const area = entry.area ?? { col: 1, row: 1 };
    const set = (key: "col" | "row" | "colSpan" | "rowSpan") => (value: number | undefined) => {
      const next = { ...area, [key]: value };
      if (next.colSpan === undefined) delete next.colSpan;
      if (next.rowSpan === undefined) delete next.rowSpan;
      place({ area: next });
    };
    return (
      <Section title="Grid cell">
        <div className="number-row">
          <NumberBox label="Column" value={area.col} min={1} max={layout.columns.length} onCommit={set("col")} />
          <NumberBox label="Row" value={area.row} min={1} max={layout.rows.length} onCommit={set("row")} />
          <NumberBox label="Col span" value={area.colSpan} min={1} max={12} onCommit={set("colSpan")} />
          <NumberBox label="Row span" value={area.rowSpan} min={1} max={12} onCommit={set("rowSpan")} />
        </div>
        {entry.area ? (
          <button type="button" className="field__reset" onClick={() => place({ area: null })}>
            Flow automatically
          </button>
        ) : (
          <p className="panel-note">Flows into the next free cell.</p>
        )}
      </Section>
    );
  }

  const weight = (
    <>
      <NumberBox
        label="Size share"
        value={entry.weight}
        placeholder="1"
        min={0.1}
        max={100}
        step={0.5}
        onCommit={(value) => place({ weight: value ?? null })}
      />
      <span className="tool-field__hint">How much room it takes next to its siblings; 2 is twice the default.</span>
    </>
  );

  if (layout.kind === "frame") {
    const slots = archetypeSlots(layout.archetype);
    return (
      <Section title="Placement">
        <label className="tool-field">
          <span className="field__label">Slot</span>
          <select
            className="tool-select"
            value={entry.slot ?? ""}
            onChange={(event) => {
              const slot = event.target.value as SlotName;
              apply(moveOps(screen, node.id, { parentId: parent.id, index: indexAfterSlot(parent, slot), slot }) ?? []);
            }}
          >
            {slots.map((slot) => (
              <option key={slot}>{slot}</option>
            ))}
          </select>
        </label>
        {weight}
      </Section>
    );
  }

  return <Section title="Placement">{weight}</Section>;
};

const DEFAULT_LAYOUTS: Record<Layout["kind"], Layout> = {
  frame: { kind: "frame", archetype: "dashboard" },
  stack: { kind: "stack", direction: "column", gap: "medium" },
  grid: { kind: "grid", columns: ["1fr", "1fr"], rows: ["1fr", "1fr"], gap: "medium" },
  canvas: { kind: "canvas" },
};

const LAYOUT_NAMES: Record<Layout["kind"], string> = { frame: "Frame", stack: "Stack", grid: "Grid", canvas: "Canvas" };

const TRACK = /^(\d{1,2}(\.\d{1,2})?fr|auto)$/;

const TracksInput = ({ label, tracks, onCommit }: { label: string; tracks: string[]; onCommit: (tracks: string[]) => void }) => {
  const id = useId();
  const text = tracks.join(" ");
  const [draft, setDraft] = useState(text);
  const [problem, setProblem] = useState(false);
  useEffect(() => setDraft(text), [text]);
  const commit = () => {
    const next = draft.trim().split(/\s+/).filter(Boolean);
    const valid = next.length > 0 && next.length <= 12 && next.every((track) => TRACK.test(track));
    setProblem(!valid);
    if (valid && next.join(" ") !== text) onCommit(next);
  };
  return (
    <div className="tool-field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="tool-input"
        value={draft}
        aria-invalid={problem || undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      <span className="tool-field__hint">{problem ? "Use sizes like 1fr 2fr auto" : "Sizes like 1fr 2fr auto"}</span>
    </div>
  );
};

const LayoutEditor = ({ container }: { container: ContainerNode }) => {
  const { screen, apply } = useEditor();
  const { layout } = container;
  const set = (next: Layout) => apply(layoutOps(screen, container.id, next));
  const gapSelect = layout.kind === "stack" || layout.kind === "grid" ? (
    <label className="tool-field">
      <span className="field__label">Gap</span>
      <select className="tool-select" value={layout.gap} onChange={(event) => set({ ...layout, gap: SpaceSchema.parse(event.target.value) })}>
        {SpaceSchema.options.map((space) => (
          <option key={space}>{space}</option>
        ))}
      </select>
    </label>
  ) : null;

  return (
    <Section title="Layout">
      <label className="tool-field">
        <span className="field__label">Kind</span>
        <select
          className="tool-select"
          value={layout.kind}
          onChange={(event) => set(DEFAULT_LAYOUTS[event.target.value as Layout["kind"]])}
        >
          {(Object.keys(DEFAULT_LAYOUTS) as Layout["kind"][]).map((kind) => (
            <option key={kind} value={kind}>
              {LAYOUT_NAMES[kind]}
            </option>
          ))}
        </select>
      </label>
      {layout.kind === "frame" ? (
        <label className="tool-field">
          <span className="field__label">Archetype</span>
          <select className="tool-select" value={layout.archetype} onChange={(event) => set({ kind: "frame", archetype: event.target.value })}>
            {ARCHETYPE_IDS.map((id) => (
              <option key={id} value={id}>
                {ARCHETYPES[id].label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {layout.kind === "stack" ? (
        <label className="tool-field">
          <span className="field__label">Direction</span>
          <select
            className="tool-select"
            value={layout.direction}
            onChange={(event) => set({ ...layout, direction: event.target.value === "row" ? "row" : "column" })}
          >
            <option value="column">Column</option>
            <option value="row">Row</option>
          </select>
        </label>
      ) : null}
      {layout.kind === "grid" ? (
        <>
          <TracksInput label="Columns" tracks={layout.columns} onCommit={(columns) => set({ ...layout, columns })} />
          <TracksInput label="Rows" tracks={layout.rows} onCommit={(rows) => set({ ...layout, rows })} />
        </>
      ) : null}
      {gapSelect}
    </Section>
  );
};

const overridesSummary = (entry: When[number]) => {
  const keys = Object.keys(entry.props ?? {});
  return [...keys, ...(entry.hidden ? ["hidden"] : [])].join(", ");
};

const NodeInspector = ({ location }: { location: NodeLocation }) => {
  const { screen, overview, apply, select, preview } = useEditor();
  const packs = usePacks();
  const { node, parent, entry } = location;
  const show = overview.show;
  const baseState = show.states[0]?.id;
  const previewState = preview.state !== baseState ? findState(show, preview.state) : undefined;
  const [scoped, setScoped] = useState(false);
  const overrideState = scoped && previewState ? previewState : undefined;
  const fields = useMemo(() => fieldsFor(node), [node]);
  const effect = findState(show, preview.state)?.effect;
  const palette: ThemeTokens["palette"] = resolveTokens(getThemeManifest(preview.themeId), preview.variant, effect).palette;
  const override = overrideState ? node.when?.find((each) => each.state === overrideState.id) : undefined;
  const props = node.type === "container" ? {} : node.props;

  const setWhen = (when: When | null) => apply([{ op: "set", id: node.id, when }]);

  const change = (field: Field) => (value: unknown) => {
    if (overrideState) setWhen(setOverride(node.when, overrideState.id, field.key, value));
    else apply([{ op: "update", id: node.id, props: { [field.key]: value === undefined ? null : value } }]);
  };

  const reset = (field: Field) => {
    if (overrideState) {
      return override?.props && field.key in override.props
        ? () => setWhen(setOverride(node.when, overrideState.id, field.key, undefined))
        : undefined;
    }
    const value = props[field.key];
    return value !== undefined && field.default !== undefined && value !== field.default
      ? () => apply([{ op: "update", id: node.id, props: { [field.key]: field.default } }])
      : undefined;
  };

  return (
    <div className="inspector">
      <header className="inspector__header">
        <h2 className="inspector__title">{nodeLabel(node)}</h2>
        <p className="inspector__id">
          {node.id}
          {node.type === "container" ? "" : ` · ${node.kind}`}
        </p>
        <div className="inspector__actions">
          <button type="button" className="tool-button tool-button--small" disabled={!parent} onClick={() => parent && select({ kind: "node", id: parent.id })}>
            Parent
          </button>
          <button type="button" className="tool-button tool-button--small" disabled={!parent} aria-label="Move up" onClick={() => apply(shiftOps(screen, node.id, -1))}>
            ↑
          </button>
          <button type="button" className="tool-button tool-button--small" disabled={!parent} aria-label="Move down" onClick={() => apply(shiftOps(screen, node.id, 1))}>
            ↓
          </button>
          <button
            type="button"
            className="tool-button tool-button--small"
            disabled={!parent}
            onClick={() => {
              const copy = duplicateOps(screen, node.id);
              if (copy && apply(copy.ops)) select({ kind: "node", id: copy.id });
            }}
          >
            Duplicate
          </button>
          {canReroll(screen, packs, node.id) ? (
            <button
              type="button"
              className="tool-button tool-button--small"
              title="Swap this panel for a fresh one in the same place"
              onClick={() => {
                const ops = rerollScreenOps(screen, packs, generationBase(overview.show, overview.screens.map((each) => each.id)), node.id, randomSeed());
                if (ops) apply(ops);
              }}
            >
              Reroll
            </button>
          ) : null}
          <button
            type="button"
            className="tool-button tool-button--small tool-button--quiet"
            disabled={!parent}
            onClick={() => {
              if (apply(removeOps(screen, node.id))) select(parent ? { kind: "node", id: parent.id } : null);
            }}
          >
            Delete
          </button>
        </div>
      </header>

      {previewState ? (
        <div className="scope" role="radiogroup" aria-label="Changes apply to">
          <button type="button" role="radio" aria-checked={!scoped} onClick={() => setScoped(false)}>
            All states
          </button>
          <button type="button" role="radio" aria-checked={scoped} onClick={() => setScoped(true)}>
            Only in {previewState.label}
          </button>
        </div>
      ) : null}

      {fields.length > 0 ? (
        <Section title={overrideState ? `Properties in ${overrideState.label}` : "Properties"}>
          {fields.map((field) => {
            const overridden = Boolean(override?.props && field.key in override.props);
            const value = overridden ? override?.props?.[field.key] : props[field.key];
            return (
              <FieldInput
                key={field.key}
                field={field}
                value={value}
                palette={palette}
                overridden={overridden}
                onChange={change(field)}
                onReset={reset(field)}
              />
            );
          })}
        </Section>
      ) : null}

      {/* Live values and actions are the same in every state. */}
      {node.type === "widget" && !overrideState ? (
        <>
          <LiveValues node={node} />
          <ActionsEditor node={node} />
        </>
      ) : null}

      {node.type === "container" ? <LayoutEditor container={node} /> : null}
      {parent && entry ? <Placement location={location} /> : null}

      <Section title="Visibility">
        {overrideState ? (
          <label className="check">
            <input
              type="checkbox"
              checked={override?.hidden === true}
              onChange={(event) => setWhen(setHiddenIn(node.when, overrideState.id, event.target.checked))}
            />
            Hidden in {overrideState.label}
          </label>
        ) : (
          <label className="check">
            <input
              type="checkbox"
              checked={node.hidden === true}
              onChange={(event) => apply([{ op: "set", id: node.id, hidden: event.target.checked ? true : null }])}
            />
            Hidden
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={node.locked === true}
            onChange={(event) => apply([{ op: "set", id: node.id, locked: event.target.checked ? true : null }])}
          />
          Locked
          <span className="tool-field__hint">The generator and AI leave locked parts alone.</span>
        </label>
      </Section>

      {node.when?.length ? (
        <Section title="Changes per state">
          <ul className="overrides">
            {node.when.map((each) => (
              <li key={each.state}>
                <span>
                  <strong>{findState(show, each.state)?.label ?? each.state}</strong>: {overridesSummary(each)}
                </span>
                <button
                  type="button"
                  className="field__reset"
                  onClick={() => setWhen(node.when?.filter((other) => other.state !== each.state) ?? null)}
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
};

const SlotInspector = ({ frame, slot }: { frame: ContainerNode; slot: SlotName }) => {
  const { select } = useEditor();
  const children = frame.children.filter((child) => child.slot === slot);
  return (
    <div className="inspector">
      <header className="inspector__header">
        <h2 className="inspector__title">Slot {slot}</h2>
        <p className="inspector__id">in {nodeLabel(frame)}</p>
      </header>
      <p className="panel-note">New items from the Add panel go into this slot.</p>
      {children.length === 0 ? <p className="panel-empty">Empty.</p> : null}
      <ul className="slot-children">
        {children.map((child) => (
          <li key={child.node.id}>
            <button type="button" className="tool-button tool-button--small tool-button--quiet" onClick={() => select({ kind: "node", id: child.node.id })}>
              {nodeLabel(child.node)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Everything about the selected node, generated from its schema; or about the selected frame slot.
export const Inspector = () => {
  const { screen, selection } = useEditor();
  if (selection?.kind === "slot") {
    const frame = findNode(screen.root, selection.frameId)?.node;
    if (frame?.type === "container") return <SlotInspector frame={frame} slot={selection.slot} />;
  }
  const location = selection?.kind === "node" ? findNode(screen.root, selection.id) : undefined;
  if (!location) {
    return <p className="panel-empty">Select something in the preview or the outline to change it.</p>;
  }
  return <NodeInspector key={location.node.id} location={location} />;
};
