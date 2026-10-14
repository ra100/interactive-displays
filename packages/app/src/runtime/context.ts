import { createContext, useContext } from "react";

const ThemeIdContext = createContext("base");

export const ThemeIdProvider = ThemeIdContext;

export const useThemeId = (): string => useContext(ThemeIdContext);
