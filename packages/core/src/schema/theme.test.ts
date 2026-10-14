import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineDecor } from "../catalog/defineDecor.ts";
import { defineTheme, resolveTokens, themeCssVariables } from "./theme.ts";

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

describe("resolveTokens", () => {
  const theme = defineTheme({
    ...manifest,
    variants: { blue: { name: "Blue", tokens: { palette: { primary: "#0000ff" } } } },
    effects: { alert: { tokens: { palette: { primary: "#ff0000" }, background: "#110000" } } },
  });

  it("returns the base tokens without variant or effect", () => {
    expect(resolveTokens(theme)).toEqual(theme.tokens);
  });

  it("applies the variant, then the effect", () => {
    expect(resolveTokens(theme, "blue").palette.primary).toBe("#0000ff");
    const alert = resolveTokens(theme, "blue", "alert");
    expect(alert.palette.primary).toBe("#ff0000");
    expect(alert.background).toBe("#110000");
    expect(alert.palette.secondary).toBe("#222222");
  });

  it("ignores unknown variants and effects without overrides", () => {
    expect(resolveTokens(theme, "missing", "damaged")).toEqual(theme.tokens);
  });
});

describe("theme decor", () => {
  const decor = (kind: string) =>
    defineDecor({ kind, label: "D", description: "D", props: z.strictObject({}), example: {} });

  it("keeps decor definitions on the manifest", () => {
    expect(defineTheme({ ...manifest, decor: [decor("test.bar")] }).decor).toHaveLength(1);
  });

  it("requires decor kinds to be prefixed with the theme id", () => {
    expect(() => defineTheme({ ...manifest, decor: [decor("other.bar")] })).toThrow(/test\.<name>/);
  });
});
