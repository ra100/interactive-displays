import { memo, useMemo, type CSSProperties } from "react";
import type { ElbowDirection, GlobalState } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";

export interface ElbowProps {
  direction: ElbowDirection;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
  verticalWidth?: number; // columns for vertical arm (default: 1)
  horizontalWidth?: number; // rows for horizontal arm (default: 1)
}

const CELL_SIZE = 60;
const GAP = 4;
const CELL_WITH_GAP = CELL_SIZE + GAP;
const MIN_RADIUS = 5;

interface PathParams {
  direction: ElbowDirection;
  width: number; // total width in pixels
  height: number; // total height in pixels
  vWidth: number; // vertical arm width in pixels
  hWidth: number; // horizontal arm width in pixels
  radius: number; // inner corner radius
}

function generateElbowPath({
  direction,
  width,
  height,
  vWidth,
  hWidth,
  radius,
}: PathParams): string {
  // Clamp radius to fit within arm widths
  const r = Math.min(radius, vWidth - MIN_RADIUS, hWidth - MIN_RADIUS, radius);
  const safeR = Math.max(MIN_RADIUS, r);

  switch (direction) {
    case "TL":
      // Vertical arm on LEFT, horizontal arm on TOP
      // L-shape: vertical goes down-left, horizontal goes right-top
      return `
        M 0 0
        L ${width} 0
        L ${width} ${hWidth}
        L ${vWidth + safeR} ${hWidth}
        Q ${vWidth} ${hWidth} ${vWidth} ${hWidth + safeR}
        L ${vWidth} ${height}
        L 0 ${height}
        Z
      `.trim();

    case "TR":
      // Vertical arm on RIGHT, horizontal arm on TOP
      return `
        M 0 0
        L ${width} 0
        L ${width} ${height}
        L ${width - vWidth} ${height}
        L ${width - vWidth} ${hWidth + safeR}
        Q ${width - vWidth} ${hWidth} ${width - vWidth - safeR} ${hWidth}
        L 0 ${hWidth}
        Z
      `.trim();

    case "BL":
      // Vertical arm on LEFT, horizontal arm on BOTTOM
      return `
        M 0 0
        L ${vWidth} 0
        L ${vWidth} ${height - hWidth - safeR}
        Q ${vWidth} ${height - hWidth} ${vWidth + safeR} ${height - hWidth}
        L ${width} ${height - hWidth}
        L ${width} ${height}
        L 0 ${height}
        Z
      `.trim();

    case "BR":
      // Vertical arm on RIGHT, horizontal arm on BOTTOM
      return `
        M ${width - vWidth} 0
        L ${width} 0
        L ${width} ${height}
        L 0 ${height}
        L 0 ${height - hWidth}
        L ${width - vWidth - safeR} ${height - hWidth}
        Q ${width - vWidth} ${height - hWidth} ${width - vWidth} ${height - hWidth - safeR}
        Z
      `.trim();
  }
}

export const Elbow = memo(function Elbow({
  direction,
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
  verticalWidth = 1,
  horizontalWidth = 1,
}: ElbowProps) {
  // Calculate pixel dimensions
  const totalWidth = colSpan * CELL_WITH_GAP - GAP;
  const totalHeight = rowSpan * CELL_WITH_GAP - GAP;
  const vWidth = verticalWidth * CELL_WITH_GAP - GAP;
  const hWidth = horizontalWidth * CELL_WITH_GAP - GAP;

  // Inner corner radius - proportional to smaller arm
  const radius = Math.min(vWidth, hWidth) * 0.5;

  const path = useMemo(
    () =>
      generateElbowPath({
        direction,
        width: totalWidth,
        height: totalHeight,
        vWidth,
        hWidth,
        radius,
      }),
    [direction, totalWidth, totalHeight, vWidth, hWidth, radius]
  );

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      minHeight: `${totalHeight}px`,
      width: `${totalWidth}px`,
      height: `${totalHeight}px`,
    }),
    [col, colSpan, row, rowSpan, totalWidth, totalHeight]
  );

  const stateClass = getStateClass(globalState);

  return (
    <div
      className={`lcars-element lcars-elbow ${stateClass}`}
      style={containerStyle}
      data-direction={direction}
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        style={{ display: "block" }}
      >
        <path d={path} fill={color} />
      </svg>
    </div>
  );
});
