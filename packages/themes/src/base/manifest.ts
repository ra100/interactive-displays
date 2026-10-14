import { defineTheme } from "@interactive-displays/core";

// Neutral fallback theme: renders every widget and frame, and keeps the model honest about not depending
// on one look. It doubles as the editor's wireframe view.
export const base = defineTheme({
  id: "base",
  name: "Base",
  description: "Neutral, readable wireframe look. Every other theme falls back to it.",
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
  effects: {
    warning: { tokens: { palette: { primary: "#f2c94c" } } },
    alert: { tokens: { palette: { primary: "#ff5c5c", secondary: "#ff9c9c" }, background: "#1a0b0d" } },
    damaged: { tokens: { palette: { primary: "#6b7480", secondary: "#59616b", accent: "#7a6a55" } } },
  },
  archetypes: ["sidebar", "header-main", "dashboard"],
});
