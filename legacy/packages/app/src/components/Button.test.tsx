import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  const defaultProps = {
    label: "TEST",
    color: "#ff9900",
    col: 0,
    row: 0,
    colSpan: 2,
    rowSpan: 1,
    globalState: "normal" as const,
  };

  it("renders with label text", () => {
    render(<Button {...defaultProps} />);
    expect(screen.getByRole("button")).toHaveTextContent("TEST");
  });

  it("applies background color", () => {
    render(<Button {...defaultProps} color="#ff0000" />);
    const button = screen.getByRole("button");
    expect(button).toHaveStyle({ backgroundColor: "#ff0000" });
  });

  it("applies grid positioning", () => {
    render(<Button {...defaultProps} col={2} row={3} colSpan={4} rowSpan={2} />);
    const button = screen.getByRole("button");
    expect(button).toHaveStyle({
      gridColumn: "3 / span 4",
      gridRow: "4 / span 2",
    });
  });

  it("applies state class for alert state", () => {
    render(<Button {...defaultProps} globalState="alert" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("state--alert");
  });

  it("applies state class for damaged state", () => {
    render(<Button {...defaultProps} globalState="damaged" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("state--damaged");
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<Button {...defaultProps} onClick={handleClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick on Enter key", () => {
    const handleClick = vi.fn();
    render(<Button {...defaultProps} onClick={handleClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick on Space key", () => {
    const handleClick = vi.fn();
    render(<Button {...defaultProps} onClick={handleClick} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("has lcars-touchable class for touch styling", () => {
    render(<Button {...defaultProps} />);
    expect(screen.getByRole("button")).toHaveClass("lcars-touchable");
  });

  describe("corner styles", () => {
    it("applies round corners by default", () => {
      render(<Button {...defaultProps} />);
      const button = screen.getByRole("button");
      // Default is round on both sides - borderRadius should contain non-zero values
      const style = window.getComputedStyle(button);
      expect(style.borderRadius).not.toBe("0px");
      expect(style.borderRadius).not.toContain("0 0 0 0");
    });

    it("applies square left corner when leftCorner is square", () => {
      render(<Button {...defaultProps} leftCorner="square" rightCorner="round" />);
      const button = screen.getByRole("button");
      // Check inline style which should have format like "0 30px 30px 0"
      expect(button.style.borderRadius).toMatch(/^0\s/); // starts with 0
    });

    it("applies square right corner when rightCorner is square", () => {
      render(<Button {...defaultProps} leftCorner="round" rightCorner="square" />);
      const button = screen.getByRole("button");
      // Should have format like "30px 0 0 30px"
      expect(button.style.borderRadius).toMatch(/0\s+0\s/); // has "0 0" in middle
    });

    it("applies all square corners when both are square", () => {
      render(<Button {...defaultProps} leftCorner="square" rightCorner="square" />);
      const button = screen.getByRole("button");
      // Should be "0 0 0 0"
      expect(button.style.borderRadius).toBe("0 0 0 0");
    });
  });
});
