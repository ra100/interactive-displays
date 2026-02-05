import { memo } from "react";
import type {
  Layout,
  LayoutElement,
  GlobalState,
} from "@interactive-displays/shared";
import { Elbow } from "../components/Elbow";
import { Bar } from "../components/Bar";
import { Frame } from "../components/Frame";
import { Button } from "../components/Button";
import { Text } from "../components/Text";

interface LayoutRendererProps {
  layout: Layout;
  globalState: GlobalState;
  onButtonClick?: (elementId: string) => void;
}

interface ElementRendererProps {
  element: LayoutElement;
  globalState: GlobalState;
  onButtonClick: ((elementId: string) => void) | undefined;
}

const ElementRenderer = memo(function ElementRenderer({
  element,
  globalState,
  onButtonClick,
}: ElementRendererProps) {
  const baseProps = {
    col: element.col,
    row: element.row,
    colSpan: element.colSpan,
    rowSpan: element.rowSpan,
    color: element.color,
    globalState,
  };

  switch (element.type) {
    case "elbow":
      return (
        <Elbow
          key={element.id}
          {...baseProps}
          direction={element.direction ?? "TL"}
        />
      );

    case "bar":
      return (
        <Bar
          key={element.id}
          {...baseProps}
          orientation={element.orientation ?? "horizontal"}
        />
      );

    case "frame":
      return <Frame key={element.id} {...baseProps} />;

    case "button":
      return (
        <Button
          key={element.id}
          {...baseProps}
          label={element.label ?? "BUTTON"}
          onClick={() => onButtonClick?.(element.id)}
        />
      );

    case "text":
      return (
        <Text key={element.id} {...baseProps} label={element.label ?? ""} />
      );

    default:
      // Fallback for unknown element types
      return null;
  }
});

export const LayoutRenderer = memo(function LayoutRenderer({
  layout,
  globalState,
  onButtonClick,
}: LayoutRendererProps) {
  return (
    <>
      {layout.elements.map((element) => (
        <ElementRenderer
          key={element.id}
          element={element}
          globalState={globalState}
          onButtonClick={onButtonClick}
        />
      ))}
    </>
  );
});
