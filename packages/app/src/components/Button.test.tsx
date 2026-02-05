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
});
