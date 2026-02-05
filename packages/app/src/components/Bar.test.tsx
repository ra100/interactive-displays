import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Bar } from "./Bar";

describe("Bar", () => {
  const defaultProps = {
    orientation: "horizontal" as const,
    color: "#ffcc99",
    col: 0,
    row: 0,
    colSpan: 4,
    rowSpan: 1,
    globalState: "normal" as const,
  };

  it("renders with lcars-bar class", () => {
    render(<Bar {...defaultProps} />);
    const bar = document.querySelector(".lcars-bar");
    expect(bar).toBeInTheDocument();
  });

  it("applies background color", () => {
    render(<Bar {...defaultProps} color="#9999ff" />);
    const bar = document.querySelector(".lcars-bar");
    expect(bar).toHaveStyle({ backgroundColor: "#9999ff" });
  });

  it("applies grid positioning", () => {
    render(<Bar {...defaultProps} col={2} row={1} colSpan={6} rowSpan={2} />);
    const bar = document.querySelector(".lcars-bar");
    expect(bar).toHaveStyle({
      gridColumn: "3 / span 6",
      gridRow: "2 / span 2",
    });
  });

  it("sets data-orientation attribute for horizontal", () => {
    render(<Bar {...defaultProps} orientation="horizontal" />);
    const bar = document.querySelector(".lcars-bar");
    expect(bar).toHaveAttribute("data-orientation", "horizontal");
  });

  it("sets data-orientation attribute for vertical", () => {
    render(<Bar {...defaultProps} orientation="vertical" />);
    const bar = document.querySelector(".lcars-bar");
    expect(bar).toHaveAttribute("data-orientation", "vertical");
  });

  it("applies state class for damaged state", () => {
    render(<Bar {...defaultProps} globalState="damaged" />);
    const bar = document.querySelector(".lcars-bar");
    expect(bar).toHaveClass("state--damaged");
  });
});
