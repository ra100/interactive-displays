import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useDisplay } from "../context/DisplayContext";
import type { LayoutElement } from "../../../server/src/types.js";

const GRID_COLUMNS = 12;
const CELL_SIZE = 60; // pixels

function ElementPlaceholder({ element }: { element: LayoutElement }) {
  const { globalState } = useDisplay();

  const style: React.CSSProperties = {
    gridColumn: `${element.col + 1} / span ${element.colSpan}`,
    gridRow: `${element.row + 1} / span ${element.rowSpan}`,
    backgroundColor: element.color,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#000",
    fontFamily: "'Antonio', sans-serif",
    fontSize: "1rem",
    textTransform: "uppercase",
    transition: "background-color 0.3s ease-out, opacity 0.3s ease-out",
    minHeight: `${element.rowSpan * CELL_SIZE}px`,
  };

  // Apply state-based styling
  if (globalState === "alert") {
    style.animation = "pulse 0.5s ease-in-out infinite alternate";
  } else if (globalState === "damaged") {
    style.filter = "grayscale(80%)";
    style.opacity = 0.7;
  }

  return (
    <div style={style} data-element-type={element.type}>
      {element.label || element.type.toUpperCase()}
    </div>
  );
}

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

  const containerStyle: React.CSSProperties = {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${CELL_SIZE}px)`,
    gridAutoRows: `${CELL_SIZE}px`,
    gap: "4px",
    padding: "20px",
    boxSizing: "border-box",
    overflow: "hidden",
  };

  const statusStyle: React.CSSProperties = {
    position: "fixed",
    top: "10px",
    right: "10px",
    padding: "8px 12px",
    backgroundColor: isConnected ? "#00ff00" : "#ff0000",
    color: "#000",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: "monospace",
    zIndex: 1000,
  };

  return (
    <>
      <style>
        {`
          @keyframes pulse {
            from { opacity: 1; }
            to { opacity: 0.6; }
          }
        `}
      </style>
      <div style={containerStyle} data-state={globalState}>
        {layout?.elements.map((element) => (
          <ElementPlaceholder key={element.id} element={element} />
        ))}
      </div>
      <div style={statusStyle}>
        {isConnected ? "CONNECTED" : "DISCONNECTED"} | {screenId} |{" "}
        {globalState.toUpperCase()}
      </div>
    </>
  );
}
