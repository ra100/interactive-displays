// Shared types - imported by app via relative path

export type GlobalState = "normal" | "alert" | "active" | "damaged";

export type ElementType = "elbow" | "bar" | "frame" | "button" | "text";

export type ElbowDirection = "TL" | "TR" | "BL" | "BR";

export type BarOrientation = "horizontal" | "vertical";

export interface LayoutElement {
  id: string;
  type: ElementType;
  col: number; // 0-11 grid column
  row: number; // grid row
  colSpan: number; // width in columns
  rowSpan: number; // height in rows
  color: string;
  // Type-specific props
  direction?: ElbowDirection; // elbow only
  orientation?: BarOrientation; // bar only
  label?: string; // button, text
}

export interface Layout {
  id: string;
  name: string;
  elements: LayoutElement[];
}

// Socket.io event payloads
export interface ServerToClientEvents {
  state: (state: GlobalState) => void;
  layout: (layout: Layout) => void;
  connectedScreens: (screens: string[]) => void;
}

export interface ClientToServerEvents {
  identify: (screenId: string) => void;
  stateChange: (state: GlobalState) => void;
  saveLayout: (layout: Layout) => void;
  getLayout: (layoutId: string) => void;
}
