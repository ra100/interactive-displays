import type { SlotName } from "@interactive-displays/core";
import { createContext, useContext } from "react";

// What every node needs from the screen around it, without threading props through each layout.
const ThemeIdContext = createContext("base");
const ShowStateContext = createContext("normal");
// The frame slot a node sits in; nested containers inherit it, so a button inside a nav group
// still draws as a nav button.
const SlotContext = createContext<SlotName | undefined>(undefined);

// In the editor's preview, frames also draw their empty slots, so a part can be dropped into them.
const EditingContext = createContext(false);

export const EditingProvider = EditingContext;
export const useEditing = (): boolean => useContext(EditingContext);

export const ThemeIdProvider = ThemeIdContext;
export const ShowStateProvider = ShowStateContext;
export const SlotProvider = SlotContext;

export const useThemeId = (): string => useContext(ThemeIdContext);
export const useShowState = (): string => useContext(ShowStateContext);
export const useSlot = (): SlotName | undefined => useContext(SlotContext);
