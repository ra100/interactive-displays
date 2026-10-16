import { ARCHETYPE_IDS, archetypeSlots, catalog, SLOTS } from "@interactive-displays/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { decorCatalog, themeManifests } from "./manifest.ts";
import { resolveDecor, resolveDecorRenderer, resolveFrameRenderer, resolveWidgetRenderer } from "./react.ts";

const themeIds = [...themeManifests.keys()];
const slots = [undefined, ...SLOTS];

const widgetCases = themeIds.flatMap((themeId) =>
  [...catalog.values()].flatMap((definition) => slots.map((slot) => ({ themeId, definition, slot }))),
);

const frameCases = themeIds.flatMap((themeId) => ARCHETYPE_IDS.map((archetype) => ({ themeId, archetype })));

// Every widget renders its example in every theme and every slot, through the theme's own renderer or the
// base fallback. A theme that breaks a widget in one slot fails here, not on set.
describe("theme contract: widgets", () => {
  it.each(widgetCases)("$themeId renders $definition.kind in slot $slot", ({ themeId, definition, slot }) => {
    const Renderer = resolveWidgetRenderer(themeId, definition.kind);
    expect(Renderer).toBeDefined();
    if (!Renderer) return;

    const props = definition.props.parse(definition.example);
    const { container } = render(
      slot ? <Renderer props={props} nodeId="sample" slot={slot} /> : <Renderer props={props} nodeId="sample" />,
    );
    expect(container.firstElementChild).not.toBeNull();
  });

  it("falls back to base renderers for an unknown theme", () => {
    expect(resolveWidgetRenderer("unknown-theme", "button")).toBe(resolveWidgetRenderer("base", "button"));
  });

  it("returns undefined for an unknown widget kind", () => {
    expect(resolveWidgetRenderer("base", "warp-core")).toBeUndefined();
  });
});

// Every archetype has a frame in every theme, and the frame places every slot the archetype declares.
describe("theme contract: frames", () => {
  it.each(frameCases)("$themeId frames $archetype with all its slots", ({ themeId, archetype }) => {
    const Frame = resolveFrameRenderer(themeId, archetype);
    expect(Frame).toBeDefined();
    if (!Frame) return;

    const names = archetypeSlots(archetype);
    const content = Object.fromEntries(names.map((name) => [name, <span key={name}>{`slot:${name}`}</span>]));
    render(<Frame archetype={archetype} nodeId="frame" slots={content} />);

    for (const name of names) expect(screen.getByText(`slot:${name}`)).toBeInTheDocument();
  });

  it("falls back to the base frame for an unknown theme", () => {
    expect(resolveFrameRenderer("unknown-theme", "sidebar")).toBe(resolveFrameRenderer("base", "sidebar"));
  });

  it("renders a frame with empty slots", () => {
    const Frame = resolveFrameRenderer("lcars", "dashboard");
    if (!Frame) throw new Error("missing dashboard frame");
    const { container } = render(<Frame archetype="dashboard" nodeId="frame" slots={{}} />);
    expect(container.querySelector(".lcars-frame--dashboard")).not.toBeNull();
  });
});

describe("theme contract: decor", () => {
  it.each([...decorCatalog.values()])("renders $kind in its own theme", (definition) => {
    const themeId = definition.kind.split(".")[0] ?? "";
    const Decor = resolveDecorRenderer(themeId, definition.kind);
    expect(Decor).toBeDefined();
    if (!Decor) return;

    const props = definition.props.parse(definition.example);
    const { container } = render(<Decor props={props} nodeId="decor" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("hides decor in every other theme", () => {
    expect(resolveDecorRenderer("base", "lcars.elbow")).toBeUndefined();
    expect(resolveDecorRenderer("unknown-theme", "lcars.elbow")).toBeUndefined();
  });

  it("returns undefined for unknown decor in its own theme", () => {
    expect(resolveDecorRenderer("lcars", "lcars.warp-core")).toBeUndefined();
  });

  it("draws another theme's piece with the theme's stand-in, keeping its tone", () => {
    const standIn = resolveDecor("crt", "lcars.bar", { caps: "right", tone: "danger" });
    expect(standIn?.kind).toBe("crt.rule");
    expect(standIn?.props).toEqual({ style: "double", tone: "danger" });
    expect(resolveDecor("lcars", "crt.rule", { label: "SYS" })?.props).toEqual({ caps: "both" });
  });

  it("hides another theme's piece that has no stand-in", () => {
    expect(resolveDecor("crt", "lcars.cap", {})).toBeUndefined();
    expect(resolveDecor("lcars", "crt.log", {})).toBeUndefined();
    expect(resolveDecor("base", "lcars.bar", {})).toBeUndefined();
  });

  it("gives every stand-in props its decor accepts", () => {
    for (const [themeId, theme] of themeManifests)
      for (const [from, standIn] of Object.entries(theme.decorStandIns)) {
        expect(decorCatalog.has(from), `${themeId}: ${from}`).toBe(true);
        const shown = resolveDecor(themeId, from, decorCatalog.get(from)?.example);
        expect(shown && decorCatalog.get(standIn.kind)?.props.safeParse(shown.props).success).toBe(true);
      }
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

  it("renders an image from the show's media", () => {
    const Image = resolveWidgetRenderer("base", "image");
    if (!Image) throw new Error("missing image renderer");
    render(<Image props={{ asset: "warp-core.png", fit: "cover", alt: "Warp core" }} nodeId="i" />);
    const image = screen.getByRole("img", { name: "Warp core" });
    expect(image.getAttribute("src")).toBe("/media/warp-core.png");
    expect(image.dataset["fit"]).toBe("cover");
  });

  it("places each slot in its grid area", () => {
    const Frame = resolveFrameRenderer("base", "sidebar");
    if (!Frame) throw new Error("missing sidebar frame");
    render(<Frame archetype="sidebar" nodeId="f" slots={{ nav: <span>NAV</span> }} />);

    expect(screen.getByText("NAV").parentElement).toHaveAttribute("data-slot", "nav");
  });
});

describe("lcars renderers", () => {
  it("draws a button as a numbered block in nav and a pill elsewhere", () => {
    const Button = resolveWidgetRenderer("lcars", "button");
    if (!Button) throw new Error("missing button renderer");
    const props = { label: "WARP", tone: "primary" } as const;

    const { rerender } = render(<Button props={props} nodeId="warp" slot="nav" />);
    const block = screen.getByRole("button", { name: /WARP/ });
    expect(block).toHaveAttribute("data-shape", "block");
    expect(block.querySelector(".lcars-button__code")?.textContent).toMatch(/^\d{2}-\d{4}$/);

    rerender(<Button props={props} nodeId="warp" slot="toolbar" />);
    expect(screen.getByRole("button", { name: "WARP" })).toHaveAttribute("data-shape", "pill");
  });

  it("draws a header in the title slot and a section heading elsewhere", () => {
    const Title = resolveWidgetRenderer("lcars", "title");
    if (!Title) throw new Error("missing title renderer");
    const props = { text: "ENGINEERING", tone: "primary" } as const;

    const { rerender } = render(<Title props={props} nodeId="t" slot="title" />);
    expect(screen.getByRole("heading", { level: 1, name: "ENGINEERING" })).toBeInTheDocument();

    rerender(<Title props={props} nodeId="t" slot="main" />);
    expect(screen.getByRole("heading", { level: 2, name: "ENGINEERING" })).toBeInTheDocument();
  });

  it("passes elbow proportions to CSS as shares of the box", () => {
    const Elbow = resolveDecorRenderer("lcars", "lcars.elbow");
    if (!Elbow) throw new Error("missing elbow renderer");
    const { container } = render(
      <Elbow props={{ corner: "br", arm: 0.4, bar: 0.2, tone: "accent" }} nodeId="e" />,
    );

    const elbow = container.firstElementChild as HTMLElement;
    expect(elbow).toHaveAttribute("data-corner", "br");
    expect(elbow.style.getPropertyValue("--arm")).toBe("0.4");
    expect(elbow.style.getPropertyValue("--bar")).toBe("0.2");
  });
});
