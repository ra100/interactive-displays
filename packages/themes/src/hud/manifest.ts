import { defineTheme } from "@interactive-displays/core";
import { arcs, corners, reticle, scale } from "./decor.ts";

// A translucent heads-up display, as in The Expanse or a pilot's visor: thin cyan lines over glassy panels, angled
// corners, arcs and rings, light condensed type. Self-hosted Rajdhani and Share Tech Mono.
export const hud = defineTheme({
  id: "hud",
  name: "Holo HUD",
  description: "Translucent heads-up display: thin lines, glassy panels, angled corners, rings and arcs.",
  tokens: {
    palette: {
      primary: "#3fd8ff",
      secondary: "#6f9dff",
      accent: "#ffb547",
      info: "#64f0e0",
      neutral: "#6a8aa6",
      success: "#4dffa6",
      warning: "#ffc94d",
      danger: "#ff4d6a",
    },
    background: "#02070d",
    foreground: "#d4f4ff",
    font: {
      display: "'Rajdhani', 'Share Tech Mono', system-ui, sans-serif",
      body: "'Rajdhani', system-ui, sans-serif",
    },
    radius: "none",
  },
  variants: {
    amber: {
      name: "Amber visor",
      tokens: {
        palette: { primary: "#ffb547", secondary: "#ff8f3f", accent: "#3fd8ff", info: "#ffd27a", neutral: "#9a7a52" },
        background: "#0a0602",
        foreground: "#ffe7c2",
      },
    },
    stealth: {
      name: "Stealth white",
      tokens: {
        palette: { primary: "#e8f4ff", secondary: "#a8bccc", accent: "#3fd8ff", info: "#c8e6ff", neutral: "#6f7f8c" },
        background: "#040506",
        foreground: "#f2f8ff",
      },
    },
  },
  effects: {
    warning: { tokens: { palette: { primary: "#ffc94d", secondary: "#ffa94d", accent: "#3fd8ff" } } },
    // Every line turns red; the CSS pulses the panels' glow.
    alert: {
      tokens: {
        palette: { primary: "#ff4d6a", secondary: "#ff7a5c", accent: "#ffc94d", info: "#ff8fa0", neutral: "#9a4a58" },
        background: "#0d0205",
        foreground: "#ffd6dc",
      },
    },
    damaged: {
      tokens: {
        palette: { primary: "#2f9ab8", secondary: "#4f6fa8", info: "#4aa89c", neutral: "#4a5f72" },
        foreground: "#9ab8c8",
      },
    },
  },
  archetypes: ["sidebar", "header-main", "dashboard", "split", "console"],
  tones: {
    nav: ["primary", "secondary"],
    panels: ["primary", "info", "secondary", "accent"],
  },
  // Soft sine blips and sweeps.
  sounds: {
    press: { steps: [{ freq: 1760, ms: 40, wave: "sine", gain: 0.06 }] },
    confirm: {
      steps: [
        { freq: 1320, ms: 50, wave: "sine", gain: 0.06 },
        { freq: 1980, ms: 80, wave: "sine", gain: 0.06 },
      ],
    },
    warning: {
      steps: [
        { freq: 660, ms: 200, wave: "triangle", gain: 0.06 },
        { freq: 660, ms: 160, gain: 0 },
      ],
      repeat: 3,
    },
    alert: {
      steps: [
        { freq: 880, ms: 160, wave: "sawtooth", gain: 0.05 },
        { freq: 1320, ms: 160, wave: "sawtooth", gain: 0.05 },
        { freq: 880, ms: 240, gain: 0 },
      ],
      repeat: 4,
    },
    // A rising sweep for a lock-on or scan.
    lock: {
      steps: [
        { freq: 990, ms: 60, wave: "sine", gain: 0.05 },
        { freq: 1320, ms: 60, wave: "sine", gain: 0.05 },
        { freq: 1760, ms: 60, wave: "sine", gain: 0.05 },
        { freq: 2640, ms: 140, wave: "sine", gain: 0.05 },
      ],
    },
  },
  decor: [reticle, corners, scale, arcs],
  // Other themes' ornament re-skinned: rules and bars become scales, brackets become corner frames, a radar a reticle.
  decorStandIns: {
    "lcars.bar": { kind: "hud.scale" },
    "lcars.elbow": { kind: "hud.scale" },
    "lcars.bracket": { kind: "hud.corners" },
    "crt.rule": { kind: "hud.scale" },
    "crt.brackets": { kind: "hud.corners" },
    "crt.radar": { kind: "hud.reticle" },
    "lcars.segments": { kind: "hud.scale" },
    "lcars.scan": { kind: "hud.reticle" },
  },
});
