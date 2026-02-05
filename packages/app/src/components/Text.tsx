import { memo, useMemo, type CSSProperties } from "react";
import type { GlobalState } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";

export interface TextProps {
  label: string;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
}

const CELL_SIZE = 60;

export const Text = memo(function Text({
  label,
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
}: TextProps) {
  const style = useMemo<CSSProperties>(
    () => ({
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      color: color,
      minHeight: `${rowSpan * CELL_SIZE}px`,
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "0 10px",
      fontSize: "1.5rem",
      fontWeight: 400,
      letterSpacing: "0.1em",
      backgroundColor: "transparent",
    }),
    [col, colSpan, row, rowSpan, color]
  );

  const stateClass = getStateClass(globalState);

  return (
    <div className={`lcars-element lcars-text ${stateClass}`} style={style}>
      {label}
    </div>
  );
});
