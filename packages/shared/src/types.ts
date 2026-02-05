// Shared types for interactive display system

export type GlobalState = "normal" | "alert" | "active" | "damaged";

export type ElementType = "elbow" | "bar" | "frame" | "button" | "text" | "video";

export type ElbowDirection = "TL" | "TR" | "BL" | "BR";

export type BarOrientation = "horizontal" | "vertical";

export type VideoFit = "contain" | "cover" | "fill";

export type CornerStyle = "round" | "square";

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
  verticalWidth?: number; // elbow only: width of vertical arm (default: 1)
  horizontalWidth?: number; // elbow only: width of horizontal arm (default: 1)
  orientation?: BarOrientation; // bar only
  label?: string; // button, text
  leftCorner?: CornerStyle; // button only (default: 'round')
  rightCorner?: CornerStyle; // button only (default: 'round')
  // Video props
  src?: string; // video only
  autoplay?: boolean; // video only
  loop?: boolean; // video only
  muted?: boolean; // video only
  fit?: VideoFit; // video only
}

export interface Layout {
  id: string;
  name: string;
  elements: LayoutElement[];
}

// Video control types
export type VideoCommandType = "play" | "pause" | "seek" | "load";

export interface VideoCommand {
  elementId: string;
  command: VideoCommandType;
  time?: number; // for seek
  src?: string; // for load
}

export type VideoState = "playing" | "paused" | "ended";

export interface VideoStateUpdate {
  elementId: string;
  state: VideoState;
  currentTime: number;
}

// Socket.io event payloads
export interface ServerToClientEvents {
  state: (state: GlobalState) => void;
  layout: (layout: Layout) => void;
  error: (code: string, message: string) => void;
  videoCommand: (command: VideoCommand) => void;
}

export interface ClientToServerEvents {
  identify: (screenId: string) => void;
  stateChange: (state: GlobalState) => void;
  saveLayout: (layout: Layout) => void;
  getLayout: (layoutId: string) => void;
  videoCommand: (command: VideoCommand) => void;
  videoState: (state: VideoStateUpdate) => void;
}
