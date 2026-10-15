import { formatClock, type WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { formatValue, fractionOf, STATUS_TONE } from "../format.ts";
import { useNow } from "../runtime.ts";

export const BaseReadout = ({ props }: WidgetRendererProps<WidgetPropsOf<"readout">>) => (
  <div className="base-readout" data-tone={props.tone}>
    <span className="base-readout__label">{props.label}</span>
    <span className="base-readout__value">
      {formatValue(props.value, props.precision)}
      {props.unit ? <span className="base-readout__unit">{props.unit}</span> : null}
    </span>
  </div>
);

// A threshold turns the gauge danger, so a failing shield reads at a glance whatever its usual colour.
export const gaugeTone = (props: WidgetPropsOf<"gauge">) =>
  (props.dangerBelow !== undefined && props.value < props.dangerBelow) ||
  (props.dangerAbove !== undefined && props.value > props.dangerAbove)
    ? "danger"
    : props.tone;

const SEGMENTS = 20;

export const BaseGauge = ({ props }: WidgetRendererProps<WidgetPropsOf<"gauge">>) => {
  const fraction = fractionOf(props.value, props.min, props.max);
  const tone = gaugeTone(props);
  const value = (
    <span className="base-gauge__value">
      {formatValue(props.value, props.precision)}
      {props.unit ? <span className="base-gauge__unit">{props.unit}</span> : null}
    </span>
  );

  if (props.variant === "arc") {
    // A half circle of length 100, so the dash length is the percentage.
    return (
      <div className="base-gauge" data-variant="arc" data-tone={tone}>
        <svg className="base-gauge__arc" viewBox="0 0 100 56" aria-hidden="true">
          <path className="base-gauge__arc-track" d="M 8 50 A 42 42 0 0 1 92 50" pathLength={100} />
          <path
            className="base-gauge__arc-fill"
            d="M 8 50 A 42 42 0 0 1 92 50"
            pathLength={100}
            strokeDasharray={`${fraction * 100} 100`}
          />
        </svg>
        <span className="base-gauge__label">{props.label}</span>
        {value}
      </div>
    );
  }

  return (
    <div className="base-gauge" data-variant={props.variant} data-tone={tone}>
      <span className="base-gauge__label">{props.label}</span>
      {value}
      {props.variant === "segmented" ? (
        <div className="base-gauge__segments" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span key={index} className="base-gauge__segment" data-lit={index < Math.round(fraction * SEGMENTS)} />
          ))}
        </div>
      ) : (
        <div className="base-gauge__track" aria-hidden="true">
          <div className="base-gauge__fill" style={{ transform: `scaleX(${fraction})` }} />
        </div>
      )}
    </div>
  );
};

export const BaseStatusLight = ({ props }: WidgetRendererProps<WidgetPropsOf<"status-light">>) => (
  <div className="base-status-light" data-tone={STATUS_TONE[props.status]} data-status={props.status} data-blink={props.blink}>
    <span className="base-status-light__lamp" aria-hidden="true" />
    <span className="base-status-light__label">{props.label}</span>
  </div>
);

export const BaseDataGrid = ({ props }: WidgetRendererProps<WidgetPropsOf<"data-grid">>) => (
  <table className="base-data-grid" data-tone={props.tone}>
    <thead>
      <tr>
        {props.columns.map((column, index) => (
          <th key={index}>{column}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {props.rows.map((row, rowIndex) => (
        <tr key={rowIndex} data-highlight={props.highlight === rowIndex + 1}>
          {props.columns.map((_, cellIndex) => (
            <td key={cellIndex}>{row[cellIndex] ?? ""}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

export const BaseClock = ({ props }: WidgetRendererProps<WidgetPropsOf<"clock">>) => {
  const now = useNow(1000);
  return (
    <div className="base-clock" data-tone={props.tone}>
      {props.label ? <span className="base-clock__label">{props.label}</span> : null}
      <span className="base-clock__value">{formatClock(props.format, now)}</span>
    </div>
  );
};
