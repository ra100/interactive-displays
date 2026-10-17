import { type Action, type ActionTarget, actionTarget, catalog, findNode, type Screen, TARGETED_ACTIONS, walkNodes } from "@interactive-displays/core";
import { useScreenDocs } from "../../tools/useScreenDocs.ts";
import { useEditor } from "./EditorContext.ts";
import { NumberBox } from "./inspectorParts.tsx";

type Targeted = Extract<Action, { do: (typeof TARGETED_ACTIONS)[number] }>;

export const isTargeted = (action: Action): action is Targeted => (TARGETED_ACTIONS as readonly string[]).includes(action.do);

const CHOSEN = "chosen";

const MODES: Array<{ value: string; label: string }> = [
  { value: "self", label: "This display" },
  { value: "others", label: "Every other display" },
  { value: "all", label: "Every display" },
  { value: CHOSEN, label: "Displays and screens I choose" },
];

const modeOf = (target: ActionTarget): string => (typeof target === "string" ? target : CHOSEN);

// The target with `on` set, or without it for this display (the default); a trigger always says where.
const withTarget = (action: Targeted, target: ActionTarget): Targeted => {
  if (target !== "self" || action.do === "trigger") return { ...action, on: target } as Targeted;
  const { on: _on, ...rest } = action;
  return rest as Targeted;
};

const toggle = (list: readonly string[], id: string, on: boolean): string[] =>
  on ? [...new Set([...list, id])] : list.filter((each) => each !== id);

// The ids of the screens an action reaches, as far as the editor can tell: the screens named, and whatever the
// displays it names show now. The screen being edited stands for "this display".
export const useTargetScreens = (target: ActionTarget): Screen[] => {
  const { overview, screen } = useEditor();
  const showing = (ids: readonly string[] | undefined) =>
    overview.displays.filter((display) => !ids || ids.includes(display.id)).flatMap((display) => (display.showing ? [display.showing] : []));
  const ids =
    target === "self"
      ? []
      : target === "others"
        ? showing(undefined)
        : target === "all"
          ? [screen.id, ...showing(undefined)]
          : [...(target.screens ?? []), ...showing(target.displays ?? [])];
  const refs = [...new Set(ids)].flatMap((id) => {
    const summary = overview.screens.find((each) => each.id === id);
    return summary && id !== screen.id ? [{ id, revision: summary.revision, source: "draft" as const }] : [];
  });
  const docFor = useScreenDocs(refs);
  const others = refs.flatMap((ref) => docFor(ref) ?? []);
  return target === "self" || ids.includes(screen.id) ? [screen, ...others] : others;
};

// The controls a trigger can use on those screens: interactive widgets that have actions of their own.
export const triggerOptions = (screens: readonly Screen[], self?: string): Array<{ value: string; label: string }> => {
  const options = new Map<string, string>();
  for (const each of screens) {
    walkNodes(each.root, (node) => {
      if (node.type !== "widget" || node.id === self || !node.actions?.length || !catalog.get(node.kind)?.interactive) return;
      const label = typeof node.props["label"] === "string" ? `${node.props["label"]} (${node.id})` : node.id;
      options.set(node.id, screens.length > 1 ? `${label} · ${each.name}` : label);
    });
  }
  return [...options].map(([value, label]) => ({ value, label }));
};

// The video widgets on those screens.
export const videoOptions = (screens: readonly Screen[]): Array<{ value: string; label: string }> => {
  const ids = new Set<string>();
  for (const each of screens) {
    walkNodes(each.root, (node) => {
      if (node.type === "widget" && node.kind === "video") ids.add(node.id);
    });
  }
  return [...ids].map((id) => ({ value: id, label: id }));
};

// The chosen displays and screens in words, so the choice reads at a glance above the lists.
const describeChosen = (
  chosen: { displays: readonly string[]; screens: readonly string[] },
  overview: ReturnType<typeof useEditor>["overview"],
): string => {
  const displays = chosen.displays.map((id) => overview.displays.find((each) => each.id === id)?.name ?? id);
  const screens = chosen.screens.map((id) => overview.screens.find((each) => each.id === id)?.name ?? id);
  return `On ${[...displays, ...(screens.length > 0 ? [`any display showing ${screens.join(" or ")}`] : [])].join(", ")}`;
};

// Where an action runs: the display touched, others, all of them, or the displays and screens chosen.
export const TargetFields = ({ action, onChange }: { action: Targeted; onChange: (action: Action) => void }) => {
  const { overview } = useEditor();
  const target = actionTarget(action);
  const mode = modeOf(target);
  const chosen = typeof target === "string" ? { displays: [], screens: [] } : { displays: target.displays ?? [], screens: target.screens ?? [] };
  const setChosen = (next: { displays: string[]; screens: string[] }) => {
    // A choice that names nothing is not a valid target; it waits on the first pick.
    if (next.displays.length + next.screens.length === 0) return;
    onChange(
      withTarget(action, {
        ...(next.displays.length > 0 ? { displays: next.displays } : {}),
        ...(next.screens.length > 0 ? { screens: next.screens } : {}),
      }),
    );
  };
  const firstDisplay = overview.displays[0]?.id;
  return (
    <>
      <label className="tool-field">
        <span className="field__label">Runs on</span>
        <select
          className="tool-select"
          value={mode}
          onChange={(event) => {
            const next = event.target.value;
            if (next !== CHOSEN) return onChange(withTarget(action, next as "self" | "others" | "all"));
            if (firstDisplay) onChange(withTarget(action, { displays: [firstDisplay] }));
            else if (overview.screens[0]) onChange(withTarget(action, { screens: [overview.screens[0].id] }));
          }}
        >
          {MODES.map((each) => (
            <option key={each.value} value={each.value} disabled={each.value === CHOSEN && !firstDisplay && overview.screens.length === 0}>
              {each.label}
            </option>
          ))}
        </select>
      </label>
      {mode === CHOSEN ? (
        <div className="target-picks">
          <p className="tool-field__hint">{describeChosen(chosen, overview)}</p>
          <fieldset className="target-picks__group">
            <legend className="field__label">Displays</legend>
            {overview.displays.map((display) => (
              <label key={display.id} className="check">
                <input
                  type="checkbox"
                  checked={chosen.displays.includes(display.id)}
                  onChange={(event) => setChosen({ ...chosen, displays: toggle(chosen.displays, display.id, event.target.checked) })}
                />
                {display.name ?? display.id}
              </label>
            ))}
          </fieldset>
          <fieldset className="target-picks__group">
            <legend className="field__label">Any display showing</legend>
            {overview.screens.map((each) => (
              <label key={each.id} className="check">
                <input
                  type="checkbox"
                  checked={chosen.screens.includes(each.id)}
                  onChange={(event) => setChosen({ ...chosen, screens: toggle(chosen.screens, each.id, event.target.checked) })}
                />
                {each.name}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </>
  );
};

// Seconds to wait before the action runs; empty runs it at once.
export const AfterField = ({ action, onChange }: { action: Action; onChange: (action: Action) => void }) => (
  <div className="action-wait">
    <NumberBox
      label="Wait (seconds)"
      value={action.after}
      min={0}
      max={600}
      step={0.5}
      placeholder="0"
      onCommit={(after) => {
        if (after !== undefined && (after < 0 || after > 600)) return false;
        const { after: _after, ...rest } = action;
        onChange(after ? ({ ...rest, after } as Action) : (rest as Action));
        return true;
      }}
    />
  </div>
);

// A trigger's control, picked from the screens it reaches.
export const TriggerFields = ({
  action,
  onChange,
  nodeId,
}: {
  action: Extract<Action, { do: "trigger" }>;
  onChange: (action: Action) => void;
  nodeId: string;
}) => {
  const screens = useTargetScreens(action.on);
  const options = triggerOptions(screens, nodeId);
  const known = options.some((option) => option.value === action.target) || screens.some((each) => findNode(each.root, action.target));
  return (
    <>
      <label className="tool-field">
        <span className="field__label">Control</span>
        <select className="tool-select" value={action.target} onChange={(event) => onChange({ ...action, target: event.target.value })}>
          {known ? null : <option value={action.target}>{action.target} (not on those screens)</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-note">It flashes there and runs its own actions, as if someone touched it.</p>
    </>
  );
};
