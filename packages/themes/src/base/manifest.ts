import { defineTheme } from "@interactive-displays/core";

// Neutral fallback theme: renders every widget and keeps the model honest about not depending on one look.
export const base = defineTheme({
  id: "base",
  name: "Base",
  tokens: {
    palette: {
      primary: "#5b9dff",
      secondary: "#a7b6c8",
      accent: "#ffb347",
      info: "#6cc6ff",
      neutral: "#7a8794",
      success: "#4caf7d",
      warning: "#f2c94c",
      danger: "#ff5c5c",
    },
    background: "#0d1117",
    foreground: "#e6e9ee",
    font: {
      display: "system-ui, 'Segoe UI', Roboto, sans-serif",
      body: "system-ui, 'Segoe UI', Roboto, sans-serif",
    },
    radius: "small",
  },
});
