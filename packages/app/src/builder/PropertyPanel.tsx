import { useCallback } from "react";
import type { ElbowDirection, BarOrientation } from "@interactive-displays/shared";
import { useBuilder } from "./BuilderContext";
import "./PropertyPanel.css";

const LCARS_COLORS = [
  { name: "Orange", value: "#ff9900" },
  { name: "Tan", value: "#ffcc99" },
  { name: "Purple", value: "#cc99cc" },
  { name: "Blue", value: "#9999ff" },
  { name: "Salmon", value: "#ff9999" },
  { name: "Red", value: "#ff0000" },
  { name: "Green", value: "#00ff00" },
  { name: "Gray", value: "#999999" },
];

const ELBOW_DIRECTIONS: { label: string; value: ElbowDirection }[] = [
  { label: "Top-Left", value: "TL" },
  { label: "Top-Right", value: "TR" },
  { label: "Bottom-Left", value: "BL" },
  { label: "Bottom-Right", value: "BR" },
];

const BAR_ORIENTATIONS: { label: string; value: BarOrientation }[] = [
  { label: "Horizontal", value: "horizontal" },
  { label: "Vertical", value: "vertical" },
];

export function PropertyPanel() {
  const { getSelectedElement, updateElement, deleteElement, selectedElementId } =
    useBuilder();

  const element = getSelectedElement();

  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { color });
      }
    },
    [selectedElementId, updateElement]
  );

  const handleNumberChange = useCallback(
    (field: "col" | "row" | "colSpan" | "rowSpan", value: number) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { [field]: value });
      }
    },
    [selectedElementId, updateElement]
  );

  const handleLabelChange = useCallback(
    (label: string) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { label });
      }
    },
    [selectedElementId, updateElement]
  );

  const handleDirectionChange = useCallback(
    (direction: ElbowDirection) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { direction });
      }
    },
    [selectedElementId, updateElement]
  );

  const handleOrientationChange = useCallback(
    (orientation: BarOrientation) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { orientation });
      }
    },
    [selectedElementId, updateElement]
  );

  const handleDelete = useCallback(() => {
    if (selectedElementId) {
      deleteElement(selectedElementId);
    }
  }, [selectedElementId, deleteElement]);

  if (!element) {
    return (
      <div className="property-panel">
        <h3 className="property-panel-title">Properties</h3>
        <p className="property-panel-empty">Select an element to edit</p>
      </div>
    );
  }

  return (
    <div className="property-panel">
      <h3 className="property-panel-title">Properties</h3>

      <div className="property-group">
        <label className="property-label">Type</label>
        <span className="property-value">{element.type.toUpperCase()}</span>
      </div>

      <div className="property-group">
        <label className="property-label">Color</label>
        <div className="color-picker">
          {LCARS_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className={`color-swatch ${element.color === color.value ? "color-swatch--selected" : ""}`}
              style={{ backgroundColor: color.value }}
              onClick={() => handleColorChange(color.value)}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="property-group">
        <label className="property-label">Position</label>
        <div className="property-row">
          <div className="property-field">
            <span className="property-field-label">Col</span>
            <input
              type="number"
              min={0}
              max={11}
              value={element.col}
              onChange={(e) =>
                handleNumberChange("col", parseInt(e.target.value, 10))
              }
              className="property-input"
            />
          </div>
          <div className="property-field">
            <span className="property-field-label">Row</span>
            <input
              type="number"
              min={0}
              max={9}
              value={element.row}
              onChange={(e) =>
                handleNumberChange("row", parseInt(e.target.value, 10))
              }
              className="property-input"
            />
          </div>
        </div>
      </div>

      <div className="property-group">
        <label className="property-label">Size</label>
        <div className="property-row">
          <div className="property-field">
            <span className="property-field-label">Width</span>
            <input
              type="number"
              min={1}
              max={12}
              value={element.colSpan}
              onChange={(e) =>
                handleNumberChange("colSpan", parseInt(e.target.value, 10))
              }
              className="property-input"
            />
          </div>
          <div className="property-field">
            <span className="property-field-label">Height</span>
            <input
              type="number"
              min={1}
              max={10}
              value={element.rowSpan}
              onChange={(e) =>
                handleNumberChange("rowSpan", parseInt(e.target.value, 10))
              }
              className="property-input"
            />
          </div>
        </div>
      </div>

      {element.type === "elbow" && (
        <div className="property-group">
          <label className="property-label">Direction</label>
          <select
            value={element.direction ?? "TL"}
            onChange={(e) =>
              handleDirectionChange(e.target.value as ElbowDirection)
            }
            className="property-select"
          >
            {ELBOW_DIRECTIONS.map((dir) => (
              <option key={dir.value} value={dir.value}>
                {dir.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {element.type === "bar" && (
        <div className="property-group">
          <label className="property-label">Orientation</label>
          <select
            value={element.orientation ?? "horizontal"}
            onChange={(e) =>
              handleOrientationChange(e.target.value as BarOrientation)
            }
            className="property-select"
          >
            {BAR_ORIENTATIONS.map((orient) => (
              <option key={orient.value} value={orient.value}>
                {orient.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {(element.type === "button" || element.type === "text") && (
        <div className="property-group">
          <label className="property-label">Label</label>
          <input
            type="text"
            value={element.label ?? ""}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="property-input property-input--text"
            placeholder="Enter label..."
          />
        </div>
      )}

      <button type="button" className="delete-button" onClick={handleDelete}>
        Delete Element
      </button>
    </div>
  );
}
