import type { DecorProps } from "@interactive-displays/core";
import type { DecorRendererProps } from "../contract.ts";
import { noiseFor } from "../format.ts";
import type { arcs, corners, reticle, scale } from "./decor.ts";

const TICKS = Array.from({ length: 36 }, (_, index) => index * 10);

export const HudReticle = ({ props }: DecorRendererProps<DecorProps<typeof reticle>>) => (
  <div className="hud-reticle" data-tone={props.tone} data-spin={props.spin} aria-hidden="true">
    <svg viewBox="0 0 100 100">
      {Array.from({ length: props.rings }, (_, index) => (
        <circle key={index} className="hud-reticle__ring" data-ring={index} cx="50" cy="50" r={46 - index * 11} />
      ))}
      <g className="hud-reticle__ticks">
        {TICKS.map((angle) => (
          <line key={angle} x1="50" y1="2" x2="50" y2={angle % 90 === 0 ? 9 : 5} transform={`rotate(${angle} 50 50)`} />
        ))}
      </g>
      <line className="hud-reticle__cross" x1="50" y1="40" x2="50" y2="60" />
      <line className="hud-reticle__cross" x1="40" y1="50" x2="60" y2="50" />
    </svg>
  </div>
);

export const HudCorners = ({ props }: DecorRendererProps<DecorProps<typeof corners>>) => (
  <div className="hud-corners" data-tone={props.tone} aria-hidden="true">
    {(["tl", "tr", "bl", "br"] as const).map((corner) => (
      <span key={corner} className="hud-corners__corner" data-corner={corner} />
    ))}
  </div>
);

export const HudScale = ({ props }: DecorRendererProps<DecorProps<typeof scale>>) => (
  <div className="hud-scale" data-tone={props.tone} aria-hidden="true">
    <span className="hud-scale__ticks" />
    {props.label ? <span className="hud-scale__label">{props.label}</span> : null}
  </div>
);

// Each segment has its own length, start and speed, stable for the node so every display shows the same.
export const HudArcs = ({ props, nodeId }: DecorRendererProps<DecorProps<typeof arcs>>) => {
  const next = noiseFor(nodeId);
  return (
    <div className="hud-arcs" data-tone={props.tone} aria-hidden="true">
      <svg viewBox="0 0 100 100">
        {Array.from({ length: props.segments }, (_, index) => {
          const radius = 44 - index * (30 / props.segments);
          const length = 2 * Math.PI * radius;
          const share = 0.15 + next(index * 3) * 0.45;
          return (
            <g key={index} transform={`rotate(${Math.round(next(index * 3 + 2) * 360)} 50 50)`}>
              <circle
                className="hud-arcs__segment"
                cx="50"
                cy="50"
                r={radius}
                strokeDasharray={`${length * share} ${length}`}
                style={{ animationDuration: `${6 + next(index * 3 + 1) * 14}s`, animationDirection: index % 2 === 0 ? "normal" : "reverse" }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
