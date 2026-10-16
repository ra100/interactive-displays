import type { WidgetPropsOf } from "@interactive-displays/core";
import type { CSSProperties } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { formatValue, noiseFor } from "../format.ts";
import { alongCourse, bearingText, clamp, coursePoints, markText, starField } from "../instruments.ts";

// Navigation and propulsion: heading, the speed ladder, a star chart with the plotted course, and the reactor
// column that drives it all.

// Degrees either side of the heading that the tape shows.
const TAPE_SPAN = 60;

export const headingTicks = (bearing: number) => {
  const first = Math.ceil((bearing - TAPE_SPAN) / 5) * 5;
  return Array.from({ length: Math.floor((TAPE_SPAN * 2) / 5) + 1 }, (_, index) => first + index * 5)
    .filter((degrees) => degrees <= bearing + TAPE_SPAN)
    .map((degrees) => ({
      degrees,
      left: ((degrees - (bearing - TAPE_SPAN)) / (TAPE_SPAN * 2)) * 100,
      major: degrees % 30 === 0,
      label: degrees % 30 === 0 ? bearingText(degrees) : undefined,
    }));
};

export const BaseHeading = ({ props }: WidgetRendererProps<WidgetPropsOf<"heading">>) => {
  const value = (
    <span className="base-heading__value">
      <span className="base-heading__bearing">{bearingText(props.bearing)}</span>
      <span className="base-heading__mark-word">MARK</span>
      <span className="base-heading__mark">{markText(props.mark)}</span>
    </span>
  );
  if (props.variant === "rose") {
    const ticks = Array.from({ length: 36 }, (_, index) => index * 10);
    return (
      <div className="base-heading" data-variant="rose" data-tone={props.tone}>
        <span className="base-heading__label">{props.label}</span>
        <svg className="base-heading__rose" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <circle className="base-heading__dial" cx="50" cy="50" r="42" />
          <g className="base-heading__card" style={{ transform: `rotate(${-props.bearing}deg)` }}>
            {ticks.map((degrees) => (
              <line
                key={degrees}
                className="base-heading__tick"
                data-major={degrees % 90 === 0}
                x1="50"
                y1={degrees % 90 === 0 ? 8 : degrees % 30 === 0 ? 10 : 12}
                x2="50"
                y2="16"
                transform={`rotate(${degrees} 50 50)`}
              />
            ))}
            {[0, 90, 180, 270].map((degrees) => (
              <text key={degrees} className="base-heading__rose-label" x="50" y="25" transform={`rotate(${degrees} 50 50)`}>
                {bearingText(degrees)}
              </text>
            ))}
          </g>
          <path className="base-heading__needle" d="M50 6 L54 16 L46 16 Z M50 30 V70" />
          <circle className="base-heading__hub" cx="50" cy="50" r="2.5" />
        </svg>
        {value}
      </div>
    );
  }
  return (
    <div className="base-heading" data-variant="tape" data-tone={props.tone}>
      <span className="base-heading__label">{props.label}</span>
      {value}
      <div className="base-heading__tape" aria-hidden="true">
        {headingTicks(props.bearing).map((tick) => (
          <span key={tick.degrees} className="base-heading__notch" data-major={tick.major} style={{ left: `${tick.left}%` }}>
            {tick.label ? <span className="base-heading__notch-label">{tick.label}</span> : null}
          </span>
        ))}
        <span className="base-heading__pointer" />
      </div>
    </div>
  );
};

export const BaseSpeedLadder = ({ props }: WidgetRendererProps<WidgetPropsOf<"speed-ladder">>) => {
  const value = clamp(props.value, 0, props.steps);
  const tone = props.dangerAbove !== undefined && props.value > props.dangerAbove ? "danger" : props.tone;
  const current = Math.ceil(value);
  return (
    <div className="base-ladder" data-tone={tone} data-direction={props.direction}>
      <span className="base-ladder__label">{props.label}</span>
      <span className="base-ladder__value">{formatValue(value, props.precision)}</span>
      <div className="base-ladder__steps" aria-hidden="true">
        {Array.from({ length: props.steps }, (_, index) => {
          const step = index + 1;
          const style = { "--rung": step / props.steps } as CSSProperties;
          return (
            <span
              key={step}
              className="base-ladder__step"
              data-lit={step <= value || (step === current && value > 0)}
              data-current={step === current && value > 0}
              style={style}
            >
              <span className="base-ladder__number">{step}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const BaseStarChart = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"star-chart">>) => {
  const course = coursePoints(nodeId, props.waypoints);
  const ship = alongCourse(course, clamp(props.progress) / 100);
  const travelled = [...course.slice(0, ship.leg + 1), ship];
  const ahead = [ship, ...course.slice(ship.leg + 1)];
  const line = (points: readonly { x: number; y: number }[]) => points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const last = course[course.length - 1];
  const next = noiseFor(nodeId);
  return (
    <div className="base-chart" data-tone={props.tone} data-grid={props.grid}>
      {props.label ? <span className="base-chart__label">{props.label}</span> : null}
      <svg className="base-chart__map" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {props.grid
          ? Array.from({ length: 9 }, (_, index) => (index + 1) * 10).map((at) => (
              <g key={at} className="base-chart__grid">
                <line x1={at} y1="0" x2={at} y2="100" />
                <line x1="0" y1={at} x2="100" y2={at} />
              </g>
            ))
          : null}
        {starField(nodeId, props.stars).map((star, index) => (
          <circle key={index} className="base-chart__star" data-bright={star.bright} cx={star.x} cy={star.y} r={star.size} />
        ))}
        <polyline className="base-chart__course" data-part="travelled" points={line(travelled)} vectorEffect="non-scaling-stroke" />
        <polyline className="base-chart__course" data-part="ahead" points={line(ahead)} vectorEffect="non-scaling-stroke" />
        {course.map((point, index) => (
          <g key={index} className="base-chart__waypoint" data-passed={index <= ship.leg}>
            <rect x={point.x - 1} y={point.y - 1} width="2" height="2" transform={`rotate(45 ${point.x} ${point.y})`} />
            <text x={point.x + 2} y={point.y - 1.6}>
              {index === course.length - 1 && props.destination ? props.destination : `WP ${index + 1}`}
            </text>
          </g>
        ))}
        {last ? <circle className="base-chart__target" cx={last.x} cy={last.y} r={2.6 + next(1)} /> : null}
        <path
          className="base-chart__ship"
          d="M3 0 L-2 -2 L-1 0 L-2 2 Z"
          transform={`translate(${ship.x.toFixed(2)} ${ship.y.toFixed(2)}) rotate(${ship.angle.toFixed(1)}) scale(0.8)`}
        />
      </svg>
    </div>
  );
};

const PULSE_SECONDS = { slowest: 2.8, fastest: 0.7 } as const;

export const BaseReactor = ({ props }: WidgetRendererProps<WidgetPropsOf<"reactor">>) => {
  const level = clamp(props.level) / 100;
  const period = PULSE_SECONDS.slowest - (PULSE_SECONDS.slowest - PULSE_SECONDS.fastest) * level;
  const middle = (props.segments - 1) / 2;
  const style = { "--glow": (0.35 + level * 0.65).toFixed(2) } as CSSProperties;
  return (
    <div className="base-reactor" data-tone={props.tone} data-direction={props.direction} style={style}>
      {props.label ? <span className="base-reactor__label">{props.label}</span> : null}
      <div className="base-reactor__column" aria-hidden="true">
        {Array.from({ length: props.segments }, (_, index) => {
          const distance = Math.abs(index - middle) / Math.max(1, middle);
          // Light runs from both ends into the chamber in the middle.
          const delay = (1 - distance) * period * 0.5;
          return (
            <span
              key={index}
              className="base-reactor__segment"
              data-chamber={Math.abs(index - middle) < 1}
              style={{ animationDuration: `${period.toFixed(2)}s`, animationDelay: `${delay.toFixed(2)}s` }}
            />
          );
        })}
      </div>
    </div>
  );
};
