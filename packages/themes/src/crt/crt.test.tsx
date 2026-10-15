import { catalog, type WidgetKind, type WidgetPropsOf } from "@interactive-displays/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CrtLog, CrtRadar } from "./CrtDecor.tsx";
import { CrtButton, CrtGauge, CrtStatusLight, CrtTitle } from "./CrtWidgets.tsx";

const propsOf = <Kind extends WidgetKind>(kind: Kind, overrides: Partial<WidgetPropsOf<Kind>> = {}): WidgetPropsOf<Kind> => {
  const definition = catalog.get(kind);
  if (!definition) throw new Error(`unknown widget ${kind}`);
  return { ...(definition.props.parse(definition.example) as WidgetPropsOf<Kind>), ...overrides };
};

describe("terminal widgets", () => {
  it("draws the title as a header bar in the title slot and a section heading elsewhere", () => {
    const { container, rerender } = render(<CrtTitle props={propsOf("title")} nodeId="t" slot="title" />);
    expect(container.querySelector(".crt-title--header h1")).not.toBeNull();
    rerender(<CrtTitle props={propsOf("title")} nodeId="t" slot="main" />);
    expect(container.querySelector(".crt-title--section h2")).not.toBeNull();
  });

  it("draws a button as a menu line in the nav and a key elsewhere", () => {
    const { rerender } = render(<CrtButton props={propsOf("button", { label: "Helm" })} nodeId="b" slot="nav" />);
    expect(screen.getByRole("button", { name: "Helm" })).toHaveAttribute("data-shape", "menu");
    rerender(<CrtButton props={propsOf("button", { label: "Helm" })} nodeId="b" slot="main" />);
    expect(screen.getByRole("button", { name: "Helm" })).toHaveAttribute("data-shape", "key");
  });

  it("lights gauge cells in proportion to the value", () => {
    const { container } = render(<CrtGauge props={propsOf("gauge", { value: 50, min: 0, max: 100 })} nodeId="g" />);
    expect(container.querySelectorAll(".crt-gauge__cell")).toHaveLength(24);
    expect(container.querySelectorAll('.crt-gauge__cell[data-lit="true"]')).toHaveLength(12);
  });

  it("tags a status like a boot log", () => {
    render(<CrtStatusLight props={propsOf("status-light", { status: "danger", label: "Core" })} nodeId="s" />);
    expect(screen.getByText("FAIL")).toHaveClass("crt-status__tag");
  });
});

describe("terminal decor", () => {
  it("places radar contacts the same way for the same node", () => {
    const first = render(<CrtRadar props={{ contacts: 3, tone: "primary" }} nodeId="scope" />);
    const places = [...first.container.querySelectorAll<HTMLElement>(".crt-radar__contact")].map((contact) => contact.style.left);
    first.unmount();
    const second = render(<CrtRadar props={{ contacts: 3, tone: "primary" }} nodeId="scope" />);
    expect([...second.container.querySelectorAll<HTMLElement>(".crt-radar__contact")].map((contact) => contact.style.left)).toEqual(places);
    expect(places).toHaveLength(3);
  });

  it("repeats its lines so the scroll loops", () => {
    const { container } = render(<CrtLog props={{ lines: 4, speed: "normal", tone: "primary" }} nodeId="log" />);
    const lines = [...container.querySelectorAll(".crt-log__scroll > span")].map((line) => line.textContent);
    expect(lines).toHaveLength(16);
    expect(lines.slice(0, 8)).toEqual(lines.slice(8));
  });
});
