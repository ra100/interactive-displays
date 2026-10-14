import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import type { GlobalState } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";
import { CELL_SIZE } from "../constants/grid";

export interface FrameProps {
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
  children?: ReactNode;
}

const RADIUS = 15;
const BORDER_WIDTH = 4;

export const Frame = memo(function Frame({
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
  children,
}: FrameProps) {
  const style = useMemo<CSSProperties>(
    () => ({
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      borderColor: color,
      borderWidth: `${BORDER_WIDTH}px`,
      borderStyle: "solid",
      borderRadius: `${RADIUS}px`,
      minHeight: `${rowSpan * CELL_SIZE}px`,
      backgroundColor: "transparent",
    }),
    [col, colSpan, row, rowSpan, color]
  );

  const stateClass = getStateClass(globalState);

  return (
    <div className={`lcars-element lcars-frame ${stateClass}`} style={style}>
      {children}
    </div>
  );
});
