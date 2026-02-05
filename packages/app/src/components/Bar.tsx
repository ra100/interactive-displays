import { memo, useMemo, type CSSProperties } from "react";
import type { BarOrientation, GlobalState } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";

export interface BarProps {
  orientation: BarOrientation;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
}

const CELL_SIZE = 60;
const RADIUS = 30;

export const Bar = memo(function Bar({
  orientation,
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
}: BarProps) {
  const style = useMemo<CSSProperties>(() => {
    const baseStyle: CSSProperties = {
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      backgroundColor: color,
      minHeight: `${rowSpan * CELL_SIZE}px`,
    };

    // Rounded ends based on orientation
    if (orientation === "horizontal") {
      // Rounded on left and right ends
      baseStyle.borderRadius = `${RADIUS}px`;
    } else {
      // Rounded on top and bottom ends
      baseStyle.borderRadius = `${RADIUS}px`;
    }

    return baseStyle;
  }, [col, colSpan, row, rowSpan, color, orientation]);

  const stateClass = getStateClass(globalState);

  return (
    <div
      className={`lcars-element lcars-bar ${stateClass}`}
      style={style}
      data-orientation={orientation}
    />
  );
});
