import { useCallback, useState, useEffect } from "react";
import type { LayoutElement, ElbowDirection, BarOrientation, VideoFit, CornerStyle, CapStyle, VideoState } from "@interactive-displays/shared";
import { useBuilder } from "./BuilderContext";
import { useDisplay } from "../context/DisplayContext";
import "./PropertyPanel.css";

// URL validation - only allow safe protocols to prevent XSS
function isValidVideoUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (shows placeholder)
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "blob:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

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

const VIDEO_FITS: { label: string; value: VideoFit }[] = [
  { label: "Contain", value: "contain" },
  { label: "Cover", value: "cover" },
  { label: "Fill", value: "fill" },
];

const CORNER_STYLES: { label: string; value: CornerStyle }[] = [
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
];

const CAP_STYLES: { label: string; value: CapStyle }[] = [
  { label: "Round", value: "round" },
  { label: "Square", value: "square" },
  { label: "Pointed", value: "pointed" },
];

export function PropertyPanel() {
  const { selectedElement, updateElement, deleteElement, selectedElementId } =
    useBuilder();
  const { sendVideoCommand, subscribeToVideoCommands } = useDisplay();

  const element = selectedElement;
  const [srcError, setSrcError] = useState<string | null>(null);
  const [videoState, setVideoState] = useState<VideoState>("paused");

  // Subscribe to video commands to track playback state
  useEffect(() => {
    if (!selectedElementId || element?.type !== "video") return;

    const unsubscribe = subscribeToVideoCommands((command) => {
      if (command.elementId !== selectedElementId) return;
      if (command.command === "play") setVideoState("playing");
      if (command.command === "pause") setVideoState("paused");
    });

    return unsubscribe;
  }, [selectedElementId, element?.type, subscribeToVideoCommands]);

  // Reset video state when element changes
  useEffect(() => {
    setVideoState("paused");
  }, [selectedElementId]);

  const handlePlayPause = useCallback(() => {
    if (!selectedElementId || element?.type !== "video") return;
    const command = videoState === "playing" ? "pause" : "play";
    sendVideoCommand({ elementId: selectedElementId, command });
    setVideoState(command === "play" ? "playing" : "paused");
  }, [selectedElementId, element?.type, videoState, sendVideoCommand]);

  // Generic field update handler - works for string, enum, and boolean fields
  const updateField = useCallback(
    <K extends keyof LayoutElement>(field: K, value: LayoutElement[K]) => {
      if (selectedElementId) {
        updateElement(selectedElementId, { [field]: value } as Partial<LayoutElement>);
      }
    },
    [selectedElementId, updateElement]
  );

  // Numeric field handler with validation
  const updateNumericField = useCallback(
    (field: keyof LayoutElement, value: number, min = 0) => {
      if (selectedElementId && !Number.isNaN(value) && value >= min) {
        updateElement(selectedElementId, { [field]: value } as Partial<LayoutElement>);
      }
    },
    [selectedElementId, updateElement]
  );

  // Video URL handler with protocol validation
  const handleSrcChange = useCallback(
    (src: string) => {
      if (selectedElementId) {
        if (isValidVideoUrl(src)) {
          setSrcError(null);
          updateElement(selectedElementId, { src });
        } else {
          setSrcError("URL must use http, https, or blob protocol");
        }
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
        <label className="property-group-label">Color</label>
        <div className="color-picker">
          {LCARS_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className={`color-swatch ${element.color === color.value ? "color-swatch--selected" : ""}`}
              style={{ backgroundColor: color.value }}
              onClick={() => updateField("color", color.value)}
              title={color.name}
            />
          ))}
        </div>
      </div>

      <div className="property-group">
        <label className="property-group-label">Position</label>
        <div className="property-row">
          <div className="property-field">
            <span className="property-field-label">Col</span>
            <input
              type="number"
              min={0}
              max={11}
              value={element.col}
              onChange={(e) => updateNumericField("col", parseInt(e.target.value, 10))}
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
              onChange={(e) => updateNumericField("row", parseInt(e.target.value, 10))}
              className="property-input"
            />
          </div>
        </div>
      </div>

      <div className="property-group">
        <label className="property-group-label">Size</label>
        <div className="property-row">
          <div className="property-field">
            <span className="property-field-label">Width</span>
            <input
              type="number"
              min={1}
              max={12}
              value={element.colSpan}
              onChange={(e) => updateNumericField("colSpan", parseInt(e.target.value, 10), 1)}
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
              onChange={(e) => updateNumericField("rowSpan", parseInt(e.target.value, 10), 1)}
              className="property-input"
            />
          </div>
        </div>
      </div>

      {element.type === "elbow" && (
        <>
          <div className="property-group">
            <label className="property-group-label">Direction</label>
            <select
              value={element.direction ?? "TL"}
              onChange={(e) => updateField("direction", e.target.value as ElbowDirection)}
              className="property-select"
            >
              {ELBOW_DIRECTIONS.map((dir) => (
                <option key={dir.value} value={dir.value}>
                  {dir.label}
                </option>
              ))}
            </select>
          </div>

          <div className="property-group">
            <label className="property-group-label">Arm Widths</label>
            <div className="property-row">
              <div className="property-field">
                <span className="property-field-label">Vertical</span>
                <input
                  type="number"
                  min={1}
                  max={element.colSpan}
                  value={element.verticalWidth ?? 1}
                  onChange={(e) => updateNumericField("verticalWidth", parseInt(e.target.value, 10), 1)}
                  className="property-input"
                />
              </div>
              <div className="property-field">
                <span className="property-field-label">Horizontal</span>
                <input
                  type="number"
                  min={1}
                  max={element.rowSpan}
                  value={element.horizontalWidth ?? 1}
                  onChange={(e) => updateNumericField("horizontalWidth", parseInt(e.target.value, 10), 1)}
                  className="property-input"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {element.type === "bar" && (
        <>
          <div className="property-group">
            <label className="property-group-label">Orientation</label>
            <select
              value={element.orientation ?? "horizontal"}
              onChange={(e) => updateField("orientation", e.target.value as BarOrientation)}
              className="property-select"
            >
              {BAR_ORIENTATIONS.map((orient) => (
                <option key={orient.value} value={orient.value}>
                  {orient.label}
                </option>
              ))}
            </select>
          </div>

          <div className="property-group">
            <label className="property-group-label">End Caps</label>
            <div className="property-row">
              <div className="property-field">
                <span className="property-field-label">
                  {element.orientation === "vertical" ? "Top" : "Left"}
                </span>
                <select
                  value={element.startCap ?? "round"}
                  onChange={(e) => updateField("startCap", e.target.value as CapStyle)}
                  className="property-select"
                >
                  {CAP_STYLES.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-field">
                <span className="property-field-label">
                  {element.orientation === "vertical" ? "Bottom" : "Right"}
                </span>
                <select
                  value={element.endCap ?? "round"}
                  onChange={(e) => updateField("endCap", e.target.value as CapStyle)}
                  className="property-select"
                >
                  {CAP_STYLES.map((style) => (
                    <option key={style.value} value={style.value}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      {(element.type === "button" || element.type === "text") && (
        <div className="property-group">
          <label className="property-group-label">Label</label>
          <input
            type="text"
            value={element.label ?? ""}
            onChange={(e) => updateField("label", e.target.value)}
            className="property-input property-input--text"
            placeholder="Enter label..."
          />
        </div>
      )}

      {element.type === "button" && (
        <div className="property-group">
          <label className="property-group-label">Corner Styles</label>
          <div className="property-row">
            <div className="property-field">
              <span className="property-field-label">Left</span>
              <select
                value={element.leftCorner ?? "round"}
                onChange={(e) => updateField("leftCorner", e.target.value as CornerStyle)}
                className="property-select"
              >
                {CORNER_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="property-field">
              <span className="property-field-label">Right</span>
              <select
                value={element.rightCorner ?? "round"}
                onChange={(e) => updateField("rightCorner", e.target.value as CornerStyle)}
                className="property-select"
              >
                {CORNER_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {element.type === "video" && (
        <>
          <div className="property-group">
            <label className="property-group-label">Video URL</label>
            <input
              type="text"
              value={element.src ?? ""}
              onChange={(e) => handleSrcChange(e.target.value)}
              className={`property-input property-input--text ${srcError ? "property-input--error" : ""}`}
              placeholder="Enter video URL..."
            />
            {srcError && <span className="property-error">{srcError}</span>}
          </div>

          <div className="property-group">
            <label className="property-group-label">Fit</label>
            <select
              value={element.fit ?? "contain"}
              onChange={(e) => updateField("fit", e.target.value as VideoFit)}
              className="property-select"
            >
              {VIDEO_FITS.map((fit) => (
                <option key={fit.value} value={fit.value}>
                  {fit.label}
                </option>
              ))}
            </select>
          </div>

          <div className="property-group">
            <label className="property-group-label">Options</label>
            <div className="property-checkboxes">
              <label className="property-checkbox">
                <input
                  type="checkbox"
                  checked={element.muted ?? true}
                  onChange={(e) => updateField("muted", e.target.checked)}
                />
                Muted
              </label>
              <label className="property-checkbox">
                <input
                  type="checkbox"
                  checked={element.loop ?? false}
                  onChange={(e) => updateField("loop", e.target.checked)}
                />
                Loop
              </label>
              <label className="property-checkbox">
                <input
                  type="checkbox"
                  checked={element.autoplay ?? false}
                  onChange={(e) => updateField("autoplay", e.target.checked)}
                />
                Autoplay
              </label>
            </div>
          </div>

          {element.src && (
            <div className="property-group">
              <label className="property-group-label">Playback</label>
              <button
                type="button"
                className={`playback-button ${videoState === "playing" ? "playback-button--playing" : ""}`}
                onClick={handlePlayPause}
              >
                {videoState === "playing" ? "PAUSE" : "PLAY"}
              </button>
            </div>
          )}
        </>
      )}

      <button type="button" className="delete-button" onClick={handleDelete}>
        Delete Element
      </button>
    </div>
  );
}
