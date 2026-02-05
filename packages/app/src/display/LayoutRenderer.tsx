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
import { VideoElement } from "../components/VideoElement";

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
          verticalWidth={element.verticalWidth ?? 1}
          horizontalWidth={element.horizontalWidth ?? 1}
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
          leftCorner={element.leftCorner ?? "round"}
          rightCorner={element.rightCorner ?? "round"}
          onClick={() => onButtonClick?.(element.id)}
        />
      );

    case "text":
      return (
        <Text key={element.id} {...baseProps} label={element.label ?? ""} />
      );

    case "video":
      return (
        <VideoElement
          key={element.id}
          id={element.id}
          {...baseProps}
          src={element.src ?? ""}
          autoplay={element.autoplay ?? false}
          loop={element.loop ?? false}
          muted={element.muted ?? true}
          fit={element.fit ?? "contain"}
        />
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
