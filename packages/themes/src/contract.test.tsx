import { catalog } from "@interactive-displays/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { themeManifests } from "./manifest.ts";
import { resolveWidgetRenderer } from "./react.ts";

const cases = [...themeManifests.keys()].flatMap((themeId) =>
  [...catalog.values()].map((definition) => ({ themeId, definition })),
);

// Every widget renders its example in every theme, through the theme's own renderer or the base fallback.
describe("theme contract", () => {
  it.each(cases)("$themeId renders $definition.kind", ({ themeId, definition }) => {
    const Renderer = resolveWidgetRenderer(themeId, definition.kind);
    expect(Renderer).toBeDefined();
    if (!Renderer) return;

    const props = definition.props.parse(definition.example);
    const { container } = render(<Renderer props={props} nodeId="sample" />);
    expect(container.firstElementChild).not.toBeNull();
  });

  it("falls back to base renderers for an unknown theme", () => {
    expect(resolveWidgetRenderer("unknown-theme", "button")).toBe(resolveWidgetRenderer("base", "button"));
  });

  it("returns undefined for an unknown widget kind", () => {
    expect(resolveWidgetRenderer("base", "warp-core")).toBeUndefined();
  });
});

describe("base renderers", () => {
  it("renders a pressable button with its tone", () => {
    const Button = resolveWidgetRenderer("base", "button");
    if (!Button) throw new Error("missing button renderer");
    render(<Button props={{ label: "ENGAGE", tone: "danger" }} nodeId="b" />);

    const button = screen.getByRole("button", { name: "ENGAGE" });
    expect(button).toHaveAttribute("data-tone", "danger");
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders a title as a heading with its code", () => {
    const Title = resolveWidgetRenderer("base", "title");
    if (!Title) throw new Error("missing title renderer");
    render(<Title props={{ text: "BRIDGE", code: "01-0001", tone: "primary" }} nodeId="t" />);

    expect(screen.getByRole("heading", { name: "BRIDGE" })).toBeInTheDocument();
    expect(screen.getByText("01-0001")).toBeInTheDocument();
  });

  it("renders text with its size", () => {
    const Text = resolveWidgetRenderer("base", "text");
    if (!Text) throw new Error("missing text renderer");
    render(<Text props={{ text: "Nominal", size: "large", tone: "secondary" }} nodeId="x" />);

    expect(screen.getByText("Nominal")).toHaveAttribute("data-size", "large");
  });
});
