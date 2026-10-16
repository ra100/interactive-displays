import { useDraggable } from "@dnd-kit/core";
import { catalog, type Node, type WidgetCategory } from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import { useState } from "react";
import { AssetsPanel } from "./AssetsPanel.tsx";
import type { DragSource } from "./dragSource.ts";
import { CONTAINER_PRESETS, type ContainerPreset, newContainer, newDecor, newWidget } from "./editing.ts";
import { useInsert } from "./useInsert.ts";
import { useEditor } from "./EditorContext.ts";

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  text: "Text",
  control: "Controls",
  data: "Data",
  scan: "Scans and graphs",
  tactical: "Tactical",
  navigation: "Navigation",
  media: "Media",
  alert: "Alerts",
  meta: "Other",
};

const PaletteItem = ({
  id,
  label,
  description,
  create,
}: {
  id: string;
  label: string;
  description: string;
  create: (taken: ReadonlySet<string>) => Node;
}) => {
  const insert = useInsert();
  const source: DragSource = { kind: "new", label, create };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `new:${id}`, data: source });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="palette-item"
      data-dragging={isDragging}
      title={description}
      {...listeners}
      {...attributes}
      onClick={() => insert(create)}
    >
      <span className="palette-item__label">{label}</span>
      <span className="palette-item__description">{description}</span>
    </button>
  );
};

const Widgets = () => {
  const { assets } = useEditor();
  const firstImage = assets.find((asset) => asset.kind === "image")?.name;
  const groups = new Map<WidgetCategory, Array<(typeof catalog extends ReadonlyMap<string, infer D> ? D : never)>>();
  for (const definition of catalog.values()) groups.set(definition.category, [...(groups.get(definition.category) ?? []), definition]);

  return (
    <>
      {[...groups].map(([category, definitions]) => (
        <section key={category} className="palette-group">
          <h3 className="tool-label">{CATEGORY_LABELS[category]}</h3>
          {definitions.map((definition) => (
            <PaletteItem
              key={definition.kind}
              id={definition.kind}
              label={definition.label}
              description={definition.description}
              create={(taken) =>
                // A new image starts with the first uploaded picture rather than the catalog's sample file.
                definition.kind === "image" && firstImage
                  ? newWidget("image", taken, { asset: firstImage, fit: "contain" })
                  : newWidget(definition.kind, taken)
              }
            />
          ))}
        </section>
      ))}
    </>
  );
};

const LAYOUT_HELP: Record<ContainerPreset, string> = {
  column: "Items one below the other.",
  row: "Items side by side.",
  grid: "Rows and columns; items take cells.",
  canvas: "Free placement, for art and schematics.",
  panel: "A titled section with its own sweep or bracket, to divide a screen.",
};

const Layouts = () => (
  <section className="palette-group">
    {(Object.keys(CONTAINER_PRESETS) as ContainerPreset[]).map((preset) => (
      <PaletteItem
        key={preset}
        id={`layout-${preset}`}
        label={CONTAINER_PRESETS[preset].label}
        description={LAYOUT_HELP[preset]}
        create={(taken) => newContainer(preset, taken)}
      />
    ))}
  </section>
);

const Decor = () => {
  const { preview } = useEditor();
  const theme = getThemeManifest(preview.themeId);
  if (theme.decor.length === 0) {
    return <p className="panel-empty">{theme.name} has no decor. Pick another theme in the preview to add its ornaments.</p>;
  }
  return (
    <section className="palette-group">
      <p className="panel-note">Ornaments of {theme.name}; other themes leave them out.</p>
      {theme.decor.map((definition) => (
        <PaletteItem
          key={definition.kind}
          id={definition.kind}
          label={definition.label}
          description={definition.description}
          create={(taken) => newDecor(definition, taken)}
        />
      ))}
    </section>
  );
};

const TABS = { widgets: "Widgets", layouts: "Layouts", decor: "Decor", assets: "Assets" } as const;

type Tab = keyof typeof TABS;

// Everything that can be added to a screen. Click to add after the selection, or drag onto the preview or the outline.
export const AddPanel = () => {
  const [tab, setTab] = useState<Tab>("widgets");
  return (
    <section className="editor-panel add-panel" aria-label="Add">
      <div className="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === each}
            onClick={() => setTab(each)}
          >
            {TABS[each]}
          </button>
        ))}
      </div>
      <div className="editor-panel__body" role="tabpanel" aria-label={TABS[tab]}>
        {tab === "widgets" ? <Widgets /> : null}
        {tab === "layouts" ? <Layouts /> : null}
        {tab === "decor" ? <Decor /> : null}
        {tab === "assets" ? <AssetsPanel /> : null}
      </div>
    </section>
  );
};
