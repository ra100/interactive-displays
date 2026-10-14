import { useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useDisplay } from "../context/DisplayContext";
import { LayoutRenderer } from "./LayoutRenderer";
import { GRID_COLUMNS, CELL_SIZE } from "../constants/grid";
import "../theme.css";
import "./DisplayScreen.css";

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

  const handleButtonClick = useCallback((_elementId: string) => {
    // Button click handling will be implemented when needed
  }, []);

  const statusClassName = `display-status ${
    isConnected ? "display-status--connected" : "display-status--disconnected"
  }`;

  return (
    <>
      <div
        className="display-container lcars-display"
        style={containerStyle}
        data-state={globalState}
      >
        {layout && (
          <LayoutRenderer
            layout={layout}
            globalState={globalState}
            onButtonClick={handleButtonClick}
          />
        )}
      </div>
      <div className={statusClassName}>
        {isConnected ? "CONNECTED" : "DISCONNECTED"} | {screenId} |{" "}
        {globalState.toUpperCase()}
      </div>
    </>
  );
}
