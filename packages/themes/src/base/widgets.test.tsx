import { catalog, type WidgetKind, type WidgetPropsOf } from "@interactive-displays/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShowStateInfoContext } from "../runtime.ts";
import { bannerText, BaseAlertBanner } from "./BaseAlertBanner.tsx";
import { BaseButtonGroup, BaseSlider, BaseToggle } from "./BaseControls.tsx";
import { BaseSparkline } from "./BaseAmbient.tsx";
import { BaseGauge, gaugeTone } from "./BaseData.tsx";

const propsOf = <Kind extends WidgetKind>(kind: Kind, overrides: Partial<WidgetPropsOf<Kind>> = {}): WidgetPropsOf<Kind> => {
  const definition = catalog.get(kind);
  if (!definition) throw new Error(`unknown widget ${kind}`);
  return { ...(definition.props.parse(definition.example) as WidgetPropsOf<Kind>), ...overrides };
};

describe("gaugeTone", () => {
  it("turns danger past a threshold", () => {
    const gauge = propsOf("gauge", { value: 10, dangerBelow: 25, tone: "primary" });
    expect(gaugeTone(gauge)).toBe("danger");
    expect(gaugeTone({ ...gauge, value: 60 })).toBe("primary");
    expect(gaugeTone({ ...gauge, value: 99, dangerAbove: 95 })).toBe("danger");
  });
});

describe("arc gauge", () => {
  it("draws no fill at zero and a fill that stops at the value otherwise", () => {
    const { container, rerender } = render(<BaseGauge props={propsOf("gauge", { value: 0, variant: "arc" })} nodeId="g" />);
    expect(container.querySelector(".base-gauge__arc-fill")).toBeNull();
    rerender(<BaseGauge props={propsOf("gauge", { value: 40, variant: "arc" })} nodeId="g" />);
    expect(container.querySelector(".base-gauge__arc-fill")).toHaveAttribute("stroke-dasharray", "40 101");
  });
});

describe("sparkline", () => {
  it("starts a live trace with a full history that ends at the first value", () => {
    const { container } = render(<BaseSparkline props={propsOf("sparkline", { value: 50, points: 20 })} nodeId="trace" />);
    const points = container.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
    expect(points).toHaveLength(20);
    expect(points.at(-1)).toBe("100.00,50.00");
  });
});

describe("alert banner", () => {
  it("shows the state's banner, or its name when the state has an effect", () => {
    expect(bannerText({ id: "red", label: "Red alert", effect: "alert" }, undefined)).toBe("RED ALERT");
    expect(bannerText({ id: "red", label: "Red alert", effect: "alert", banner: "Battle stations" }, undefined)).toBe(
      "BATTLE STATIONS",
    );
    expect(bannerText({ id: "red", label: "Red alert", effect: "alert" }, "Intruder")).toBe("INTRUDER");
  });

  it("stays empty in calm states", () => {
    expect(bannerText({ id: "normal", label: "Normal", effect: "none" }, "Intruder")).toBeUndefined();
    expect(bannerText({ id: "dark", label: "Power out", effect: "blackout" }, undefined)).toBeUndefined();
  });

  it("follows the show state from context", () => {
    render(
      <ShowStateInfoContext.Provider value={{ id: "red", label: "Red alert", effect: "alert" }}>
        <BaseAlertBanner props={propsOf("alert-banner")} nodeId="banner" />
      </ShowStateInfoContext.Provider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("RED ALERT");
  });
});

describe("controls", () => {
  it("reports the chosen option of a button group", () => {
    const onUse = vi.fn();
    render(<BaseButtonGroup props={propsOf("button-group", { items: ["Low", "High"], selected: 0 })} nodeId="g" onUse={onUse} />);
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(onUse).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "High" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports 1 or 0 from a toggle", () => {
    const onUse = vi.fn();
    render(<BaseToggle props={propsOf("toggle", { on: false })} nodeId="t" onUse={onUse} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onUse).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("switch"));
    expect(onUse).toHaveBeenLastCalledWith(0);
  });

  it("reports slider positions and follows its props again", () => {
    const onUse = vi.fn();
    const { rerender } = render(<BaseSlider props={propsOf("slider", { value: 20, min: 0, max: 100 })} nodeId="s" onUse={onUse} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "70" } });
    expect(onUse).toHaveBeenCalledWith(70);
    rerender(<BaseSlider props={propsOf("slider", { value: 35, min: 0, max: 100 })} nodeId="s" onUse={onUse} />);
    expect(screen.getByRole("slider")).toHaveValue("35");
  });
});
