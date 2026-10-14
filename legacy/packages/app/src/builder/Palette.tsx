import { useDraggable, useDndContext } from "@dnd-kit/core";
import type { ElementType } from "@interactive-displays/shared";
import "./Palette.css";

interface PaletteItemProps {
  type: ElementType;
  label: string;
  color: string;
}

const PaletteItem = ({ type, label, color }: PaletteItemProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${type}`,
      data: { type, isNew: true },
    });

  // Apply transform during drag, but make element non-interactive
  const style: React.CSSProperties = {
    backgroundColor: color,
    ...(transform && {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    }),
    ...(isDragging && {
      opacity: 0.3,
      pointerEvents: "none" as const,
    }),
  };

  return (
    <div
      ref={setNodeRef}
      className="palette-item"
      style={style}
      data-element-type={type}
      {...listeners}
      {...attributes}
    >
      <span className="palette-item-label">{label}</span>
    </div>
  );
};

const PALETTE_ITEMS: PaletteItemProps[] = [
  { type: "elbow", label: "Elbow", color: "#ff9900" },
  { type: "bar", label: "Bar", color: "#ffcc99" },
  { type: "frame", label: "Frame", color: "#9999ff" },
  { type: "button", label: "Button", color: "#cc99cc" },
  { type: "text", label: "Text", color: "#ff9999" },
  { type: "video", label: "Video", color: "#666666" },
];

export const Palette = () => {
  const { active } = useDndContext();
  const isDragging = active !== null;

  return (
    <div className={`palette ${isDragging ? "palette--dragging" : ""}`}>
      <h3 className="palette-title">Elements</h3>
      <div className="palette-items">
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem
            key={item.type}
            type={item.type}
            label={item.label}
            color={item.color}
          />
        ))}
      </div>
    </div>
  );
};
