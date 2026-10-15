import {
  type Action,
  type AmbientSource,
  type Binding,
  type Bindings,
  catalog,
  describeFields,
  type Field,
  humanize,
  isSettable,
  VIDEO_COMMANDS,
  type WidgetNode,
  widgetIds,
} from "@interactive-displays/core";
import { themeSoundIds } from "@interactive-displays/themes/manifest";
import { useState } from "react";
import { useEditor } from "./EditorContext.ts";
import { NumberBox, Section } from "./inspectorParts.tsx";

const SIGNAL = "signal:";

const modeOf = (binding: Binding | undefined): string => {
  if (!binding) return "";
  return "signal" in binding ? `${SIGNAL}${binding.signal}` : binding.ambient.kind;
};

// A wandering value starts in the widget's own range (a gauge's min and max), or 0 to 100.
const rangeOf = (node: WidgetNode): { min: number; max: number } => {
  const min = typeof node.props["min"] === "number" ? node.props["min"] : 0;
  const max = typeof node.props["max"] === "number" ? node.props["max"] : 100;
  return max > min ? { min, max } : { min, max: min + 100 };
};

// A value that wanders or swings is a number in a range, so it is only offered for props that take any number.
const movesOnItsOwn = (field: Field | undefined): boolean =>
  field?.type === "value" || (field?.type === "number" && !field.integer);

const BindingRow = ({ node, prop, wanders }: { node: WidgetNode; prop: string; wanders: boolean }) => {
  const { overview, apply, notify } = useEditor();
  const signals = overview.show.signals;
  const binding = node.bind?.[prop];
  const mode = modeOf(binding);
  const missing = binding && "signal" in binding && !signals.some((signal) => signal.id === binding.signal);
  const ambient = binding && "ambient" in binding ? binding.ambient : undefined;
  const byState = binding && "ambient" in binding ? binding.byState : undefined;
  const changesIn = overview.show.states.filter((state) => byState && Object.hasOwn(byState, state.id));

  const set = (next: Binding | undefined) => {
    const bind: Bindings = { ...node.bind };
    if (next) bind[prop] = next;
    else delete bind[prop];
    apply([{ op: "set", id: node.id, bind: Object.keys(bind).length > 0 ? bind : null }]);
  };

  // Edits keep the per-state ranges a generated value came with.
  const setAmbient = (next: AmbientSource) => set(byState ? { ambient: next, byState } : { ambient: next });

  const choose = (next: string) => {
    if (next === "") return set(undefined);
    if (next.startsWith(SIGNAL)) return set({ signal: next.slice(SIGNAL.length) });
    const { min, max } = binding && "ambient" in binding ? binding.ambient : rangeOf(node);
    setAmbient(next === "wave" ? { kind: "wave", min, max, periodMs: 4000 } : { kind: "walk", min, max, volatility: 0.3 });
  };

  const setRange = (key: "min" | "max") => (value: number | undefined): boolean => {
    if (!ambient || value === undefined) return false;
    const next = { ...ambient, [key]: value };
    if (next.min >= next.max) {
      notify("The lowest value must be below the highest", "danger");
      return false;
    }
    setAmbient(next);
    return true;
  };

  return (
    <div className="binding">
      <label className="tool-field">
        <span className="field__label">{humanize(prop)}</span>
        <select className="tool-select" value={mode} onChange={(event) => choose(event.target.value)}>
          <option value="">Its own value</option>
          {signals.length > 0 ? (
            <optgroup label="Show signals">
              {signals.map((signal) => (
                <option key={signal.id} value={`${SIGNAL}${signal.id}`}>
                  {signal.label}
                  {signal.scope === "shared" ? " (shared)" : ""}
                </option>
              ))}
            </optgroup>
          ) : null}
          {missing ? <option value={mode}>{binding.signal} (missing)</option> : null}
          {wanders || ambient ? (
            <optgroup label="On its own">
              <option value="walk">Wanders</option>
              <option value="wave">Swings back and forth</option>
            </optgroup>
          ) : null}
        </select>
      </label>
      {ambient ? (
        <div className="number-row">
          <NumberBox label="Lowest" value={ambient.min} step={0.1} onCommit={setRange("min")} />
          <NumberBox label="Highest" value={ambient.max} step={0.1} onCommit={setRange("max")} />
          {ambient.kind === "walk" ? (
            <NumberBox
              label="Restless"
              value={ambient.volatility}
              min={0}
              max={1}
              step={0.1}
              onCommit={(volatility) => volatility !== undefined && setAmbient({ ...ambient, volatility })}
            />
          ) : (
            <NumberBox
              label="Seconds"
              value={ambient.periodMs / 1000}
              min={0.2}
              max={3600}
              step={0.5}
              onCommit={(seconds) => seconds !== undefined && setAmbient({ ...ambient, periodMs: Math.round(seconds * 1000) })}
            />
          )}
        </div>
      ) : null}
      {changesIn.length > 0 ? (
        <p className="tool-field__hint">Moves differently in {changesIn.map((state) => state.label).join(", ")}.</p>
      ) : null}
    </div>
  );
};

// Which props follow a live value instead of their own: a show signal, or a value that moves by itself.
export const LiveValues = ({ node }: { node: WidgetNode }) => {
  const definition = catalog.get(node.kind);
  const bindable = definition?.bindable ?? [];
  if (!definition || bindable.length === 0) return null;
  const fields = describeFields(definition.props);
  return (
    <Section title="Live value">
      {bindable.map((prop) => (
        <BindingRow key={prop} node={node} prop={prop} wanders={movesOnItsOwn(fields.find((field) => field.key === prop))} />
      ))}
      <p className="panel-note">Shared signals show the same value on every display; the operator sets them.</p>
    </Section>
  );
};

const ACTION_LABELS: Record<Action["do"], string> = {
  navigate: "Go to screen",
  back: "Go back",
  setState: "Change show state",
  setSignal: "Set a shared value",
  video: "Control a video",
  sound: "Play a sound",
};

const ACTION_KINDS = Object.keys(ACTION_LABELS) as Action["do"][];

// Controls whose use carries a value of their own (slider position, chosen option, on or off).
const HAS_VALUE = new Set(["slider", "toggle", "button-group"]);

type SignalMode = "own" | "to" | "by";

const signalMode = (action: Extract<Action, { do: "setSignal" }>): SignalMode =>
  action.delta !== undefined ? "by" : action.value !== undefined ? "to" : "own";

const Select = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => (
  <label className="tool-field">
    <span className="field__label">{label}</span>
    <select className="tool-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.some((option) => option.value === value) ? null : <option value={value}>{value} (missing)</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const ActionFields = ({
  node,
  action,
  onChange,
}: {
  node: WidgetNode;
  action: Action;
  onChange: (action: Action) => void;
}) => {
  const { overview, screen } = useEditor();
  const show = overview.show;
  switch (action.do) {
    case "back":
      return <p className="panel-note">Returns to the screen the display showed before.</p>;
    case "navigate":
      return (
        <Select
          label="Screen"
          value={action.screen}
          options={overview.screens.filter((each) => each.id !== screen.id).map((each) => ({ value: each.id, label: each.name }))}
          onChange={(value) => onChange({ ...action, screen: value })}
        />
      );
    case "setState":
      return (
        <Select
          label="State"
          value={action.state}
          options={show.states.map((state) => ({ value: state.id, label: state.label }))}
          onChange={(value) => onChange({ ...action, state: value })}
        />
      );
    case "setSignal": {
      const mode = signalMode(action);
      const { value: _value, delta: _delta, ...rest } = action;
      const source = show.signals.find((signal) => signal.id === action.signal)?.source;
      const step = source?.kind === "manual" ? source.step : 1;
      return (
        <>
          <Select
            label="Signal"
            value={action.signal}
            options={show.signals.filter(isSettable).map((signal) => ({ value: signal.id, label: signal.label }))}
            onChange={(value) => onChange({ ...action, signal: value })}
          />
          <Select
            label="How"
            value={mode}
            options={[
              ...(HAS_VALUE.has(node.kind) ? [{ value: "own", label: "To this control's value" }] : []),
              { value: "to", label: "To a value" },
              { value: "by", label: "Up or down by" },
            ]}
            onChange={(next) =>
              onChange(next === "to" ? { ...rest, value: 0 } : next === "by" ? { ...rest, delta: step } : rest)
            }
          />
          {mode === "to" ? (
            <NumberBox label="Value" value={action.value} step={0.1} onCommit={(value) => onChange({ ...rest, value: value ?? 0 })} />
          ) : null}
          {mode === "by" ? (
            <>
              <NumberBox label="By" value={action.delta} step={step} onCommit={(delta) => onChange({ ...rest, delta: delta ?? step })} />
              <p className="panel-note">Moves in whole steps of {step}; a negative number moves down.</p>
            </>
          ) : null}
        </>
      );
    }
    case "video":
      return (
        <>
          <Select
            label="Video"
            value={action.target}
            options={widgetIds(screen.root, "video").map((id) => ({ value: id, label: id }))}
            onChange={(value) => onChange({ ...action, target: value })}
          />
          <Select
            label="Command"
            value={action.command}
            options={VIDEO_COMMANDS.map((command) => ({ value: command, label: humanize(command) }))}
            onChange={(value) => onChange({ ...action, command: value as (typeof VIDEO_COMMANDS)[number] })}
          />
        </>
      );
    case "sound":
      return (
        <Select
          label="Sound"
          value={action.sound}
          options={themeSoundIds(show.theme.id).map((id) => ({ value: id, label: humanize(id) }))}
          onChange={(value) => onChange({ ...action, sound: value })}
        />
      );
  }
};

// What a control does when an actor uses it, in order. Show-wide actions only run while the operator lets
// display buttons run the show.
export const ActionsEditor = ({ node }: { node: WidgetNode }) => {
  const { overview, screen, apply } = useEditor();
  // Chosen first and added with a button, so arrowing through the list does not add actions.
  const [adding, setAdding] = useState<Action["do"] | "">("");
  if (!catalog.get(node.kind)?.interactive) return null;
  const show = overview.show;
  const actions = node.actions ?? [];
  const save = (next: Action[]) => apply([{ op: "set", id: node.id, actions: next.length > 0 ? next : null }]);

  const otherScreen = overview.screens.find((each) => each.id !== screen.id);
  const settable = show.signals.find(isSettable);
  const video = widgetIds(screen.root, "video")[0];
  const sounds = themeSoundIds(show.theme.id);
  const starter = (kind: Action["do"]): Action | undefined => {
    switch (kind) {
      case "navigate":
        return otherScreen ? { do: "navigate", screen: otherScreen.id } : undefined;
      case "back":
        return { do: "back" };
      case "setState": {
        const state = show.states[1] ?? show.states[0];
        return state ? { do: "setState", state: state.id } : undefined;
      }
      case "setSignal":
        return settable ? { do: "setSignal", signal: settable.id, ...(HAS_VALUE.has(node.kind) ? {} : { value: 0 }) } : undefined;
      case "video":
        return video ? { do: "video", target: video, command: "play" } : undefined;
      case "sound": {
        const sound = sounds.includes("confirm") ? "confirm" : sounds[0];
        return sound ? { do: "sound", sound } : undefined;
      }
    }
  };

  const next = adding ? starter(adding) : undefined;

  return (
    <Section title="When used">
      {actions.length === 0 ? <p className="panel-note">Nothing yet: it flashes and, with sounds on, beeps.</p> : null}
      <ol className="action-list">
        {actions.map((action, index) => (
          <li key={index} className="action-item">
            <div className="action-item__head">
              <strong>{ACTION_LABELS[action.do]}</strong>
              <button
                type="button"
                className="field__reset"
                aria-label={`Remove ${ACTION_LABELS[action.do]}`}
                onClick={() => save(actions.filter((_, other) => other !== index))}
              >
                Remove
              </button>
            </div>
            <ActionFields node={node} action={action} onChange={(next) => save(actions.map((each, other) => (other === index ? next : each)))} />
          </li>
        ))}
      </ol>
      {actions.length < 8 ? (
        <div className="action-add">
          <label className="tool-field">
            <span className="field__label">New action</span>
            <select className="tool-select" value={adding} onChange={(event) => setAdding(event.target.value as Action["do"] | "")}>
              <option value="">Choose…</option>
              {ACTION_KINDS.map((kind) => (
                <option key={kind} value={kind} disabled={!starter(kind)}>
                  {ACTION_LABELS[kind]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="tool-button tool-button--small"
            disabled={!next}
            onClick={() => {
              if (!next) return;
              save([...actions, next]);
              setAdding("");
            }}
          >
            Add
          </button>
        </div>
      ) : null}
      {actions.some((action) => action.do === "setState" || action.do === "setSignal") && !show.settings.displayGlobalActions ? (
        <p className="panel-note">The operator has display buttons switched off, so show-wide actions do nothing for now.</p>
      ) : null}
    </Section>
  );
};
