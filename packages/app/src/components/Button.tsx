import { memo, useMemo, useCallback, type CSSProperties } from "react";
import type { GlobalState } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";

export interface ButtonProps {
  label: string;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
  onClick?: () => void;
}

const CELL_SIZE = 60;
const RADIUS = 30;

export const Button = memo(function Button({
  label,
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
  onClick,
}: ButtonProps) {
  const style = useMemo<CSSProperties>(
    () => ({
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      backgroundColor: color,
      borderRadius: `${RADIUS}px`,
      minHeight: `${rowSpan * CELL_SIZE}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 20px",
      fontSize: "1.25rem",
      fontWeight: 700,
      letterSpacing: "0.05em",
    }),
    [col, colSpan, row, rowSpan, color]
  );

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.();
      }
    },
    [onClick]
  );

  const stateClass = getStateClass(globalState);

  return (
    <button
      type="button"
      className={`lcars-element lcars-button lcars-touchable ${stateClass}`}
      style={style}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {label}
    </button>
  );
});
