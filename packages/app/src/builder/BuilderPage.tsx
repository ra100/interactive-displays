import { useEffect, useCallback, useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { ElementType, LayoutElement } from "@interactive-displays/shared";
import { useDisplay } from "../context/DisplayContext";
import { BuilderProvider, useBuilder, generateElementId } from "./BuilderContext";
import { Palette } from "./Palette";
import { Canvas, pixelsToGrid } from "./Canvas";
import { PropertyPanel } from "./PropertyPanel";
import { OperatorPanel } from "./OperatorPanel";
import "../theme.css";
import "./BuilderPage.css";

const DEFAULT_ELEMENT_SIZE: Record<ElementType, { colSpan: number; rowSpan: number }> = {
  elbow: { colSpan: 2, rowSpan: 2 },
  bar: { colSpan: 4, rowSpan: 1 },
  frame: { colSpan: 3, rowSpan: 2 },
  button: { colSpan: 2, rowSpan: 1 },
  text: { colSpan: 4, rowSpan: 1 },
  video: { colSpan: 4, rowSpan: 3 },
};

const DEFAULT_COLORS: Record<ElementType, string> = {
  elbow: "#ff9900",
  bar: "#ffcc99",
  frame: "#9999ff",
  button: "#cc99cc",
  text: "#ff9900",
  video: "#333333",
};

const PALETTE_ITEMS: Array<{ type: ElementType; label: string; color: string }> = [
  { type: "elbow", label: "Elbow", color: "#ff9900" },
  { type: "bar", label: "Bar", color: "#ffcc99" },
  { type: "frame", label: "Frame", color: "#9999ff" },
  { type: "button", label: "Button", color: "#cc99cc" },
  { type: "text", label: "Text", color: "#ff9999" },
  { type: "video", label: "Video", color: "#666666" },
];

function BuilderContent() {
  const { globalState, layout: serverLayout } = useDisplay();
  const { addElement, moveElement } = useBuilder();
  const [activeId, setActiveId] = useState<string | null>(null);

  // In builder mode, we don't automatically sync from server
  // The builder starts fresh and only saves TO the server, never loads from it
  // This prevents race conditions with layout broadcasts messing up local state

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 100,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Add class immediately to palette via DOM to avoid React timing issues
    document.querySelector(".palette")?.classList.add("palette--dragging");
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    document.querySelector(".palette")?.classList.remove("palette--dragging");
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over, delta } = event;

      setActiveId(null);
      // Remove class via DOM
      document.querySelector(".palette")?.classList.remove("palette--dragging");

      if (!over || over.id !== "canvas") return;

      const data = active.data.current as
        | { type: ElementType; isNew: true }
        | { element: LayoutElement; isNew: false };

      // Get canvas element to calculate position
      const canvasElement = document.querySelector(".canvas");
      if (!canvasElement) return;

      const rect = canvasElement.getBoundingClientRect();

      if (data.isNew) {
        // Adding new element from palette
        // Use activator position + delta to get drop position
        const activatorEvent = event.activatorEvent as PointerEvent;
        const dropX = activatorEvent.clientX + delta.x;
        const dropY = activatorEvent.clientY + delta.y;
        const position = pixelsToGrid(dropX, dropY, rect);

        const size = DEFAULT_ELEMENT_SIZE[data.type];
        // Ensure new elements aren't placed at col 0 to avoid overlap with palette
        const col = Math.max(1, position.col);
        const newElement: LayoutElement = {
          id: generateElementId(data.type),
          type: data.type,
          col,
          row: position.row,
          colSpan: size.colSpan,
          rowSpan: size.rowSpan,
          color: DEFAULT_COLORS[data.type],
          ...(data.type === "elbow" && {
            direction: "TL" as const,
            verticalWidth: 1,
            horizontalWidth: 1,
          }),
          ...(data.type === "bar" && { orientation: "horizontal" as const }),
          ...(data.type === "button" && {
            label: "BUTTON",
            leftCorner: "round" as const,
            rightCorner: "round" as const,
          }),
          ...(data.type === "text" && { label: "TEXT" }),
          ...(data.type === "video" && { src: "", muted: true, loop: true, fit: "contain" as const }),
        };
        addElement(newElement);
      } else {
        // Moving existing element - calculate new position from delta
        const cellSize = 64; // CELL_SIZE (60) + gap (4)
        const deltaCol = Math.round(delta.x / cellSize);
        const deltaRow = Math.round(delta.y / cellSize);
        const newCol = Math.max(0, Math.min(11, data.element.col + deltaCol));
        const newRow = Math.max(0, Math.min(9, data.element.row + deltaRow));
        moveElement(data.element.id, newCol, newRow);
      }
    },
    [addElement, moveElement]
  );

  // Get the active palette item for DragOverlay
  const activePaletteItem = activeId?.startsWith("palette-")
    ? PALETTE_ITEMS.find((p) => `palette-${p.type}` === activeId)
    : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="builder-page">
        <Palette />
        <Canvas globalState={globalState} />
        <div className="builder-sidebar">
          <PropertyPanel />
          <OperatorPanel />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activePaletteItem && (
          <div
            style={{
              backgroundColor: activePaletteItem.color,
              padding: "12px 16px",
              borderRadius: "8px",
              cursor: "grabbing",
            }}
          >
            <span
              style={{
                color: "#000",
                fontFamily: "Antonio, sans-serif",
                fontSize: "1rem",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {activePaletteItem.label}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export function BuilderPage() {
  return (
    <BuilderProvider>
      <BuilderContent />
    </BuilderProvider>
  );
}
