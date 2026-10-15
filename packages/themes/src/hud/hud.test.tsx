import { catalog, type WidgetKind, type WidgetPropsOf } from "@interactive-displays/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolveDecor } from "../react.ts";
import { HudArcs } from "./HudDecor.tsx";
import { HudButton, HudGauge, HudStatusLight, HudTitle } from "./HudWidgets.tsx";

const propsOf = <Kind extends WidgetKind>(kind: Kind, overrides: Partial<WidgetPropsOf<Kind>> = {}): WidgetPropsOf<Kind> => {
  const definition = catalog.get(kind);
  if (!definition) throw new Error(`unknown widget ${kind}`);
  return { ...(definition.props.parse(definition.example) as WidgetPropsOf<Kind>), ...overrides };
};

describe("HUD widgets", () => {
  it("draws the title large in the title slot and as a section label elsewhere", () => {
    const { container, rerender } = render(<HudTitle props={propsOf("title")} nodeId="t" slot="title" />);
    expect(container.querySelector(".hud-title--header h1")).not.toBeNull();
    rerender(<HudTitle props={propsOf("title")} nodeId="t" slot="aside" />);
    expect(container.querySelector(".hud-title--section h2")).not.toBeNull();
  });

  it("draws a button as a tab in the nav and chamfered elsewhere", () => {
    const { rerender } = render(<HudButton props={propsOf("button", { label: "Scan" })} nodeId="b" slot="nav" />);
    expect(screen.getByRole("button", { name: "Scan" })).toHaveAttribute("data-shape", "tab");
    rerender(<HudButton props={propsOf("button", { label: "Scan" })} nodeId="b" slot="main" />);
    expect(screen.getByRole("button", { name: "Scan" })).toHaveAttribute("data-shape", "chamfer");
  });

  it("draws an arc gauge as a ring filled to the value, and no fill at zero", () => {
    const { container, rerender } = render(<HudGauge props={propsOf("gauge", { variant: "arc", value: 50, min: 0, max: 100 })} nodeId="g" />);
    const ring = 2 * Math.PI * 42 * 0.75;
    expect(container.querySelector(".hud-gauge__fill")?.getAttribute("stroke-dasharray")?.split(" ")[0]).toBe(String(ring / 2));
    rerender(<HudGauge props={propsOf("gauge", { variant: "arc", value: 0, min: 0, max: 100 })} nodeId="g" />);
    expect(container.querySelector(".hud-gauge__fill")).toBeNull();
  });

  it("draws a bar gauge as a line filled to the value", () => {
    const { container } = render(<HudGauge props={propsOf("gauge", { variant: "bar", value: 25, min: 0, max: 100 })} nodeId="g" />);
    expect(container.querySelector<HTMLElement>(".hud-gauge__fill-line")?.style.inlineSize).toBe("25%");
  });

  it("gives a status light its status tone", () => {
    const { container } = render(<HudStatusLight props={propsOf("status-light", { status: "warning", label: "Shields" })} nodeId="s" />);
    expect(container.firstElementChild).toHaveAttribute("data-tone", "warning");
    expect(screen.getByText("Shields")).toBeInTheDocument();
  });
});

describe("HUD decor", () => {
  it("draws the same arc segments for the same node", () => {
    const first = render(<HudArcs props={{ segments: 3, tone: "accent" }} nodeId="arcs" />);
    const dashes = [...first.container.querySelectorAll("circle")].map((circle) => circle.getAttribute("stroke-dasharray"));
    first.unmount();
    const second = render(<HudArcs props={{ segments: 3, tone: "accent" }} nodeId="arcs" />);
    expect([...second.container.querySelectorAll("circle")].map((circle) => circle.getAttribute("stroke-dasharray"))).toEqual(dashes);
    expect(dashes).toHaveLength(3);
  });

  it("stands in for LCARS and terminal ornament", () => {
    expect(resolveDecor("hud", "lcars.bar", { tone: "danger" })?.kind).toBe("hud.scale");
    expect(resolveDecor("hud", "crt.radar", {})?.kind).toBe("hud.reticle");
    expect(resolveDecor("hud", "crt.log", {})).toBeUndefined();
  });
});
