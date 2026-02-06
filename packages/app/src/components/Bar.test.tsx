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

  describe("cap styles", () => {
    it("applies round caps by default", () => {
      render(<Bar {...defaultProps} />);
      const bar = document.querySelector(".lcars-bar");
      // Default round caps should have border-radius on all corners
      expect(bar).toHaveStyle({ borderRadius: "30px 30px 30px 30px" });
    });

    it("applies square caps when specified", () => {
      render(<Bar {...defaultProps} startCap="square" endCap="square" />);
      const bar = document.querySelector(".lcars-bar");
      expect(bar).toHaveStyle({ borderRadius: "0 0 0 0" });
    });

    it("applies mixed cap styles (round start, square end)", () => {
      render(<Bar {...defaultProps} startCap="round" endCap="square" />);
      const bar = document.querySelector(".lcars-bar");
      // horizontal bar: start is left (TL, BL), end is right (TR, BR)
      expect(bar).toHaveStyle({ borderRadius: "30px 0 0 30px" });
    });

    it("applies pointed cap via clip-path", () => {
      render(<Bar {...defaultProps} startCap="pointed" endCap="round" />);
      const bar = document.querySelector(".lcars-bar");
      // Pointed caps use clip-path, border-radius should be 0 for pointed end
      expect(bar).toHaveStyle({ borderRadius: "0 30px 30px 0" });
      // Check that clip-path is applied (starts with polygon)
      const style = bar?.getAttribute("style");
      expect(style).toContain("clip-path");
    });

    it("applies vertical cap styles correctly", () => {
      render(
        <Bar
          {...defaultProps}
          orientation="vertical"
          colSpan={1}
          rowSpan={4}
          startCap="square"
          endCap="round"
        />
      );
      const bar = document.querySelector(".lcars-bar");
      // vertical bar: start is top (TL, TR), end is bottom (BL, BR)
      expect(bar).toHaveStyle({ borderRadius: "0 0 30px 30px" });
    });
  });
});
