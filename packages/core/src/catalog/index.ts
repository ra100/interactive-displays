import { button } from "./button.ts";
import { createCatalog } from "./defineWidget.ts";
import { text } from "./text.ts";
import { title } from "./title.ts";

export { button, text, title };

// Adding a widget: one definition file here, its test, and an entry in this list.
export const catalog = createCatalog([title, text, button]);
