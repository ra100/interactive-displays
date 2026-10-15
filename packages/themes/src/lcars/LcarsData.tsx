import type { WidgetPropsOf } from "@interactive-displays/core";
import type { CSSProperties } from "react";
import { bannerText } from "../base/BaseAlertBanner.tsx";
import { BaseGauge, gaugeTone } from "../base/BaseData.tsx";
import type { WidgetRendererProps } from "../contract.ts";
import { cascadeLines, formatValue, fractionOf, noiseFor } from "../format.ts";
import { useShowStateInfo } from "../runtime.ts";
import { lcarsCode } from "./code.ts";

// LCARS draws data the way the show's panels do: coloured blocks with black type, rows of numbers in
// several tones, and alerts as a word held between two bars.

export const LcarsReadout = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"readout">>) => (
  <div className="lcars-readout" data-tone={props.tone}>
    <span className="lcars-readout__tag">
      <span className="lcars-readout__label">{props.label}</span>
      <span className="lcars-readout__code" aria-hidden="true">
        {lcarsCode(nodeId)}
      </span>
    </span>
    <span className="lcars-readout__value">
      {formatValue(props.value, props.precision)}
      {props.unit ? <span className="lcars-readout__unit">{props.unit}</span> : null}
    </span>
  </div>
);

const BLOCKS = 12;

// A row of blocks between two caps; the arc keeps the base drawing, which already reads as a dial.
export const LcarsGauge = (renderer: WidgetRendererProps<WidgetPropsOf<"gauge">>) => {
  const { props } = renderer;
  if (props.variant === "arc") return <BaseGauge {...renderer} />;
  const fraction = fractionOf(props.value, props.min, props.max);
  const lit = Math.round(fraction * BLOCKS);
  return (
    <div className="lcars-gauge" data-variant={props.variant} data-tone={gaugeTone(props)}>
      <span className="lcars-gauge__label">{props.label}</span>
      <span className="lcars-gauge__value">
        {formatValue(props.value, props.precision)}
        {props.unit ? <span className="lcars-gauge__unit">{props.unit}</span> : null}
      </span>
      <div className="lcars-gauge__track" aria-hidden="true">
        <span className="lcars-gauge__cap" data-side="left" />
        {props.variant === "segmented" ? (
          Array.from({ length: BLOCKS }, (_, index) => (
            <span key={index} className="lcars-gauge__block" data-lit={index < lit} />
          ))
        ) : (
          <span className="lcars-gauge__bar">
            <span className="lcars-gauge__fill" style={{ transform: `scaleX(${fraction})` }} />
          </span>
        )}
        <span className="lcars-gauge__cap" data-side="right" />
      </div>
    </div>
  );
};

const CASCADE_LINES = 24;
const CASCADE_SECONDS = { slow: 30, normal: 18, fast: 8 } as const;
// The show's number columns change colour column by column; the widget's tone leads.
const COLUMN_TONES = ["primary", "secondary", "accent", "info", "neutral"] as const;

export const LcarsDataCascade = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"data-cascade">>) => {
  const next = noiseFor(nodeId);
  const tones = [props.tone, ...COLUMN_TONES.filter((tone) => tone !== props.tone)];
  return (
    <div className="lcars-data-cascade" aria-hidden="true">
      {Array.from({ length: props.columns }, (_, column) => {
        const lines = cascadeLines(nodeId, column, CASCADE_LINES);
        const style: CSSProperties = {
          animationDuration: `${(CASCADE_SECONDS[props.speed] * (0.75 + next(column) * 0.5)).toFixed(2)}s`,
          animationDelay: `-${(next(column + 50) * 12).toFixed(2)}s`,
        };
        return (
          <div key={column} className="lcars-data-cascade__column" data-tone={tones[column % tones.length]}>
            <div className="lcars-data-cascade__scroll" style={style}>
              {[...lines, ...lines].map((line, index) => (
                <span key={index} data-bright={next(column * 100 + (index % CASCADE_LINES) + 1000) > 0.88}>
                  {line}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const LcarsAlertBanner = ({ props }: WidgetRendererProps<WidgetPropsOf<"alert-banner">>) => {
  const text = bannerText(useShowStateInfo(), props.text);
  return (
    <div
      className="lcars-alert-banner"
      data-tone={props.tone}
      data-active={text !== undefined}
      role={text ? "alert" : undefined}
    >
      <span className="lcars-alert-banner__bar" aria-hidden="true" />
      {text ? <span className="lcars-alert-banner__text">{text}</span> : null}
      <span className="lcars-alert-banner__bar" aria-hidden="true" />
    </div>
  );
};
