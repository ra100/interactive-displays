import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Elbow } from "./Elbow";

describe("Elbow", () => {
  const defaultProps = {
    direction: "TL" as const,
    color: "#ff9900",
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 2,
    globalState: "normal" as const,
  };

  it("renders with lcars-elbow class", () => {
    render(<Elbow {...defaultProps} />);
    const elbow = document.querySelector(".lcars-elbow");
    expect(elbow).toBeInTheDocument();
  });

  it("applies fill color to SVG path", () => {
    render(<Elbow {...defaultProps} color="#cc99cc" />);
    const path = document.querySelector(".lcars-elbow svg path");
    expect(path).toHaveAttribute("fill", "#cc99cc");
  });

  it("applies grid positioning", () => {
    render(<Elbow {...defaultProps} col={1} row={2} colSpan={3} rowSpan={4} />);
    const elbow = document.querySelector(".lcars-elbow");
    expect(elbow).toHaveStyle({
      gridColumn: "2 / span 3",
      gridRow: "3 / span 4",
    });
  });

  it("sets data-direction attribute", () => {
    render(<Elbow {...defaultProps} direction="BR" />);
    const elbow = document.querySelector(".lcars-elbow");
    expect(elbow).toHaveAttribute("data-direction", "BR");
  });

  it("applies state class for alert state", () => {
    render(<Elbow {...defaultProps} globalState="alert" />);
    const elbow = document.querySelector(".lcars-elbow");
    expect(elbow).toHaveClass("state--alert");
  });

  it.each(["TL", "TR", "BL", "BR"] as const)(
    "renders with direction %s",
    (direction) => {
      render(<Elbow {...defaultProps} direction={direction} />);
      const elbow = document.querySelector(".lcars-elbow");
      expect(elbow).toHaveAttribute("data-direction", direction);
    }
  );

  describe("asymmetric widths", () => {
    it("renders SVG with default widths", () => {
      render(<Elbow {...defaultProps} />);
      const svg = document.querySelector(".lcars-elbow svg");
      expect(svg).toBeInTheDocument();
    });

    it("accepts verticalWidth prop", () => {
      render(<Elbow {...defaultProps} verticalWidth={2} />);
      const svg = document.querySelector(".lcars-elbow svg");
      expect(svg).toBeInTheDocument();
    });

    it("accepts horizontalWidth prop", () => {
      render(<Elbow {...defaultProps} horizontalWidth={2} />);
      const svg = document.querySelector(".lcars-elbow svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders different path for asymmetric widths", () => {
      const { rerender } = render(<Elbow {...defaultProps} verticalWidth={1} horizontalWidth={1} />);
      const path1 = document.querySelector(".lcars-elbow svg path")?.getAttribute("d");

      rerender(<Elbow {...defaultProps} verticalWidth={2} horizontalWidth={1} />);
      const path2 = document.querySelector(".lcars-elbow svg path")?.getAttribute("d");

      // Paths should be different when widths change
      expect(path1).not.toBe(path2);
    });
  });
});
