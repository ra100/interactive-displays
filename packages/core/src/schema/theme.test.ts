import { describe, expect, it } from "vitest";
import { defineTheme, themeCssVariables } from "./theme.ts";

const palette = {
  primary: "#111111",
  secondary: "#222222",
  accent: "#333333",
  info: "#444444",
  neutral: "#555555",
  success: "#666666",
  warning: "#777777",
  danger: "#888888",
};

const manifest = {
  id: "test",
  name: "Test",
  tokens: {
    palette,
    background: "#000000",
    foreground: "#ffffff",
    font: { display: "Display, sans-serif", body: "Body, sans-serif" },
    radius: "pill" as const,
  },
};

describe("defineTheme", () => {
  it("returns a validated manifest", () => {
    expect(defineTheme(manifest).id).toBe("test");
  });

  it("throws when a tone has no colour", () => {
    const { danger: _danger, ...partial } = palette;
    // @ts-expect-error a missing tone is a type error too
    expect(() => defineTheme({ ...manifest, tokens: { ...manifest.tokens, palette: partial } })).toThrow();
  });

  it("throws on a colour that is not #rrggbb", () => {
    expect(() =>
      defineTheme({ ...manifest, tokens: { ...manifest.tokens, background: "black" } }),
    ).toThrow();
  });
});

describe("themeCssVariables", () => {
  it("maps tokens to CSS custom properties", () => {
    const vars = themeCssVariables(defineTheme(manifest).tokens);

    expect(vars["--tone-primary"]).toBe("#111111");
    expect(vars["--tone-danger"]).toBe("#888888");
    expect(vars["--theme-bg"]).toBe("#000000");
    expect(vars["--theme-fg"]).toBe("#ffffff");
    expect(vars["--font-display"]).toBe("Display, sans-serif");
    expect(vars["--radius"]).toBe("999px");
  });
});
