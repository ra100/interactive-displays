import { memo, useMemo, type CSSProperties } from "react";
import type { BarOrientation, GlobalState, CapStyle } from "@interactive-displays/shared";
import { getStateClass } from "../utils/getStateClass";
import { CELL_SIZE } from "../constants/grid";

export interface BarProps {
  orientation: BarOrientation;
  color: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  globalState: GlobalState;
  startCap?: CapStyle;
  endCap?: CapStyle;
}

const RADIUS = 30;

// Get border-radius value for a cap style
const getCapRadius = (cap: CapStyle, size: number): string => {
  switch (cap) {
    case "round":
      return `${Math.min(RADIUS, size / 2)}px`;
    case "square":
      return "0";
    case "pointed":
      // Pointed uses clip-path, not border-radius
      return "0";
    default:
      return `${RADIUS}px`;
  }
};

// Generate clip-path for pointed caps
const getPointedClipPath = (
  orientation: BarOrientation,
  startCap: CapStyle,
  endCap: CapStyle
): string | undefined => {
  const hasPointedStart = startCap === "pointed";
  const hasPointedEnd = endCap === "pointed";

  if (!hasPointedStart && !hasPointedEnd) return undefined;

  if (orientation === "horizontal") {
    // Horizontal bar: pointed caps on left/right
    const startX = hasPointedStart ? "10%" : "0";
    const startPoint = hasPointedStart ? "0 50%" : "0 0";
    const endX = hasPointedEnd ? "90%" : "100%";
    const endPoint = hasPointedEnd ? "100% 50%" : "100% 0";

    if (hasPointedStart && hasPointedEnd) {
      return `polygon(${startPoint}, ${startX} 0, ${endX} 0, ${endPoint}, ${endX} 100%, ${startX} 100%)`;
    } else if (hasPointedStart) {
      return `polygon(${startPoint}, ${startX} 0, 100% 0, 100% 100%, ${startX} 100%)`;
    } else {
      return `polygon(0 0, ${endX} 0, ${endPoint}, ${endX} 100%, 0 100%)`;
    }
  } else {
    // Vertical bar: pointed caps on top/bottom
    const startY = hasPointedStart ? "10%" : "0";
    const startPoint = hasPointedStart ? "50% 0" : "0 0";
    const endY = hasPointedEnd ? "90%" : "100%";
    const endPoint = hasPointedEnd ? "50% 100%" : "0 100%";

    if (hasPointedStart && hasPointedEnd) {
      return `polygon(${startPoint}, 100% ${startY}, 100% ${endY}, ${endPoint}, 0 ${endY}, 0 ${startY})`;
    } else if (hasPointedStart) {
      return `polygon(${startPoint}, 100% ${startY}, 100% 100%, 0 100%, 0 ${startY})`;
    } else {
      return `polygon(0 0, 100% 0, 100% ${endY}, ${endPoint}, 0 ${endY})`;
    }
  }
};

export const Bar = memo(function Bar({
  orientation,
  color,
  col,
  row,
  colSpan,
  rowSpan,
  globalState,
  startCap = "round",
  endCap = "round",
}: BarProps) {
  const style = useMemo<CSSProperties>(() => {
    const width = colSpan * CELL_SIZE;
    const height = rowSpan * CELL_SIZE;

    const baseStyle: CSSProperties = {
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      backgroundColor: color,
      minHeight: `${height}px`,
    };

    // Calculate border-radius based on cap styles and orientation
    if (orientation === "horizontal") {
      const startRadius = getCapRadius(startCap, height);
      const endRadius = getCapRadius(endCap, height);
      // border-radius: top-left top-right bottom-right bottom-left
      baseStyle.borderRadius = `${startRadius} ${endRadius} ${endRadius} ${startRadius}`;
    } else {
      const startRadius = getCapRadius(startCap, width);
      const endRadius = getCapRadius(endCap, width);
      // For vertical: start is top, end is bottom
      baseStyle.borderRadius = `${startRadius} ${startRadius} ${endRadius} ${endRadius}`;
    }

    // Apply clip-path for pointed caps
    const clipPath = getPointedClipPath(orientation, startCap, endCap);
    if (clipPath) {
      baseStyle.clipPath = clipPath;
    }

    return baseStyle;
  }, [col, colSpan, row, rowSpan, color, orientation, startCap, endCap]);

  const stateClass = getStateClass(globalState);

  return (
    <div
      className={`lcars-element lcars-bar ${stateClass}`}
      style={style}
      data-orientation={orientation}
    />
  );
});
