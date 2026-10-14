import { type Node, type Screen, ScreenSchema } from "@interactive-displays/core";
import { render, screen as view } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScreenView } from "./ScreenView.tsx";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary.tsx";

const makeScreen = (children: Array<{ node: unknown; weight?: number }>): Screen =>
  ScreenSchema.parse({
    schemaVersion: 1,
    id: "test",
    name: "Test",
    root: { id: "root", type: "container", layout: { kind: "stack", direction: "column" }, children },
  });

const withRoot = (root: unknown): Screen => ScreenSchema.parse({ schemaVersion: 1, id: "test", name: "Test", root });

const sidebar = withRoot({
  id: "root",
  type: "container",
  layout: { kind: "frame", archetype: "sidebar" },
  children: [
    { slot: "title", node: { id: "t", type: "widget", kind: "title", props: { text: "BRIDGE" } } },
    { slot: "nav", node: { id: "helm", type: "widget", kind: "button", props: { label: "HELM" } } },
    { slot: "main", node: { id: "go", type: "widget", kind: "button", props: { label: "ENGAGE" } } },
    { slot: "main", node: { id: "bar", type: "decor", kind: "lcars.bar", props: { code: "47-0219" } } },
    { slot: "status", node: { id: "s", type: "widget", kind: "text", props: { text: "NOMINAL" } } },
  ],
});

const widget = (id: string, kind: string, props: Record<string, unknown>, extra: Partial<Node> = {}) => ({
  node: { id, type: "widget", kind, props, ...extra },
});

describe("ScreenView", () => {
  it("renders widgets inside a themed root", () => {
    const { container } = render(
      <ScreenView
        screen={makeScreen([widget("t", "title", { text: "BRIDGE" }), widget("b", "button", { label: "ENGAGE" })])}
        themeId="base"
      />,
    );

    expect(view.getByRole("heading", { name: "BRIDGE" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "ENGAGE" })).toBeInTheDocument();

    const root = container.querySelector<HTMLElement>(".screen");
    expect(root).toHaveAttribute("data-theme", "base");
    expect(root?.style.getPropertyValue("--tone-primary")).toMatch(/^#/);
  });

  it("falls back to the base theme for an unknown theme id", () => {
    const { container } = render(<ScreenView screen={makeScreen([])} themeId="nope" />);
    expect(container.querySelector(".screen")).toHaveAttribute("data-theme", "base");
  });

  it("does not render hidden nodes", () => {
    render(
      <ScreenView
        screen={makeScreen([
          widget("shown", "text", { text: "visible" }),
          widget("gone", "text", { text: "secret" }, { hidden: true }),
        ])}
        themeId="base"
      />,
    );

    expect(view.getByText("visible")).toBeInTheDocument();
    expect(view.queryByText("secret")).not.toBeInTheDocument();
  });

  it("contains unknown kinds and invalid props without breaking the rest", () => {
    render(
      <ScreenView
        screen={makeScreen([
          widget("a", "warp-core", {}),
          widget("b", "button", { label: "" }),
          widget("c", "text", { text: "still here" }),
        ])}
        themeId="base"
      />,
    );

    expect(view.getByText("Unknown widget")).toBeInTheDocument();
    expect(view.getByText("Invalid props")).toBeInTheDocument();
    expect(view.getByText("still here")).toBeInTheDocument();
  });

  it("uses child weights as flex grow", () => {
    const { container } = render(
      <ScreenView
        screen={makeScreen([
          { ...widget("a", "text", { text: "a" }), weight: 3 },
          widget("b", "text", { text: "b" }),
        ])}
        themeId="base"
      />,
    );

    const items = container.querySelectorAll<HTMLElement>(".stack__item");
    expect(items[0]?.style.flexGrow).toBe("3");
    expect(items[1]?.style.flexGrow).toBe("1");
  });
});

describe("frames", () => {
  it("hands each slot to the theme's frame and tells widgets their slot", () => {
    const { container } = render(<ScreenView screen={sidebar} themeId="lcars" />);

    expect(container.querySelector(".lcars-frame--sidebar")).not.toBeNull();
    expect(view.getByRole("heading", { level: 1, name: "BRIDGE" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: /HELM/ })).toHaveAttribute("data-shape", "block");
    expect(view.getByRole("button", { name: "ENGAGE" })).toHaveAttribute("data-shape", "pill");
    expect(container.querySelector('.slot[data-slot="nav"]')).toHaveAttribute("data-direction", "column");
  });

  it("renders the same screen in the base theme, without LCARS decor", () => {
    const { container } = render(<ScreenView screen={sidebar} themeId="base" />);

    expect(container.querySelector('.base-frame[data-archetype="sidebar"]')).not.toBeNull();
    expect(view.getByRole("button", { name: "HELM" })).toBeInTheDocument();
    expect(container.querySelector('[data-node-id="bar"]')).toBeNull();
    // Hidden decor leaves no empty slot item behind.
    expect(container.querySelectorAll('.slot[data-slot="main"] > .slot__item')).toHaveLength(1);
  });

  it("renders decor in its own theme", () => {
    const { container } = render(<ScreenView screen={sidebar} themeId="lcars" />);
    expect(container.querySelector('[data-node-id="bar"] .lcars-bar')).toHaveTextContent("47-0219");
  });

  it("contains an unknown archetype", () => {
    render(
      <ScreenView
        screen={withRoot({ id: "root", type: "container", layout: { kind: "frame", archetype: "bridge" }, children: [] })}
        themeId="lcars"
      />,
    );
    expect(view.getByText("Unknown archetype")).toBeInTheDocument();
  });

  it("contains decor with invalid props", () => {
    render(
      <ScreenView
        screen={makeScreen([{ node: { id: "e", type: "decor", kind: "lcars.elbow", props: { corner: "middle" } } }])}
        themeId="lcars"
      />,
    );
    expect(view.getByText("Invalid props")).toBeInTheDocument();
  });
});

describe("grid and canvas", () => {
  it("places grid children in their areas", () => {
    const { container } = render(
      <ScreenView
        screen={withRoot({
          id: "root",
          type: "container",
          layout: { kind: "grid", columns: ["2fr", "auto"], rows: ["1fr"] },
          children: [
            { area: { col: 1, row: 1, colSpan: 2 }, node: { id: "a", type: "widget", kind: "text", props: { text: "a" } } },
          ],
        })}
        themeId="base"
      />,
    );

    const grid = container.querySelector<HTMLElement>(".grid");
    expect(grid?.style.gridTemplateColumns).toBe("minmax(0, 2fr) auto");
    const item = container.querySelector<HTMLElement>(".grid__item");
    expect(item?.style.gridColumn).toBe("1 / span 2");
    expect(item?.style.gridRow).toBe("1 / span 1");
  });

  it("positions canvas children by their rects", () => {
    const { container } = render(
      <ScreenView
        screen={withRoot({
          id: "root",
          type: "container",
          layout: { kind: "canvas" },
          children: [
            {
              rect: { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
              node: { id: "a", type: "widget", kind: "text", props: { text: "a" } },
            },
          ],
        })}
        themeId="base"
      />,
    );

    const item = container.querySelector<HTMLElement>(".canvas__item");
    expect(item?.style.left).toBe("10%");
    expect(item?.style.top).toBe("20%");
    expect(item?.style.width).toBe("50%");
    expect(item?.style.height).toBe("25%");
  });
});

describe("show states", () => {
  const screenWithOverrides = makeScreen([
    {
      node: {
        id: "status",
        type: "widget",
        kind: "text",
        props: { text: "ALL CLEAR" },
        when: [{ state: "red-alert", props: { text: "RED ALERT", tone: "danger" } }],
      },
    },
    { node: { id: "calm", type: "widget", kind: "text", props: { text: "TEA, EARL GREY" }, when: [{ state: "red-alert", hidden: true }] } },
  ]);

  it("applies the state's overrides", () => {
    render(<ScreenView screen={screenWithOverrides} themeId="lcars" state="red-alert" effect="alert" />);

    expect(view.getByText("RED ALERT")).toHaveAttribute("data-tone", "danger");
    expect(view.queryByText("TEA, EARL GREY")).not.toBeInTheDocument();
  });

  it("marks the root with the state and effect and uses the effect's tokens", () => {
    const { container } = render(
      <ScreenView screen={screenWithOverrides} themeId="lcars" state="red-alert" effect="alert" />,
    );

    const root = container.querySelector<HTMLElement>(".screen");
    expect(root).toHaveAttribute("data-state", "red-alert");
    expect(root).toHaveAttribute("data-effect", "alert");
    expect(root?.style.getPropertyValue("--tone-primary")).toBe("#ff3333");
  });

  it("uses the show's theme variant", () => {
    const { container } = render(<ScreenView screen={screenWithOverrides} themeId="lcars" variant="nemesis" />);

    const root = container.querySelector<HTMLElement>(".screen");
    expect(root).toHaveAttribute("data-variant", "nemesis");
    expect(root?.style.getPropertyValue("--tone-primary")).toBe("#5c8fd6");
  });

  it("ignores a variant the theme does not have", () => {
    const { container } = render(<ScreenView screen={screenWithOverrides} themeId="lcars" variant="mirror" />);
    expect(container.querySelector(".screen")).not.toHaveAttribute("data-variant");
  });
});

describe("WidgetErrorBoundary", () => {
  it("replaces a crashing widget with a fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Crash = () => {
      throw new Error("boom");
    };

    render(
      <WidgetErrorBoundary kind="crashy">
        <Crash />
      </WidgetErrorBoundary>,
    );

    expect(view.getByText("Render error")).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
