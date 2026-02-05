import { useDraggable } from "@dnd-kit/core";
import type { ElementType } from "@interactive-displays/shared";
import "./Palette.css";

interface PaletteItemProps {
  type: ElementType;
  label: string;
  color: string;
}

function PaletteItem({ type, label, color }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `palette-${type}`,
      data: { type, isNew: true },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className="palette-item"
      style={{ ...style, backgroundColor: color }}
      {...listeners}
      {...attributes}
    >
      <span className="palette-item-label">{label}</span>
      <span className="palette-item-type">{type}</span>
    </div>
  );
}

const PALETTE_ITEMS: PaletteItemProps[] = [
  { type: "elbow", label: "Elbow", color: "#ff9900" },
  { type: "bar", label: "Bar", color: "#ffcc99" },
  { type: "frame", label: "Frame", color: "#9999ff" },
  { type: "button", label: "Button", color: "#cc99cc" },
  { type: "text", label: "Text", color: "#ff9999" },
];

export function Palette() {
  return (
    <div className="palette">
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
}
