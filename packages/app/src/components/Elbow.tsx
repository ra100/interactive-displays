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
}

const CELL_SIZE = 60;
const RADIUS = 30;

function getClipPath(direction: ElbowDirection): string {
  // Creates an L-shaped elbow with rounded inner corner
  switch (direction) {
    case "TL":
      // Top-left corner: horizontal bar on top, vertical bar on left
      return `polygon(
        0 0,
        100% 0,
        100% ${RADIUS}px,
        ${RADIUS}px ${RADIUS}px,
        ${RADIUS}px 100%,
        0 100%
      )`;
    case "TR":
      // Top-right corner: horizontal bar on top, vertical bar on right
      return `polygon(
        0 0,
        100% 0,
        100% 100%,
        calc(100% - ${RADIUS}px) 100%,
        calc(100% - ${RADIUS}px) ${RADIUS}px,
        0 ${RADIUS}px
      )`;
    case "BL":
      // Bottom-left corner: horizontal bar on bottom, vertical bar on left
      return `polygon(
        0 0,
        ${RADIUS}px 0,
        ${RADIUS}px calc(100% - ${RADIUS}px),
        100% calc(100% - ${RADIUS}px),
        100% 100%,
        0 100%
      )`;
    case "BR":
      // Bottom-right corner: horizontal bar on bottom, vertical bar on right
      return `polygon(
        calc(100% - ${RADIUS}px) 0,
        100% 0,
        100% 100%,
        0 100%,
        0 calc(100% - ${RADIUS}px),
        calc(100% - ${RADIUS}px) calc(100% - ${RADIUS}px)
      )`;
  }
}

function getBorderRadius(direction: ElbowDirection): string {
  // Rounded outer corners
  switch (direction) {
    case "TL":
      return `${RADIUS}px 0 0 ${RADIUS}px`;
    case "TR":
      return `0 ${RADIUS}px ${RADIUS}px 0`;
    case "BL":
      return `${RADIUS}px 0 0 ${RADIUS}px`;
    case "BR":
      return `0 ${RADIUS}px ${RADIUS}px 0`;
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
}: ElbowProps) {
  const style = useMemo<CSSProperties>(
    () => ({
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      backgroundColor: color,
      minHeight: `${rowSpan * CELL_SIZE}px`,
      clipPath: getClipPath(direction),
      borderRadius: getBorderRadius(direction),
    }),
    [col, colSpan, row, rowSpan, color, direction]
  );

  const stateClass = getStateClass(globalState);

  return (
    <div
      className={`lcars-element lcars-elbow ${stateClass}`}
      style={style}
      data-direction={direction}
    />
  );
});
