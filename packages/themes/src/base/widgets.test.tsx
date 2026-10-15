import { catalog, type WidgetKind, type WidgetPropsOf } from "@interactive-displays/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTROL_SETTLE_MS, ShowStateInfoContext } from "../runtime.ts";
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

  describe("while and after the actor uses them", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const slider = (value: number, extra: { onUse?: (value?: number, moving?: boolean) => void; bound?: boolean } = {}) => (
      <BaseSlider props={propsOf("slider", { value, min: 0, max: 100 })} nodeId="s" {...extra} />
    );

    it("sends slider positions as moving, and the last one once more where the actor lets go", () => {
      const onUse = vi.fn();
      render(slider(20, { onUse }));
      fireEvent.change(screen.getByRole("slider"), { target: { value: "70" } });
      expect(onUse).toHaveBeenLastCalledWith(70, true);
      fireEvent.pointerUp(screen.getByRole("slider"));
      expect(onUse).toHaveBeenLastCalledWith(70);
      fireEvent.pointerUp(screen.getByRole("slider"));
      expect(onUse).toHaveBeenCalledTimes(2);

      // A release the input never hears about still happens once the slider stops moving.
      fireEvent.change(screen.getByRole("slider"), { target: { value: "75" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(onUse).toHaveBeenLastCalledWith(75);
    });

    it("ignores echoes while in use, then shows a bound value as the show has it", () => {
      const { rerender } = render(slider(20, { onUse: vi.fn(), bound: true }));
      fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } });
      // The server echoing an earlier position does not pull the thumb back.
      rerender(slider(50, { onUse: vi.fn(), bound: true }));
      expect(screen.getByRole("slider")).toHaveValue("80");
      rerender(slider(80, { onUse: vi.fn(), bound: true }));
      act(() => vi.advanceTimersByTime(CONTROL_SETTLE_MS));
      expect(screen.getByRole("slider")).toHaveValue("80");

      rerender(slider(35, { onUse: vi.fn(), bound: true }));
      expect(screen.getByRole("slider")).toHaveValue("35");
    });

    it("goes back to a bound value the server never changed, and keeps an unbound one", () => {
      const toggle = (bound: boolean) => <BaseToggle props={propsOf("toggle", { on: false })} nodeId="t" onUse={vi.fn()} bound={bound} />;
      const { unmount } = render(toggle(true));
      fireEvent.click(screen.getByRole("switch"));
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
      act(() => vi.advanceTimersByTime(CONTROL_SETTLE_MS));
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
      unmount();

      render(toggle(false));
      fireEvent.click(screen.getByRole("switch"));
      act(() => vi.advanceTimersByTime(CONTROL_SETTLE_MS));
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("shows a slider's value with the decimals its step needs", () => {
      render(<BaseSlider props={propsOf("slider", { value: 9.5, min: 1, max: 9.9, step: 0.1 })} nodeId="w" />);
      expect(screen.getByText("9.5")).toBeInTheDocument();
    });
  });
});
