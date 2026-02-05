import { useEffect, useMemo, memo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDisplay } from "../context/DisplayContext";
import type { LayoutElement, GlobalState } from "@interactive-displays/shared";
import "./DisplayScreen.css";

const GRID_COLUMNS = 12;
const CELL_SIZE = 60; // pixels

interface ElementPlaceholderProps {
  element: LayoutElement;
  globalState: GlobalState;
}

const ElementPlaceholder = memo(function ElementPlaceholder({
  element,
  globalState,
}: ElementPlaceholderProps) {
  const style = useMemo<React.CSSProperties>(
    () => ({
      gridColumn: `${element.col + 1} / span ${element.colSpan}`,
      gridRow: `${element.row + 1} / span ${element.rowSpan}`,
      backgroundColor: element.color,
      minHeight: `${element.rowSpan * CELL_SIZE}px`,
    }),
    [element.col, element.colSpan, element.row, element.rowSpan, element.color]
  );

  const className = [
    "display-element",
    globalState === "alert" && "display-element--alert",
    globalState === "damaged" && "display-element--damaged",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={style} className={className} data-element-type={element.type}>
      {element.label || element.type.toUpperCase()}
    </div>
  );
});

export function DisplayScreen() {
  const [searchParams] = useSearchParams();
  const { layout, globalState, isConnected, identify } = useDisplay();

  const screenId = searchParams.get("screen") || "display";

  // Identify this screen to the server
  useEffect(() => {
    if (isConnected) {
      identify(screenId);
    }
  }, [isConnected, screenId, identify]);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${CELL_SIZE}px)`,
      gridAutoRows: `${CELL_SIZE}px`,
    }),
    []
  );

  const statusClassName = `display-status ${
    isConnected ? "display-status--connected" : "display-status--disconnected"
  }`;

  return (
    <>
      <div
        className="display-container"
        style={containerStyle}
        data-state={globalState}
      >
        {layout?.elements.map((element) => (
          <ElementPlaceholder
            key={element.id}
            element={element}
            globalState={globalState}
          />
        ))}
      </div>
      <div className={statusClassName}>
        {isConnected ? "CONNECTED" : "DISCONNECTED"} | {screenId} |{" "}
        {globalState.toUpperCase()}
      </div>
    </>
  );
}
