import { assetUrl, type VideoCommand, type WidgetPropsOf } from "@interactive-displays/core";
import { useRef } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { useMediaCommands } from "../runtime.ts";

// Commands run one after another, so a quick play-pause-restart from the operator cannot race itself.
export const BaseVideo = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"video">>) => {
  const video = useRef<HTMLVideoElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const run = async (command: VideoCommand) => {
    const element = video.current;
    if (!element) return;
    if (command === "restart") element.currentTime = 0;
    if (command === "pause" || (command === "toggle" && !element.paused)) element.pause();
    else await element.play();
  };

  useMediaCommands(nodeId, (command) => {
    queue.current = queue.current.then(() => run(command)).catch(() => undefined);
  });

  return (
    <video
      ref={video}
      className="base-video"
      src={assetUrl(props.asset)}
      autoPlay={props.autoplay}
      loop={props.loop}
      muted={props.muted}
      playsInline
      data-fit={props.fit}
    />
  );
};
