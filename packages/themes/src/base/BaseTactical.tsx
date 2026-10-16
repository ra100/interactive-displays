import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { BANK_STATE_TEXT, bankCharge, bankState, bearingText, clamp, ellipseArc, levelTone, markText } from "../instruments.ts";

// Tactical: shields by facing, weapon banks and tubes, and a targeting scanner.

// Four facings around the ship, as arcs of the shield bubble (0° is forward, clockwise).
const FACINGS = [
  { id: "forward", text: "FWD", from: -40, to: 40 },
  { id: "starboard", text: "STBD", from: 50, to: 130 },
  { id: "aft", text: "AFT", from: 140, to: 220 },
  { id: "port", text: "PORT", from: 230, to: 310 },
] as const;

// A starship seen from above: saucer forward, engineering hull, two nacelles on pylons.
export const ShipOutline = () => (
  <g className="ship-outline">
    <ellipse cx="50" cy="33" rx="17" ry="14" />
    <path d="M46.5 45 L46 72 Q50 77 54 72 L53.5 45 Z" />
    <path d="M47 62 L37 69 M53 62 L63 69" />
    <rect x="33.5" y="58" width="5" height="30" rx="2.5" />
    <rect x="61.5" y="58" width="5" height="30" rx="2.5" />
  </g>
);

export const BaseShieldStatus = ({ props }: WidgetRendererProps<WidgetPropsOf<"shield-status">>) => {
  const levels = { forward: props.forward, aft: props.aft, port: props.port, starboard: props.starboard };
  const overall = Math.round((props.forward + props.aft + props.port + props.starboard) / 4);
  const tone = (level: number) => levelTone(level, props.warningBelow, props.dangerBelow, props.tone);
  return (
    <div className="base-shields" data-tone={tone(Math.min(...Object.values(levels)))}>
      <span className="base-shields__label">{props.label}</span>
      <span className="base-shields__overall">{clamp(overall)}%</span>
      {FACINGS.map((facing) => (
        <span key={facing.id} className="base-shields__facing" data-facing={facing.id} data-tone={tone(levels[facing.id])}>
          <span className="base-shields__facing-name">{facing.text}</span>
          <span className="base-shields__facing-value">{Math.round(clamp(levels[facing.id]))}</span>
        </span>
      ))}
      <svg className="base-shields__view" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <ShipOutline />
        {FACINGS.map((facing) => {
          const level = clamp(levels[facing.id]);
          const arc = ellipseArc(50, 52, 38, 46, facing.from, facing.to);
          return (
            <g key={facing.id} data-tone={tone(level)} data-down={level < 1}>
              <path className="base-shields__track" d={arc} />
              <path className="base-shields__arc" d={arc} style={{ strokeWidth: 1 + (level / 100) * 3.5, opacity: 0.35 + (level / 100) * 0.65 }} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const CHARGE_SEGMENTS = 10;

export const BaseWeapons = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"weapons">>) => (
  <div className="base-weapons" data-tone={props.tone} data-armed={props.armed}>
    <span className="base-weapons__label">{props.label}</span>
    <div className="base-weapons__banks">
      {props.banks.map((bank, index) => {
        const charge = bankCharge(clamp(props.charge), nodeId, index);
        const state = bankState(charge, props.armed);
        const lit = Math.round((charge / 100) * CHARGE_SEGMENTS);
        return (
          <div key={index} className="base-weapons__bank" data-state={state}>
            <span className="base-weapons__name">{bank}</span>
            <span className="base-weapons__charge" aria-hidden="true">
              {Array.from({ length: CHARGE_SEGMENTS }, (_, segment) => (
                <span key={segment} className="base-weapons__cell" data-lit={segment < lit} />
              ))}
            </span>
            <span className="base-weapons__state">{BANK_STATE_TEXT[state]}</span>
          </div>
        );
      })}
    </div>
    {props.tubes > 0 ? (
      <div className="base-weapons__tubes">
        <span className="base-weapons__name">{props.ordnanceLabel}</span>
        <span className="base-weapons__pips" aria-hidden="true">
          {Array.from({ length: props.tubes }, (_, tube) => (
            <span key={tube} className="base-weapons__pip" data-loaded={props.armed && (props.ordnance ?? 1) > tube} />
          ))}
        </span>
        {props.ordnance !== undefined ? <span className="base-weapons__count">{Math.max(0, Math.round(props.ordnance))}</span> : null}
      </div>
    ) : null}
  </div>
);

export const BaseTargetLock = ({ props }: WidgetRendererProps<WidgetPropsOf<"target-lock">>) => (
  <div className="base-target" data-tone={props.tone} data-locked={props.locked}>
    <span className="base-target__label">{props.label}</span>
    <span className="base-target__status">{props.locked ? "TARGET LOCKED" : "ACQUIRING"}</span>
    <svg className="base-target__scope" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <circle className="base-target__ring" cx="50" cy="50" r="44" />
      <circle className="base-target__ring base-target__ring--inner" cx="50" cy="50" r="26" />
      <path className="base-target__cross" d="M50 2 V22 M50 78 V98 M2 50 H22 M78 50 H98" />
      <g className="base-target__blip">
        <rect x="46" y="46" width="8" height="8" rx="1.5" />
      </g>
      <g className="base-target__brackets">
        <path d="M30 40 V30 H40 M60 30 H70 V40 M70 60 V70 H60 M40 70 H30 V60" />
      </g>
    </svg>
    <dl className="base-target__data">
      {props.target ? (
        <div className="base-target__row base-target__row--name">
          <dt>TARGET</dt>
          <dd>{props.target}</dd>
        </div>
      ) : null}
      <div className="base-target__row">
        <dt>BEARING</dt>
        <dd>{bearingText(props.bearing)}</dd>
      </div>
      <div className="base-target__row">
        <dt>MARK</dt>
        <dd>{markText(props.mark)}</dd>
      </div>
      {props.range !== undefined ? (
        <div className="base-target__row">
          <dt>RANGE</dt>
          <dd>
            {Math.round(props.range).toLocaleString("en-US")}
            <span className="base-target__unit">{props.unit}</span>
          </dd>
        </div>
      ) : null}
    </dl>
  </div>
);
