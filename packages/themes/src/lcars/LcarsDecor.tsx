import type { DecorProps } from "@interactive-displays/core";
import type { CSSProperties } from "react";
import type { DecorRendererProps } from "../contract.ts";
import type { bar, bracket, cap, elbow } from "./decor.ts";

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
