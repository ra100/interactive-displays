import { memo, useRef, useCallback, useEffect, useMemo, type CSSProperties } from "react";
import type { GlobalState, VideoFit, VideoCommand } from "@interactive-displays/shared";
import { useDisplay } from "../context/DisplayContext";
import { getStateClass } from "../utils/getStateClass";

export interface VideoElementProps {
  id: string;
  src: string;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  color: string;
  globalState: GlobalState;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  fit?: VideoFit;
}

const CELL_SIZE = 60;

type InternalCommand =
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; time: number }
  | { type: "load"; src: string };

export const VideoElement = memo(function VideoElement({
  id,
  src,
  col,
  row,
  colSpan,
  rowSpan,
  color,
  globalState,
  autoplay = false,
  loop = false,
  muted = true,
  fit = "contain",
}: VideoElementProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const commandQueueRef = useRef<InternalCommand[]>([]);
  const processingRef = useRef(false);
  const disposedRef = useRef(false); // Guard against operations after unmount
  const { socket } = useDisplay();

  const style = useMemo<CSSProperties>(
    () => ({
      gridColumn: `${col + 1} / span ${colSpan}`,
      gridRow: `${row + 1} / span ${rowSpan}`,
      backgroundColor: color,
      minHeight: `${rowSpan * CELL_SIZE}px`,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    [col, colSpan, row, rowSpan, color]
  );

  const videoStyle = useMemo<CSSProperties>(
    () => ({
      width: "100%",
      height: "100%",
      objectFit: fit,
    }),
    [fit]
  );

  // Process commands sequentially to prevent race conditions
  const processQueue = useCallback(async () => {
    if (disposedRef.current || processingRef.current || commandQueueRef.current.length === 0) return;
    processingRef.current = true;

    const video = videoRef.current;
    if (!video) {
      processingRef.current = false;
      return;
    }

    const cmd = commandQueueRef.current.shift()!;

    try {
      switch (cmd.type) {
        case "play":
          await video.play();
          // Check if disposed after async operation
          if (disposedRef.current) return;
          break;
        case "pause":
          video.pause();
          break;
        case "seek":
          video.currentTime = cmd.time;
          break;
        case "load":
          video.src = cmd.src;
          video.load();
          break;
      }
    } catch (err) {
      // Don't log errors for disposed components
      if (!disposedRef.current) {
        console.error("Video command failed:", cmd, err);
      }
    }

    // Check if disposed before continuing
    if (disposedRef.current) return;

    processingRef.current = false;
    // Process next command using queueMicrotask to break potential stack buildup
    if (commandQueueRef.current.length > 0) {
      queueMicrotask(() => processQueue());
    }
  }, []);

  // Listen for WebSocket commands
  useEffect(() => {
    if (!socket) return;

    function handleCommand(data: VideoCommand) {
      if (data.elementId !== id) return;

      let cmd: InternalCommand;
      switch (data.command) {
        case "seek":
          cmd = { type: "seek", time: data.time ?? 0 };
          break;
        case "load":
          cmd = { type: "load", src: data.src ?? "" };
          break;
        default:
          cmd = { type: data.command };
      }

      commandQueueRef.current.push(cmd);
      processQueue();
    }

    socket.on("videoCommand", handleCommand);
    return () => {
      disposedRef.current = true;
      commandQueueRef.current = []; // Clear queue on unmount
      socket.off("videoCommand", handleCommand);
    };
  }, [socket, id, processQueue]);

  // Clear queue when src becomes empty
  useEffect(() => {
    if (!src) {
      commandQueueRef.current = [];
    }
  }, [src]);

  // Report state changes back to server
  const reportState = useCallback(
    (state: "playing" | "paused" | "ended") => {
      if (!socket) return;
      const video = videoRef.current;
      if (!video) return;

      socket.emit("videoState", {
        elementId: id,
        state,
        currentTime: video.currentTime,
      });
    },
    [socket, id]
  );

  const stateClass = getStateClass(globalState);

  // Show placeholder when no src
  if (!src) {
    return (
      <div
        className={`lcars-element lcars-video lcars-video--empty ${stateClass}`}
        style={style}
        data-element-id={id}
      >
        <span style={{ color: "#666", fontFamily: "Antonio, sans-serif" }}>
          NO VIDEO
        </span>
      </div>
    );
  }

  return (
    <div
      className={`lcars-element lcars-video ${stateClass}`}
      style={style}
      data-element-id={id}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoplay}
        loop={loop}
        muted={muted}
        playsInline
        style={videoStyle}
        onPlay={() => reportState("playing")}
        onPause={() => reportState("paused")}
        onEnded={() => reportState("ended")}
      />
    </div>
  );
});
