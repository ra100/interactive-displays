import { defineTheme } from "@interactive-displays/core";
import { brackets, log, radar, rule } from "./decor.ts";

// A phosphor CRT terminal, the ship computer of 1970s and 80s film: one bright colour on near black, monospace
// type, boxed panels, scanlines and glow. Self-hosted VT323 and Share Tech Mono.
export const crt = defineTheme({
  id: "crt",
  name: "Terminal",
  description: "Phosphor CRT terminal: monospace type, boxed panels, scanlines and glow.",
  tokens: {
    // Shades of one phosphor, so a screen reads as monochrome; warning and danger stay distinct.
    palette: {
      primary: "#4dff7a",
      secondary: "#2fbf5a",
      accent: "#b6ff6a",
      info: "#5effd0",
      neutral: "#1f8a42",
      success: "#4dff7a",
      warning: "#ffd23f",
      danger: "#ff4f3a",
    },
    background: "#020a04",
    foreground: "#7dff9b",
    font: {
      display: "'VT323', 'Share Tech Mono', ui-monospace, monospace",
      body: "'Share Tech Mono', 'VT323', ui-monospace, monospace",
    },
    radius: "none",
  },
  variants: {
    amber: {
      name: "Amber phosphor",
      tokens: {
        palette: { primary: "#ffb000", secondary: "#c88400", accent: "#ffd27a", info: "#ffc94d", neutral: "#8f5f00", success: "#ffb000" },
        background: "#0c0700",
        foreground: "#ffc04d",
      },
    },
    ice: {
      name: "Cold white",
      tokens: {
        palette: { primary: "#d8f3ff", secondary: "#9cc4d6", accent: "#ffffff", info: "#8fd9ff", neutral: "#5d7f8f", success: "#b8ffd8" },
        background: "#03070a",
        foreground: "#d8f3ff",
      },
    },
  },
  effects: {
    warning: { tokens: { palette: { primary: "#ffd23f", secondary: "#c9a42e", accent: "#ffe58a" }, foreground: "#ffe58a" } },
    // The whole tube turns red, as if the phosphor itself were alarmed.
    alert: {
      tokens: {
        palette: { primary: "#ff4f3a", secondary: "#c23a2b", accent: "#ff8a6a", info: "#ff6f5a", neutral: "#8a2a1f", success: "#ff8a6a" },
        background: "#0d0201",
        foreground: "#ff8a6a",
      },
    },
    damaged: {
      tokens: {
        palette: { primary: "#3f9a55", secondary: "#2c6e3c", accent: "#5f8a3f", info: "#3f8a7a", neutral: "#1f4f2c" },
        foreground: "#4f9a62",
      },
    },
  },
  archetypes: ["sidebar", "header-main", "dashboard"],
  // Mostly the bright phosphor; panels alternate with a dimmer shade rather than new colours.
  tones: {
    nav: ["primary"],
    panels: ["primary", "info", "secondary", "accent"],
  },
  // Square-wave beeps, as from a terminal speaker.
  sounds: {
    press: { steps: [{ freq: 1046, ms: 30, wave: "square", gain: 0.05 }] },
    confirm: {
      steps: [
        { freq: 784, ms: 60, wave: "square", gain: 0.05 },
        { freq: 1046, ms: 90, wave: "square", gain: 0.05 },
      ],
    },
    warning: {
      steps: [
        { freq: 523, ms: 180, wave: "square", gain: 0.05 },
        { freq: 523, ms: 120, gain: 0 },
      ],
      repeat: 3,
    },
    alert: {
      steps: [
        { freq: 1568, ms: 120, wave: "square", gain: 0.05 },
        { freq: 1568, ms: 80, gain: 0 },
        { freq: 1568, ms: 120, wave: "square", gain: 0.05 },
        { freq: 1568, ms: 380, gain: 0 },
      ],
      repeat: 4,
    },
    // A teletype chatter for computers that print their answers.
    teletype: {
      steps: [
        { freq: 2200, ms: 12, wave: "square", gain: 0.03 },
        { freq: 2200, ms: 30, gain: 0 },
      ],
      repeat: 8,
    },
  },
  decor: [rule, brackets, radar, log],
  // LCARS ornament re-skinned: bars and elbows become rules, brackets become corner brackets; end caps go.
  decorStandIns: {
    "lcars.bar": { kind: "crt.rule", props: { style: "double" } },
    "lcars.elbow": { kind: "crt.rule", props: { style: "single" } },
    "lcars.bracket": { kind: "crt.brackets" },
  },
});
