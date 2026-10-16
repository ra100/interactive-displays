import type { DecorProps } from "@interactive-displays/core";
import type { CSSProperties } from "react";
import type { DecorRendererProps } from "../contract.ts";
import { lcarsCode } from "./code.ts";
import type { bar, bracket, cap, elbow, scan, segments } from "./decor.ts";

export const LcarsElbow = ({ props }: DecorRendererProps<DecorProps<typeof elbow>>) => (
  <div
    className="lcars-elbow"
    data-corner={props.corner}
    data-tone={props.tone}
    style={{ "--arm": props.arm, "--bar": props.bar } as CSSProperties}
    aria-hidden="true"
  >
    <div className="lcars-elbow__inner" />
  </div>
);

export const LcarsBar = ({ props }: DecorRendererProps<DecorProps<typeof bar>>) => (
  <div className="lcars-bar" data-caps={props.caps} data-tone={props.tone} aria-hidden="true">
    {props.code ? <span className="lcars-bar__code">{props.code}</span> : null}
  </div>
);

export const LcarsCap = ({ props }: DecorRendererProps<DecorProps<typeof cap>>) => (
  <div className="lcars-cap" data-side={props.side} data-tone={props.tone} aria-hidden="true" />
);

export const LcarsBracket = ({ props }: DecorRendererProps<DecorProps<typeof bracket>>) => (
  <div className="lcars-bracket" data-side={props.side} data-tone={props.tone} aria-hidden="true" />
);

// Uneven block lengths, the same on every render: LCARS bars are never cut into equal pieces.
const spans = (nodeId: string, count: number): number[] =>
  Array.from({ length: count }, (_, index) => 1 + (Number.parseInt(lcarsCode(`${nodeId}:${index}`).slice(-2), 10) % 4));

export const LcarsSegments = ({ props, nodeId }: DecorRendererProps<DecorProps<typeof segments>>) => (
  <div className="lcars-segments" data-direction={props.direction} data-caps={props.caps} aria-hidden="true">
    {spans(nodeId, props.count).map((span, index) => (
      <div
        key={index}
        className="lcars-segments__block"
        data-tone={props.tones[index % props.tones.length]}
        style={{ "--span": span } as CSSProperties}
      >
        {props.numbers ? <span className="lcars-segments__code">{lcarsCode(`${nodeId}:${index}`)}</span> : null}
      </div>
    ))}
  </div>
);

// Contacts sit at stable bearings and ranges derived from the node id.
const contacts = (nodeId: string, count: number) =>
  Array.from({ length: count }, (_, index) => {
    const code = lcarsCode(`${nodeId}:contact:${index}`);
    const bearing = (Number.parseInt(code.slice(3), 10) % 360) * (Math.PI / 180);
    const range = 12 + (Number.parseInt(code.slice(0, 2), 10) % 30);
    return { x: 50 + Math.sin(bearing) * range, y: 50 - Math.cos(bearing) * range, delay: (index * 0.37) % 2 };
  });

export const LcarsScan = ({ props, nodeId }: DecorRendererProps<DecorProps<typeof scan>>) => {
  const rings = Array.from({ length: props.rings }, (_, index) => (44 * (index + 1)) / props.rings);
  const ticks = Array.from({ length: 36 }, (_, index) => index * 10);
  return (
    <div className="lcars-scan" data-tone={props.tone} aria-hidden="true">
      <svg className="lcars-scan__scope" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {rings.map((radius) => (
          <circle key={radius} className="lcars-scan__ring" cx="50" cy="50" r={radius} />
        ))}
        <line className="lcars-scan__axis" x1="50" y1="4" x2="50" y2="96" />
        <line className="lcars-scan__axis" x1="4" y1="50" x2="96" y2="50" />
        {ticks.map((angle) => (
          <line
            key={angle}
            className="lcars-scan__tick"
            x1="50"
            y1={angle % 30 === 0 ? 1 : 2.5}
            x2="50"
            y2="5"
            transform={`rotate(${angle} 50 50)`}
          />
        ))}
        {props.sweep ? (
          <g className="lcars-scan__sweep">
            <path className="lcars-scan__wedge" d="M50 50 L50 6 A44 44 0 0 1 81.1 18.9 Z" />
            <line className="lcars-scan__arm" x1="50" y1="50" x2="50" y2="6" />
          </g>
        ) : null}
        {contacts(nodeId, props.contacts).map((contact, index) => (
          <rect
            key={index}
            className="lcars-scan__contact"
            x={contact.x - 1.6}
            y={contact.y - 1.6}
            width="3.2"
            height="3.2"
            rx="0.8"
            style={{ animationDelay: `${contact.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
};
