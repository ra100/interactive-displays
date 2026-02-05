import { useEffect, useCallback } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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

const DEFAULT_ELEMENT_SIZE = {
  elbow: { colSpan: 2, rowSpan: 2 },
  bar: { colSpan: 4, rowSpan: 1 },
  frame: { colSpan: 3, rowSpan: 2 },
  button: { colSpan: 2, rowSpan: 1 },
  text: { colSpan: 4, rowSpan: 1 },
};

const DEFAULT_COLORS: Record<ElementType, string> = {
  elbow: "#ff9900",
  bar: "#ffcc99",
  frame: "#9999ff",
  button: "#cc99cc",
  text: "#ff9900",
};

function BuilderContent() {
  const { globalState, layout: serverLayout } = useDisplay();
  const { addElement, moveElement, setLayout } = useBuilder();

  // Load layout from server when available
  useEffect(() => {
    if (serverLayout) {
      setLayout(serverLayout);
    }
  }, [serverLayout, setLayout]);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 100,
      tolerance: 5,
    },
  });

  const sensors = useSensors(mouseSensor, touchSensor);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || over.id !== "canvas") return;

      const data = active.data.current as
        | { type: ElementType; isNew: true }
        | { element: LayoutElement; isNew: false };

      // Get canvas element to calculate position
      const canvasElement = document.querySelector(".canvas");
      if (!canvasElement) return;

      const rect = canvasElement.getBoundingClientRect();
      const dropPoint = event.activatorEvent as PointerEvent;
      const position = pixelsToGrid(dropPoint.clientX, dropPoint.clientY, rect);

      if (data.isNew) {
        // Adding new element from palette
        const size = DEFAULT_ELEMENT_SIZE[data.type];
        const newElement: LayoutElement = {
          id: generateElementId(data.type),
          type: data.type,
          col: position.col,
          row: position.row,
          colSpan: size.colSpan,
          rowSpan: size.rowSpan,
          color: DEFAULT_COLORS[data.type],
          ...(data.type === "elbow" && { direction: "TL" as const }),
          ...(data.type === "bar" && { orientation: "horizontal" as const }),
          ...(data.type === "button" && { label: "BUTTON" }),
          ...(data.type === "text" && { label: "TEXT" }),
        };
        addElement(newElement);
      } else {
        // Moving existing element
        moveElement(data.element.id, position.col, position.row);
      }
    },
    [addElement, moveElement]
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="builder-page">
        <Palette />
        <Canvas globalState={globalState} />
        <div className="builder-sidebar">
          <PropertyPanel />
          <OperatorPanel />
        </div>
      </div>
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
