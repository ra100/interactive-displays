import { type WidgetPropsOf, widgets } from "@interactive-displays/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { frozenTicker, StillContext, TickerContext } from "../runtime.ts";
import { ships } from "../ships/model.ts";
import { BaseShipSchematic } from "./BaseShip.tsx";

const props = (overrides: Record<string, unknown> = {}): WidgetPropsOf<"ship-schematic"> => widgets["ship-schematic"].props.parse(overrides);

const draw = (overrides: Record<string, unknown> = {}, still = false) =>
  render(
    <StillContext.Provider value={still}>
      <TickerContext.Provider value={frozenTicker(0)}>
        <BaseShipSchematic props={props(overrides)} nodeId="ship" />
      </TickerContext.Provider>
    </StillContext.Provider>,
  );

const systemsOf = (container: HTMLElement, selector: string, state: string) =>
  [...new Set([...container.querySelectorAll(`${selector}[data-state="${state}"]`)].map((part) => part.getAttribute("data-system")))].sort();

describe("ship schematic", () => {
  it("draws the dorsal line art and its measurements", () => {
    const { container } = draw();
    expect(screen.getByText("DORSAL")).toBeInTheDocument();
    expect(container.querySelector(".base-ship__hull")).toHaveAttribute("d", ships.norway.views.top.outline);
    expect(container.querySelector(".base-ship__lines")).toHaveAttribute("d", ships.norway.views.top.lines);
    expect(screen.getByText("LENGTH 358 M")).toBeInTheDocument();
    expect(screen.getByText("13 DECKS")).toBeInTheDocument();
    expect(container.querySelectorAll(".base-ship__part")).toHaveLength(0);
  });

  it("lights the weapons and the shield bubble for tactical", () => {
    const { container } = draw({ mode: "tactical", shields: 40, armed: true });
    expect(systemsOf(container, ".base-ship__part", "active")).toEqual(["phasers", "torpedoes"]);
    expect(container.querySelector(".base-ship__part[data-system='phasers']")).toHaveAttribute("data-tone", "danger");
    expect(container.querySelector(".base-ship__shield")).toHaveAttribute("data-tone", "warning");
    expect(container.querySelector(".base-ship")).toHaveAttribute("data-armed", "true");
    expect(screen.getByText("SHIELDS 40%")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByText("WEAPONS ARMED")).toBeInTheDocument();
    expect(screen.getByText("PHASERS")).toBeInTheDocument();
  });

  it("runs power from the core along the conduits for engineering", () => {
    const { container } = draw({ view: "side", mode: "engineering", power: 0 });
    expect(container.querySelectorAll(".base-ship__flow")).toHaveLength(ships.norway.conduits.length);
    expect(container.querySelector(".base-ship__decks")).not.toBeNull();
    expect(container.querySelector(".base-ship")).toHaveAttribute("data-power", "off");
    expect(screen.getByText("CORE OFFLINE")).toBeInTheDocument();
    expect(screen.getByText("WARP CORE")).toBeInTheDocument();
  });

  it("blinks damaged systems and darkens offline ones for damage control", () => {
    const { container } = draw({ view: "front", mode: "damage", damaged: ["nacelles"], offline: ["deflector"] });
    expect(systemsOf(container, ".base-ship__part", "damaged")).toEqual(["nacelles"]);
    expect(systemsOf(container, ".base-ship__part", "offline")).toEqual(["deflector"]);
    expect(systemsOf(container, ".base-ship__part", "quiet")).not.toContain("nacelles");
    expect(screen.getByText("1 DAMAGED")).toHaveAttribute("data-tone", "danger");
  });

  it("reports all systems nominal when nothing is wrong", () => {
    draw({ mode: "damage" });
    expect(screen.getByText("ALL SYSTEMS NOMINAL")).toBeInTheDocument();
  });

  it("leaves labels out when asked", () => {
    const { container } = draw({ mode: "engineering", labels: false });
    expect(container.querySelectorAll(".base-ship__tag")).toHaveLength(0);
  });

  it("draws itself in once, except in a still screen", () => {
    expect(draw().container.querySelector(".base-ship__reveal")).not.toBeNull();
    expect(draw({}, true).container.querySelector(".base-ship__reveal")).toBeNull();
  });

  it("turns the lines plan with markers on the marked systems", () => {
    const { container } = draw({ view: "turn", mode: "tactical", highlight: ["bridge"] });
    expect(screen.getByText("ROTATION")).toBeInTheDocument();
    expect(container.querySelector(".base-ship__hull-near")?.getAttribute("d")).toMatch(/^M/);
    expect(container.querySelector(".base-ship__shield--rings")).not.toBeNull();
    expect(systemsOf(container, ".base-ship__marker", "marked")).toEqual(["bridge"]);
    expect(screen.getByText("BRIDGE")).toBeInTheDocument();
  });
});
