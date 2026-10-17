import type { WidgetPropsOf } from "@interactive-displays/core";
import { gaugeTone } from "../base/BaseData.tsx";
import { bannerText } from "../base/BaseAlertBanner.tsx";
import type { WidgetRendererProps } from "../contract.ts";
import { formatValue, fractionOf, STATUS_TONE } from "../format.ts";
import { usePressFlash, useShowStateInfo } from "../runtime.ts";

// In the title slot: the inverse header bar. Anywhere else: a section heading over a double rule.
export const CrtTitle = ({ props, slot }: WidgetRendererProps<WidgetPropsOf<"title">>) =>
  slot === "title" ? (
    <header className="crt-title crt-title--header" data-tone={props.tone}>
      <h1 className="crt-title__text">{props.text}</h1>
      {props.code ? <span className="crt-title__code">{props.code}</span> : null}
    </header>
  ) : (
    <header className="crt-title crt-title--section" data-tone={props.tone}>
      <h2 className="crt-title__text">{props.text}</h2>
      {props.code ? <span className="crt-title__code">{props.code}</span> : null}
    </header>
  );

export const CrtText = ({ props }: WidgetRendererProps<WidgetPropsOf<"text">>) => (
  <p className="crt-text" data-tone={props.tone} data-size={props.size}>
    {props.text}
  </p>
);

// A menu line in the nav column ("> HELM"), a bracketed key everywhere else ("[ ENGAGE ]"). Pressing inverts it.
export const CrtButton = ({ props, nodeId, slot, onUse }: WidgetRendererProps<WidgetPropsOf<"button">>) => {
  const { flashing, flash } = usePressFlash(nodeId);
  const shape = slot === "nav" ? "menu" : "key";
  return (
    <button
      type="button"
      className="crt-button"
      data-shape={shape}
      data-tone={props.tone}
      data-flash={flashing}
      onClick={() => {
        flash();
        onUse?.();
      }}
    >
      <span className="crt-button__label">{props.label}</span>
    </button>
  );
};

// LABEL ........ 12.4 UNIT
export const CrtReadout = ({ props }: WidgetRendererProps<WidgetPropsOf<"readout">>) => (
  <div className="crt-readout" data-tone={props.tone}>
    <span className="crt-readout__label">{props.label}</span>
    <span className="crt-readout__leader" aria-hidden="true" />
    <span className="crt-readout__value">
      {formatValue(props.value, props.precision)}
      {props.unit ? <span className="crt-readout__unit">{props.unit}</span> : null}
    </span>
  </div>
);

const CELLS = 24;

// A terminal bar: [████████░░░░░░] 63%. Cells are boxes rather than block characters, which the self-hosted
// fonts do not have; the variant changes their spacing (bar, segmented) or hatching (arc).
export const CrtGauge = ({ props }: WidgetRendererProps<WidgetPropsOf<"gauge">>) => {
  const lit = Math.round(fractionOf(props.value, props.min, props.max) * CELLS);
  return (
    <div className="crt-gauge" data-tone={gaugeTone(props)} data-variant={props.variant}>
      <span className="crt-gauge__label">{props.label}</span>
      <span className="crt-gauge__value">
        {formatValue(props.value, props.precision)}
        {props.unit ? <span className="crt-gauge__unit">{props.unit}</span> : null}
      </span>
      <span className="crt-gauge__bar" aria-hidden="true">
        {Array.from({ length: CELLS }, (_, index) => (
          <span key={index} className="crt-gauge__cell" data-lit={index < lit} />
        ))}
      </span>
    </div>
  );
};

const STATUS_TAG = { ok: "OK", info: "INFO", warning: "WARN", danger: "FAIL", off: "OFF" } as const;

// [ OK ] LABEL, like a boot log.
export const CrtStatusLight = ({ props }: WidgetRendererProps<WidgetPropsOf<"status-light">>) => (
  <div className="crt-status" data-tone={STATUS_TONE[props.status]} data-status={props.status} data-blink={props.blink}>
    <span className="crt-status__tag">{STATUS_TAG[props.status]}</span>
    <span className="crt-status__label">{props.label}</span>
  </div>
);

export const CrtAlertBanner = ({ props }: WidgetRendererProps<WidgetPropsOf<"alert-banner">>) => {
  const text = bannerText(useShowStateInfo(), props.text);
  return (
    <div className="crt-banner" data-tone={props.tone} data-active={text !== undefined} role={text ? "alert" : undefined}>
      {text ? <span className="crt-banner__text">*** {text} ***</span> : null}
    </div>
  );
};
