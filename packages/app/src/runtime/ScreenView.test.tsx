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
