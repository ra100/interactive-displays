import { useMemo, useCallback } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import type {
  LayoutElement,
  GlobalState,
} from "@interactive-displays/shared";
import { useBuilder } from "./BuilderContext";
import { Elbow } from "../components/Elbow";
import { Bar } from "../components/Bar";
import { Frame } from "../components/Frame";
import { Button } from "../components/Button";
import { Text } from "../components/Text";
import { VideoElement } from "../components/VideoElement";
import { GRID_COLUMNS, GRID_ROWS, CELL_SIZE, CELL_WITH_GAP } from "../constants/grid";
import "./Canvas.css";

interface DraggableElementProps {
  element: LayoutElement;
  globalState: GlobalState;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function DraggableElement({
  element,
  globalState,
  isSelected,
  onSelect,
}: DraggableElementProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: element.id,
      data: { element, isNew: false },
    });

  const style = useMemo(() => {
    const base: React.CSSProperties = {
      gridColumn: `${element.col + 1} / span ${element.colSpan}`,
      gridRow: `${element.row + 1} / span ${element.rowSpan}`,
      position: "relative",
    };
    if (transform) {
      base.transform = `translate3d(${transform.x}px, ${transform.y}px, 0)`;
      base.zIndex = 100;
    }
    if (isDragging) {
      base.opacity = 0.5;
    }
    return base;
  }, [element, transform, isDragging]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id);
    },
    [onSelect, element.id]
  );

  const renderElement = () => {
    const baseProps = {
      col: 0,
      row: 0,
      colSpan: element.colSpan,
      rowSpan: element.rowSpan,
      color: element.color,
      globalState,
    };

    switch (element.type) {
      case "elbow":
        return <Elbow {...baseProps} direction={element.direction ?? "TL"} />;
      case "bar":
        return (
          <Bar {...baseProps} orientation={element.orientation ?? "horizontal"} />
        );
      case "frame":
        return <Frame {...baseProps} />;
      case "button":
        return <Button {...baseProps} label={element.label ?? "BUTTON"} />;
      case "text":
        return <Text {...baseProps} label={element.label ?? ""} />;
      case "video":
        return (
          <VideoElement
            {...baseProps}
            id={element.id}
            src={element.src ?? ""}
            fit={element.fit ?? "contain"}
            muted={element.muted ?? true}
            loop={element.loop ?? false}
            autoplay={element.autoplay ?? false}
          />
        );
      default:
        return null;
    }
  };

  const className = [
    "canvas-element",
    isSelected && "canvas-element--selected",
    isDragging && "canvas-element--dragging",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={style}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      <div className="canvas-element-inner">{renderElement()}</div>
      {isSelected && (
        <div className="canvas-element-selection-ring" />
      )}
    </div>
  );
}

interface CanvasProps {
  globalState: GlobalState;
}

export function Canvas({ globalState }: CanvasProps) {
  const { layout, selectedElementId, selectElement } = useBuilder();

  const { setNodeRef, isOver } = useDroppable({
    id: "canvas",
  });

  const gridStyle = useMemo<React.CSSProperties>(
    () => ({
      gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${CELL_SIZE}px)`,
      gridTemplateRows: `repeat(${GRID_ROWS}, ${CELL_SIZE}px)`,
      width: `${GRID_COLUMNS * CELL_WITH_GAP - (CELL_WITH_GAP - CELL_SIZE)}px`,
      height: `${GRID_ROWS * CELL_WITH_GAP - (CELL_WITH_GAP - CELL_SIZE)}px`,
    }),
    []
  );

  const handleCanvasClick = useCallback(() => {
    selectElement(null);
  }, [selectElement]);

  // Generate grid cells for visual guide
  const gridCells = useMemo(() => {
    const cells = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        cells.push(
          <div
            key={`${col}-${row}`}
            className="canvas-grid-cell"
            style={{
              gridColumn: col + 1,
              gridRow: row + 1,
            }}
          />
        );
      }
    }
    return cells;
  }, []);

  return (
    <div className="canvas-container">
      <div
        ref={setNodeRef}
        className={`canvas ${isOver ? "canvas--drop-target" : ""}`}
        style={gridStyle}
        onClick={handleCanvasClick}
        data-element-count={layout.elements.length}
      >
        {gridCells}
        {layout.elements.map((element) => (
          <DraggableElement
            key={element.id}
            element={element}
            globalState={globalState}
            isSelected={selectedElementId === element.id}
            onSelect={selectElement}
          />
        ))}
      </div>
    </div>
  );
}

// Helper to convert pixel coordinates to grid position
export function pixelsToGrid(
  x: number,
  y: number,
  canvasRect: DOMRect
): { col: number; row: number } {
  const relativeX = x - canvasRect.left;
  const relativeY = y - canvasRect.top;
  const col = Math.floor(relativeX / CELL_WITH_GAP);
  const row = Math.floor(relativeY / CELL_WITH_GAP);
  return {
    col: Math.max(0, Math.min(col, GRID_COLUMNS - 1)),
    row: Math.max(0, Math.min(row, GRID_ROWS - 1)),
  };
}
