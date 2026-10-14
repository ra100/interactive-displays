import { type BaseThemeRenderers, defineRenderers } from "../contract.ts";
import { BaseButton } from "./BaseButton.tsx";
import { BaseText } from "./BaseText.tsx";
import { BaseTitle } from "./BaseTitle.tsx";
import "./base.css";

export const baseRenderers: BaseThemeRenderers = defineRenderers({
  id: "base",
  widgets: {
    title: BaseTitle,
    text: BaseText,
    button: BaseButton,
  },
});
