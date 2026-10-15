---
name: widgets
description: Add or change widgets in the catalog (packages/core/src/catalog) and their renderers. Use when creating a new widget kind, changing widget props, or touching NodeView/WidgetView rendering.
---

# Widgets

A widget is one `defineWidget()` definition in `packages/core/src/catalog/<kind>.ts`. Everything else is derived:
types (`WidgetPropsOf<'kind'>`), validation (`validateScreen`), JSON Schema (`/api/catalog`), contract tests,
the gallery, the editor's Add panel and inspector, and later the MCP tool schemas.

## Checklist

1. Write the test first in `catalog.test.ts`: defaults, limits, rejection of unknown props.
2. Create the definition:
   ```ts
   export const gauge = defineWidget({
     kind: "gauge",
     label: "Gauge",
     category: "data",
     description: "A level between a minimum and a maximum.", // what it is for, not how it looks
     props: z.strictObject({
       label: z.string().min(1).max(40),
       value: z.number().default(0),
       tone: ToneSchema.default("primary"),
     }),
     example: { label: "PLASMA FLOW", value: 72 },
   });
   ```
3. Register it in `widgets` in `catalog/index.ts` (key must equal `kind`).
4. Add `Base<Kind>.tsx` in `packages/themes/src/base/`, register in `base/renderers.ts`, style in `base.css`
   (the compiler requires a base renderer). Theme renderers (e.g. LCARS) are optional.
5. `pnpm test && pnpm typecheck`, then look at it in every slot at `/gallery`.

## Editor inspector

`describeFields` (`packages/core/src/fields/`) turns the props schema into form fields: strings become text
(multiline unless `.max()` is 120 or less), numbers keep `min`/`max`, enums become selects, `ToneSchema` becomes tone
swatches, anything else falls back to a JSON field. Steer it from the schema, never with a hand-written form:

- `.meta({ title, description })` sets the field's label and hint (`description` on the widget is for AI).
- `.meta({ "x-editor": "asset:image" })` (or `asset:video`, `asset`) on a string makes it a picker of the show's
  uploaded files, as in `catalog/image.ts`.
- Defaults decide when the inspector offers Reset.

## Rendering

- `NodeView` resolves each node for the current show state (`nodeInState` applies `when` overrides), skips
  hidden nodes and decor from other themes, and lays out stacks, grids, canvases and frames.
- Frames hand slot contents to the theme's frame renderer; widgets inside receive `slot` (`title`, `nav`,
  `toolbar`, `main`, `aside`, `status`) through context and get it as a prop.
- `WidgetView` re-validates props against the catalog and wraps each widget in an error boundary.

## Rules

- `z.strictObject` so typos in documents are errors, not silently dropped.
- Colours are `ToneSchema` roles; never accept hex in props.
- Every prop that can be missing has a default, so `example` stays small.
- Per-state changes belong in the node's `when`, not in widget props.
- Renderers receive validated props with defaults; they must not re-validate or fetch.
- Size type with container units (`cqh`, `cqw`) of the widget box and `var(--u)` (1% of the display's short side).
- Interactive widgets: at least `var(--touch)` in both directions, `touch-action: manipulation`, visible
  `:active` state.
- Text that can overflow uses ellipsis; a widget must never resize its slot.
