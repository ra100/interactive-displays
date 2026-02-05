import { memo, useMemo, useCallback, type CSSProperties } from "react";
import type { GlobalState, CornerStyle } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";

export interface ButtonProps {
  label: string;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
  leftCorner?: CornerStyle;
  rightCorner?: CornerStyle;
  onClick?: () => void;
}

const CELL_SIZE = 60;
const GAP = 4;
const CELL_WITH_GAP = CELL_SIZE + GAP;

function getCornerRadius(
  corner: CornerStyle,
  height: number
): string {
  // For pill-shaped buttons, use half the height for round corners
  return corner === "round" ? `${height / 2}px` : "0";
}

export const Button = memo(function Button({
  label,
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
  leftCorner = "round",
  rightCorner = "round",
  onClick,
}: ButtonProps) {
  const height = rowSpan * CELL_WITH_GAP - GAP;

  const style = useMemo<CSSProperties>(() => {
    const left = getCornerRadius(leftCorner, height);
    const right = getCornerRadius(rightCorner, height);
    // CSS border-radius order: TL TR BR BL
    const borderRadius = `${left} ${right} ${right} ${left}`;

    return {
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      backgroundColor: color,
      borderRadius,
      minHeight: `${height}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 20px",
      fontSize: "1.25rem",
      fontWeight: 700,
      letterSpacing: "0.05em",
    };
  }, [col, colSpan, row, rowSpan, color, leftCorner, rightCorner, height]);

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
