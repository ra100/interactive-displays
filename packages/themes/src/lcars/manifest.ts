import { defineTheme } from "@interactive-displays/core";
import { bar, bracket, cap, elbow } from "./decor.ts";

// Star Trek: The Next Generation style LCARS. Self-hosted Antonio for the condensed display type.
export const lcars = defineTheme({
  id: "lcars",
  name: "LCARS",
  description: "Library Computer Access/Retrieval System: elbows, pill buttons and condensed type on black.",
  tokens: {
    palette: {
      primary: "#ff9900",
      secondary: "#ffcc99",
      accent: "#cc99cc",
      info: "#9999ff",
      neutral: "#cc9966",
      success: "#99cc66",
      warning: "#ffcc33",
      danger: "#ff5544",
    },
    background: "#000000",
    foreground: "#ffcc99",
    font: {
      display: "'Antonio', 'Arial Narrow', 'Roboto Condensed', sans-serif",
      body: "'Antonio', 'Arial Narrow', 'Roboto Condensed', sans-serif",
    },
    radius: "pill",
  },
  variants: {
    nemesis: {
      name: "Nemesis blue",
      tokens: {
        palette: { primary: "#5c8fd6", secondary: "#9fc3f2", accent: "#3a64a8", info: "#b8d4f5", neutral: "#6f87a6" },
        foreground: "#9fc3f2",
      },
    },
    picard: {
      name: "Picard grey",
      tokens: {
        palette: { primary: "#97a1b3", secondary: "#c3cad6", accent: "#e8735a", info: "#58b4e3", neutral: "#5c6678" },
        foreground: "#c3cad6",
      },
    },
  },
  effects: {
    warning: { tokens: { palette: { primary: "#ffcc33", secondary: "#ffe08a" } } },
    alert: {
      tokens: {
        palette: { primary: "#ff3333", secondary: "#ff7777", accent: "#cc3344", info: "#ff9999", neutral: "#aa3333" },
        foreground: "#ff9999",
      },
    },
    damaged: {
      tokens: {
        palette: {
          primary: "#7a6a58",
          secondary: "#8f8170",
          accent: "#6e5f6e",
          info: "#5f6a7a",
          neutral: "#5a4c3c",
          warning: "#8c7a3c",
        },
        foreground: "#8f8170",
      },
    },
  },
  archetypes: ["sidebar", "header-main", "dashboard"],
  // Flush blocks of colour: the nav column runs through the whole palette, panels never repeat their neighbour.
  tones: {
    nav: ["primary", "secondary", "accent", "info", "neutral"],
    panels: ["primary", "info", "accent", "secondary", "neutral"],
  },
  // Made-up tones in the spirit of the show, synthesised in the browser.
  sounds: {
    press: {
      steps: [
        { freq: 1400, ms: 40, gain: 0.14 },
        { freq: 1900, ms: 55, gain: 0.12 },
      ],
    },
    hail: {
      steps: [
        { freq: 1300, ms: 90, gain: 0.14 },
        { freq: 1650, ms: 90, gain: 0.14 },
        { freq: 2000, ms: 140, gain: 0.12 },
      ],
    },
    // The red-alert klaxon, under the shared "alert" name so a show sounds right in every theme.
    alert: {
      steps: [
        { freq: 480, to: 920, ms: 650, wave: "sawtooth", gain: 0.08 },
        { freq: 920, ms: 120, gain: 0 },
      ],
      repeat: 3,
    },
  },
  decor: [elbow, bar, cap, bracket],
  // Terminal ornament re-skinned: rules become capped bars, corner brackets a bracket. Radar and log go.
  decorStandIns: {
    "crt.rule": { kind: "lcars.bar", props: { caps: "both" } },
    "crt.brackets": { kind: "lcars.bracket" },
  },
});
