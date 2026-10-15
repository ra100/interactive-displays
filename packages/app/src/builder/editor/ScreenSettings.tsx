import { type Field, type Profile, ProfileSchema, slugify } from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import { useEditor } from "./EditorContext.ts";
import { FieldInput } from "./FieldInput.tsx";

const field = (key: string, label: string, extra: Partial<Field> & Pick<Field, "type">): Field =>
  ({ key, label, required: false, ...extra }) as Field;

const NAME = field("name", "Name", { type: "text", multiline: false, maxLength: 120, required: true });
const SECTION = field("section", "Section", { type: "text", multiline: false, maxLength: 64, description: "The ship section, e.g. engineering" });
const TAGS = field("tags", "Tags", { type: "text", multiline: false, description: "Separated by commas" });
const ASPECT = field("aspect", "Aspect", { type: "enum", options: [...ProfileSchema.shape.aspect.unwrap().options], required: true });
const FIT = field("fit", "Fit", {
  type: "enum",
  options: [...ProfileSchema.shape.fit.unwrap().options],
  required: true,
  description: "Fluid re-flows to each display; contain keeps the aspect and letterboxes",
});

// Name, section, tags and the display profile of the screen being edited.
export const ScreenSettings = () => {
  const { screen, apply, preview } = useEditor();
  const palette = getThemeManifest(preview.themeId).tokens.palette;
  const meta = (patch: Record<string, unknown>) => apply([{ op: "meta", ...patch }]);
  const profile = (patch: Partial<Profile>) => meta({ profile: { ...screen.profile, ...patch } });
  const common = { palette, overridden: false, onReset: undefined };

  return (
    <div className="inspector">
      <header className="inspector__header">
        <h2 className="inspector__title">{screen.name}</h2>
        <p className="inspector__id">{screen.id}</p>
      </header>
      <section className="inspector__section">
        <FieldInput {...common} field={NAME} value={screen.name} onChange={(value) => typeof value === "string" && value.trim() && meta({ name: value.trim() })} />
        <FieldInput
          {...common}
          field={SECTION}
          value={screen.section}
          onChange={(value) => meta({ section: typeof value === "string" && slugify(value) ? slugify(value) : null })}
        />
        <FieldInput
          {...common}
          field={TAGS}
          value={screen.tags.join(", ")}
          onChange={(value) =>
            meta({
              tags: [...new Set((typeof value === "string" ? value : "").split(",").map((tag) => tag.trim()).filter(Boolean))],
            })
          }
        />
        <FieldInput {...common} field={ASPECT} value={screen.profile.aspect} onChange={(value) => profile({ aspect: ProfileSchema.shape.aspect.parse(value) })} />
        <FieldInput {...common} field={FIT} value={screen.profile.fit} onChange={(value) => profile({ fit: ProfileSchema.shape.fit.parse(value) })} />
      </section>
    </div>
  );
};
