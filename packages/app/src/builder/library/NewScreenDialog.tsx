import { IdSchema, type Profile, ProfileSchema, type Show, slugify, uniqueId } from "@interactive-displays/core";
import { useId, useMemo, useState } from "react";
import { Dialog } from "../../tools/Dialog.tsx";
import { ScreenThumbnail } from "../../tools/ScreenThumbnail.tsx";
import { buildScreen, type NewScreen, TEMPLATE_IDS, TEMPLATES, type TemplateId } from "./templates.ts";

const ASPECTS = ProfileSchema.shape.aspect.unwrap().options;

// Name, id, section, aspect and a starting layout; each template shows as a live thumbnail in the show's theme.
export const NewScreenDialog = ({
  theme,
  takenIds,
  sections,
  onCreate,
  onClose,
}: {
  theme: Show["theme"];
  takenIds: ReadonlySet<string>;
  sections: string[];
  onCreate: (screen: NewScreen) => Promise<string | undefined>;
  onClose: () => void;
}) => {
  const [name, setName] = useState("");
  const [customId, setCustomId] = useState<string | undefined>(undefined);
  const [section, setSection] = useState("");
  const [template, setTemplate] = useState<TemplateId>("sidebar");
  const [aspect, setAspect] = useState<Profile["aspect"]>("16:9");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  const id = customId ?? (name.trim() ? uniqueId(slugify(name), takenIds) : "");
  const idProblem = (() => {
    if (!id) return undefined;
    if (!IdSchema.safeParse(id).success) return "Use lowercase letters, digits, '-' or '_'";
    if (takenIds.has(id)) return "A screen with this id exists";
    return undefined;
  })();
  const sectionId = slugify(section);

  const previews = useMemo(
    () =>
      Object.fromEntries(
        TEMPLATE_IDS.map((each) => [each, buildScreen({ template: each, id: "preview", name: name.trim() || "New screen", aspect })]),
      ),
    [name, aspect],
  );

  const submit = async () => {
    if (!name.trim() || !id || idProblem) return;
    setBusy(true);
    const problem = await onCreate({ template, id, name: name.trim(), section: sectionId || undefined, aspect });
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <Dialog title="New screen" onClose={onClose} wide>
      <form
        className="new-screen"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="new-screen__fields">
          <label className="tool-field">
            <span className="tool-label">Name</span>
            <input className="tool-input" value={name} maxLength={120} required onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="tool-field">
            <label className="tool-label" htmlFor={`${formId}-id`}>
              Id
            </label>
            <input
              id={`${formId}-id`}
              className="tool-input"
              value={id}
              maxLength={64}
              aria-invalid={idProblem ? true : undefined}
              aria-describedby={`${formId}-id-hint`}
              onChange={(event) => setCustomId(event.target.value)}
            />
            <span id={`${formId}-id-hint`} className="tool-field__hint">
              {idProblem ?? "Part of the address; it cannot change later."}
            </span>
          </div>
          <label className="tool-field">
            <span className="tool-label">Section</span>
            <input className="tool-input" list="known-sections" value={section} onChange={(event) => setSection(event.target.value)} />
            <datalist id="known-sections">
              {sections.map((each) => (
                <option key={each} value={each} />
              ))}
            </datalist>
          </label>
          <label className="tool-field">
            <span className="tool-label">Aspect</span>
            <select className="tool-select" value={aspect} onChange={(event) => setAspect(event.target.value as Profile["aspect"])}>
              {ASPECTS.map((each) => (
                <option key={each}>{each}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="new-screen__templates">
          <legend className="tool-label">Start from</legend>
          {TEMPLATE_IDS.map((each) => (
            <label key={each} className="template-card" data-selected={template === each}>
              <input type="radio" name="template" value={each} checked={template === each} onChange={() => setTemplate(each)} />
              {previews[each] ? <ScreenThumbnail screen={previews[each]} theme={theme} /> : null}
              <span className="template-card__label">{TEMPLATES[each].label}</span>
              <span className="template-card__description">{TEMPLATES[each].description}</span>
            </label>
          ))}
        </fieldset>

        {error ? <p className="tool-error">{error}</p> : null}
        <footer className="dialog__actions">
          <button type="button" className="tool-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tool-button tool-button--primary" disabled={!name.trim() || !id || Boolean(idProblem) || busy}>
            Create and edit
          </button>
        </footer>
      </form>
    </Dialog>
  );
};
