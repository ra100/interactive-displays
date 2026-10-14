import { button } from "./button.ts";
import { createCatalog, type WidgetProps } from "./defineWidget.ts";
import { text } from "./text.ts";
import { title } from "./title.ts";

// Adding a widget: one definition file here, its test, and an entry in this object.
export const widgets = { title, text, button } as const;

export type WidgetKind = keyof typeof widgets;
export type WidgetPropsOf<Kind extends WidgetKind> = WidgetProps<(typeof widgets)[Kind]>;

export const catalog = createCatalog(Object.values(widgets));
