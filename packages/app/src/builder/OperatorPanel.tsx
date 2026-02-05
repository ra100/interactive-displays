import { useCallback } from "react";
import type { GlobalState } from "@interactive-displays/shared";
import { useDisplay } from "../context/DisplayContext";
import { useBuilder } from "./BuilderContext";
import "./OperatorPanel.css";

interface StateButtonProps {
  label: string;
  state: GlobalState;
  color: string;
  currentState: GlobalState;
  onClick: () => void;
}

function StateButton({
  label,
  state,
  color,
  currentState,
  onClick,
}: StateButtonProps) {
  const isActive = currentState === state;

  return (
    <button
      type="button"
      className={`state-button ${isActive ? "state-button--active" : ""}`}
      style={{ backgroundColor: color }}
      onClick={onClick}
    >
      {label}
      {isActive && <span className="state-button-indicator" />}
    </button>
  );
}

export function OperatorPanel() {
  const { globalState, setGlobalState, saveLayout, isConnected } = useDisplay();
  const { layout, canUndo, canRedo, undo, redo } = useBuilder();

  const handleSave = useCallback(() => {
    saveLayout(layout);
  }, [layout, saveLayout]);

  return (
    <div className="operator-panel">
      <h3 className="operator-panel-title">Operator</h3>

      <div className="operator-section">
        <span className="operator-section-label">Global State</span>
        <div className="state-buttons">
          <StateButton
            label="Normal"
            state="normal"
            color="#ffcc99"
            currentState={globalState}
            onClick={() => setGlobalState("normal")}
          />
          <StateButton
            label="Red Alert"
            state="alert"
            color="#ff0000"
            currentState={globalState}
            onClick={() => setGlobalState("alert")}
          />
          <StateButton
            label="Active"
            state="active"
            color="#00ff00"
            currentState={globalState}
            onClick={() => setGlobalState("active")}
          />
          <StateButton
            label="Damaged"
            state="damaged"
            color="#666666"
            currentState={globalState}
            onClick={() => setGlobalState("damaged")}
          />
        </div>
      </div>

      <div className="operator-section">
        <span className="operator-section-label">History</span>
        <div className="history-buttons">
          <button
            type="button"
            className="history-button"
            onClick={undo}
            disabled={!canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="history-button"
            onClick={redo}
            disabled={!canRedo}
          >
            Redo
          </button>
        </div>
      </div>

      <div className="operator-section">
        <span className="operator-section-label">Layout</span>
        <div className="layout-info">
          <span className="layout-name">{layout.name}</span>
          <span className="layout-id">ID: {layout.id}</span>
        </div>
        <button
          type="button"
          className="save-button"
          onClick={handleSave}
          disabled={!isConnected}
        >
          Save Layout
        </button>
      </div>

      <div className="operator-section">
        <span className="operator-section-label">Connection</span>
        <div className={`connection-status ${isConnected ? "connection-status--connected" : "connection-status--disconnected"}`}>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>
    </div>
  );
}
