import type { CSSProperties } from "react";
import type { FrameRendererProps } from "../contract.ts";
import { panelLook } from "../panel.ts";
import { lcarsCode } from "./code.ts";

// The tones a panel's sweep, bars and column blocks are drawn from; neighbouring panels pick different ones.
const TONES = ["primary", "secondary", "accent", "info", "neutral"] as const;

/*
 * A section inside a screen with chrome of its own: a sweep from a column into a bar that carries the title, a
 * foot that closes it, or just a bracket or rails. Nesting panels is what lets LCARS shapes run through the
 * page and divide it, rather than only edging it.
 */
export const LcarsPanelFrame = ({ nodeId, variant, slots }: FrameRendererProps) => {
  const look = panelLook(variant, nodeId);
  const tone = (index: number) => TONES[Math.floor(look.pick(index) * TONES.length)] ?? "primary";
  const sweep = tone(1);
  const bar = tone(2);
  const block = tone(3);
  const style = { "--p-split": (0.55 + look.pick(4) * 0.3).toFixed(2) } as CSSProperties;
  return (
    <div className="lcars-panel" data-shape={look.shape} data-side={look.side} style={style}>
      <div className="lcars-panel__corner" data-at="top" data-tone={sweep} aria-hidden="true" />
      <div className="lcars-panel__bar" data-at="top" data-tone={bar} aria-hidden="true" />
      <div className="lcars-panel__title">{slots.title}</div>
      <div className="lcars-panel__cap" data-at="top" data-tone={bar} aria-hidden="true" />
      <div className="lcars-panel__arm" data-at="start" aria-hidden="true">
        <span className="lcars-panel__block" data-tone={sweep} />
        <span className="lcars-panel__block" data-tone={block}>
          <span className="lcars-panel__code">{lcarsCode(nodeId)}</span>
        </span>
      </div>
      <div className="lcars-panel__arm" data-at="end" data-tone={sweep} aria-hidden="true" />
      <div className="lcars-panel__main">{slots.main}</div>
      <div className="lcars-panel__corner" data-at="bottom" data-tone={sweep} aria-hidden="true" />
      <div className="lcars-panel__bar" data-at="bottom" data-tone={block} aria-hidden="true" />
      <div className="lcars-panel__status">{slots.status}</div>
      <div className="lcars-panel__cap" data-at="bottom" data-tone={block} aria-hidden="true" />
    </div>
  );
};
