import {
  type ArchetypeId,
  DENSITIES,
  type Density,
  generateSuite,
  generateVariants,
  isArchetype,
  type Profile,
  ProfileSchema,
  randomSeed,
  type Screen,
  type Show,
  slugify,
  uniqueId,
} from "@interactive-displays/core";
import { useId, useMemo, useState } from "react";
import { Dialog } from "../../tools/Dialog.tsx";
import { ScreenThumbnail } from "../../tools/ScreenThumbnail.tsx";
import { type GenerationBase, sections } from "../generation.ts";

const ASPECTS = ProfileSchema.shape.aspect.unwrap().options;

const DENSITY_LABELS: Record<Density, string> = { sparse: "Sparse", normal: "Normal", dense: "Dense" };

const archetypeOf = (screen: Screen) =>
  screen.root.type === "container" && screen.root.layout.kind === "frame" ? screen.root.layout.archetype : "";

// Pick a ship section and get three screens to choose from, generated in the browser from the content pack.
// Dice rolls new ones; "a suite" also makes one screen per system, linked by their nav buttons.
export const GenerateDialog = ({
  theme,
  states,
  base,
  takenIds,
  onCreate,
  onClose,
}: {
  theme: Show["theme"];
  states: Show["states"];
  base: GenerationBase;
  takenIds: ReadonlySet<string>;
  onCreate: (screens: Screen[]) => Promise<string | undefined>;
  onClose: () => void;
}) => {
  const [key, setKey] = useState(sections[0]?.key ?? "");
  const [density, setDensity] = useState<Density>("normal");
  const [aspect, setAspect] = useState<Profile["aspect"]>("16:9");
  const [seed, setSeed] = useState(randomSeed);
  const [chosen, setChosen] = useState(0);
  const [suite, setSuite] = useState(false);
  const [previewState, setPreviewState] = useState(states[0]?.id ?? "normal");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  const section = sections.find((each) => each.key === key);
  const id = section ? uniqueId(slugify(section.recipe.label), takenIds) : "";

  const variants = useMemo(() => {
    if (!section) return [];
    try {
      return generateVariants({ ...base, pack: section.pack, recipe: section.recipe, seed, density, id, profile: { aspect, fit: "fluid" } });
    } catch {
      return [];
    }
  }, [base, section, seed, density, id, aspect]);
  const picked = variants[chosen] ?? variants[0];
  const effect = states.find((state) => state.id === previewState)?.effect ?? "none";

  const roll = () => {
    setSeed(randomSeed());
    setChosen(0);
  };

  const submit = async () => {
    if (!section || !picked) return;
    setBusy(true);
    const screens = suite
      ? generateSuite({
          ...base,
          pack: section.pack,
          recipe: section.recipe,
          seed: picked.generator?.seed ?? seed,
          density,
          id,
          profile: picked.profile,
          ...(isArchetype(archetypeOf(picked)) ? { archetype: archetypeOf(picked) as ArchetypeId } : {}),
          takenIds,
        })
      : [picked];
    const problem = await onCreate(screens);
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <Dialog title="Generate a screen" onClose={onClose} wide>
      <form
        className="new-screen generate"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="new-screen__fields">
          <label className="tool-field">
            <span className="tool-label">Section</span>
            <select
              className="tool-select"
              value={key}
              onChange={(event) => {
                setKey(event.target.value);
                setChosen(0);
              }}
            >
              {sections.map((each) => (
                <option key={each.key} value={each.key}>
                  {each.recipe.label}
                </option>
              ))}
            </select>
          </label>
          <div className="tool-field">
            <span className="tool-label" id={`${formId}-density`}>
              Density
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${formId}-density`}>
              {DENSITIES.map((each) => (
                <button key={each} type="button" role="radio" aria-checked={density === each} onClick={() => setDensity(each)}>
                  {DENSITY_LABELS[each]}
                </button>
              ))}
            </div>
          </div>
          <label className="tool-field">
            <span className="tool-label">Aspect</span>
            <select className="tool-select" value={aspect} onChange={(event) => setAspect(event.target.value as Profile["aspect"])}>
              {ASPECTS.map((each) => (
                <option key={each}>{each}</option>
              ))}
            </select>
          </label>
          <div className="tool-field">
            <label className="tool-label" htmlFor={`${formId}-seed`}>
              Seed
            </label>
            <div className="generate__seed">
              <input
                id={`${formId}-seed`}
                className="tool-input"
                inputMode="numeric"
                value={seed}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isInteger(next) && next >= 0 && next <= 0xffffffff) setSeed(next);
                }}
              />
              <button type="button" className="tool-button" onClick={roll} aria-label="Roll new screens" title="Roll new screens">
                🎲 Roll
              </button>
            </div>
          </div>
        </div>
        {section?.recipe.description ? <p className="tool-field__hint">{section.recipe.description}</p> : null}

        <fieldset className="generate__variants">
          <legend className="tool-label">
            Pick one
            <select
              className="tool-select generate__state"
              aria-label="Preview state"
              value={previewState}
              onChange={(event) => setPreviewState(event.target.value)}
            >
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.label}
                </option>
              ))}
            </select>
          </legend>
          {variants.map((screen, index) => (
            <label key={`${screen.generator?.seed}-${index}`} className="template-card" data-selected={chosen === index}>
              <input type="radio" name="variant" value={index} checked={chosen === index} onChange={() => setChosen(index)} />
              <ScreenThumbnail screen={screen} theme={theme} state={previewState} effect={effect} states={states} />
              <span className="template-card__label">Take {index + 1}</span>
              <span className="template-card__description">
                {archetypeOf(screen)} · seed {screen.generator?.seed}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="switch">
          <input type="checkbox" checked={suite} onChange={(event) => setSuite(event.target.checked)} />
          Also make a screen for each system ({section?.recipe.systems.length ?? 0}), linked by their nav buttons
        </label>

        {error ? <p className="tool-error">{error}</p> : null}
        <footer className="dialog__actions">
          <button type="button" className="tool-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tool-button tool-button--primary" disabled={!picked || busy}>
            {suite ? `Create ${(section?.recipe.systems.length ?? 0) + 1} screens` : "Create and edit"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
};
