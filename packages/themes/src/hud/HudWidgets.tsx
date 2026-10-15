import type { WidgetPropsOf } from "@interactive-displays/core";
import { bannerText } from "../base/BaseAlertBanner.tsx";
import { gaugeTone } from "../base/BaseData.tsx";
import type { WidgetRendererProps } from "../contract.ts";
import { formatValue, fractionOf, STATUS_TONE } from "../format.ts";
import { usePressFlash, useShowStateInfo } from "../runtime.ts";

// In the title slot: large thin type with its code on a tab. Elsewhere: a section label over a short rule.
export const HudTitle = ({ props, slot }: WidgetRendererProps<WidgetPropsOf<"title">>) =>
  slot === "title" ? (
    <header className="hud-title hud-title--header" data-tone={props.tone}>
      <h1 className="hud-title__text">{props.text}</h1>
      {props.code ? <span className="hud-title__code">{props.code}</span> : null}
    </header>
  ) : (
    <header className="hud-title hud-title--section" data-tone={props.tone}>
      <h2 className="hud-title__text">{props.text}</h2>
      {props.code ? <span className="hud-title__code">{props.code}</span> : null}
    </header>
  );

export const HudText = ({ props }: WidgetRendererProps<WidgetPropsOf<"text">>) => (
  <p className="hud-text" data-tone={props.tone} data-size={props.size}>
    {props.text}
  </p>
);

// A chamfered outline that fills with light when pressed. In the nav it is a tab with a marker on its left edge.
export const HudButton = ({ props, slot, onUse }: WidgetRendererProps<WidgetPropsOf<"button">>) => {
  const { flashing, flash } = usePressFlash();
  return (
    <button
      type="button"
      className="hud-button"
      data-shape={slot === "nav" ? "tab" : "chamfer"}
      data-tone={props.tone}
      data-flash={flashing}
      onClick={() => {
        flash();
        onUse?.();
      }}
    >
      <span className="hud-button__label">{props.label}</span>
    </button>
  );
};

// A small label over a large thin number.
export const HudReadout = ({ props }: WidgetRendererProps<WidgetPropsOf<"readout">>) => (
  <div className="hud-readout" data-tone={props.tone}>
    <span className="hud-readout__label">{props.label}</span>
    <span className="hud-readout__value">
      {formatValue(props.value, props.precision)}
      {props.unit ? <span className="hud-readout__unit">{props.unit}</span> : null}
    </span>
  </div>
);

const RING = 2 * Math.PI * 42;
const SWEEP = 0.75;

// The arc variant is a three-quarter ring with the value in its middle; bar and segmented are a thin track with
// tick marks under the number.
export const HudGauge = ({ props }: WidgetRendererProps<WidgetPropsOf<"gauge">>) => {
  const fraction = fractionOf(props.value, props.min, props.max);
  const value = (
    <span className="hud-gauge__value">
      {formatValue(props.value, props.precision)}
      {props.unit ? <span className="hud-gauge__unit">{props.unit}</span> : null}
    </span>
  );
  if (props.variant === "arc") {
    return (
      <div className="hud-gauge hud-gauge--ring" data-tone={gaugeTone(props)} data-variant="arc">
        <svg className="hud-gauge__ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="hud-gauge__track" cx="50" cy="50" r="42" strokeDasharray={`${RING * SWEEP} ${RING}`} />
          {fraction > 0 ? (
            <circle className="hud-gauge__fill" cx="50" cy="50" r="42" strokeDasharray={`${RING * SWEEP * fraction} ${RING}`} />
          ) : null}
        </svg>
        <span className="hud-gauge__center">
          {value}
          <span className="hud-gauge__label">{props.label}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="hud-gauge hud-gauge--line" data-tone={gaugeTone(props)} data-variant={props.variant}>
      <span className="hud-gauge__label">{props.label}</span>
      {value}
      <span className="hud-gauge__track-line" aria-hidden="true">
        <span className="hud-gauge__fill-line" style={{ inlineSize: `${fraction * 100}%` }} />
      </span>
    </div>
  );
};

// A hollow diamond that fills and glows with the status's tone.
export const HudStatusLight = ({ props }: WidgetRendererProps<WidgetPropsOf<"status-light">>) => (
  <div className="hud-status" data-tone={STATUS_TONE[props.status]} data-status={props.status} data-blink={props.blink}>
    <span className="hud-status__diamond" aria-hidden="true" />
    <span className="hud-status__label">{props.label}</span>
  </div>
);

export const HudAlertBanner = ({ props }: WidgetRendererProps<WidgetPropsOf<"alert-banner">>) => {
  const text = bannerText(useShowStateInfo(), props.text);
  return (
    <div className="hud-banner" data-tone={props.tone} data-active={text !== undefined} role={text ? "alert" : undefined}>
      {text ? <span className="hud-banner__text">{text}</span> : null}
    </div>
  );
};
