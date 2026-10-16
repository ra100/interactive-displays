import { seedOf, type WidgetPropsOf, wander } from "@interactive-displays/core";
import { type CSSProperties, useRef } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { ACTIVITY_PERIOD, cascadeLines, fractionOf, noiseFor } from "../format.ts";
import { useNow } from "../runtime.ts";

// Self-animating decoration runs on CSS animations with seeded timings: smooth, cheap on a Raspberry Pi, and
// nothing re-renders. Each bar, lamp and column gets its own period and phase so nothing moves in lockstep.

const AMPLITUDE = { still: 0, calm: 0.14, busy: 0.32 } as const;

export const BaseBarGraph = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"bar-graph">>) => {
  const next = noiseFor(nodeId);
  const amplitude = AMPLITUDE[props.activity];
  const period = ACTIVITY_PERIOD[props.activity];
  return (
    <div className="base-bar-graph" data-tone={props.tone} data-activity={props.activity}>
      {props.label ? <span className="base-bar-graph__label">{props.label}</span> : null}
      <div className="base-bar-graph__bars" aria-hidden="true">
        {Array.from({ length: props.bars }, (_, index) => {
          const level = (props.levels?.[index] ?? 30 + next(index) * 60) / 100;
          const style = {
            "--lo": Math.max(0.04, level - amplitude),
            "--hi": Math.min(1, level + amplitude),
            "--level": level,
            animationDuration: `${(period * (0.6 + next(index + 100) * 0.8)).toFixed(2)}s`,
            animationDelay: `-${(next(index + 200) * 3).toFixed(2)}s`,
          } as CSSProperties;
          return <span key={index} className="base-bar-graph__bar" style={style} />;
        })}
      </div>
    </div>
  );
};

const SAMPLE_MS = 400;

// How far the made-up history before the first live value strays from it.
const LEAD_IN_SPREAD = 0.12;

// What a bound sparkline shows before it has a history: a trace that wanders and arrives at the first value, so
// a display that has just started (or a still thumbnail) looks like it has been tracking for a while.
const leadIn = (seed: number, first: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => {
    const taper = 1 - index / count;
    const offset = (wander(seed, index * 0.12) - 0.5) * 2 * LEAD_IN_SPREAD * taper;
    return Math.min(1, Math.max(0, first + offset));
  });

// A bound sparkline traces its value over time; an unbound one draws a believable trace of its own.
export const BaseSparkline = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"sparkline">>) => {
  const now = useNow(SAMPLE_MS);
  const history = useRef<number[]>([]);
  const lastSample = useRef(0);
  const seed = seedOf(nodeId);

  let values: number[];
  if (props.value === undefined) {
    const step = now / SAMPLE_MS;
    values = Array.from({ length: props.points }, (_, index) => wander(seed, (step - props.points + index) * 0.12));
  } else {
    if (now !== lastSample.current) {
      lastSample.current = now;
      const value = fractionOf(props.value, props.min, props.max);
      const before = history.current.length > 0 ? history.current : leadIn(seed, value, props.points - 1);
      history.current = [...before, value].slice(-props.points);
    }
    values = history.current;
  }

  const points = values
    .map((value, index) => `${((index / Math.max(1, props.points - 1)) * 100).toFixed(2)},${(100 - value * 100).toFixed(2)}`)
    .join(" ");

  return (
    <div className="base-sparkline" data-tone={props.tone}>
      {props.label ? <span className="base-sparkline__label">{props.label}</span> : null}
      <svg className="base-sparkline__plot" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
};

export const BaseStatusMatrix = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"status-matrix">>) => {
  const next = noiseFor(nodeId);
  const period = ACTIVITY_PERIOD[props.activity];
  const style = { gridTemplateColumns: `repeat(${props.columns}, 1fr)` };
  return (
    <div className="base-status-matrix" data-tone={props.tone} data-activity={props.activity}>
      {props.label ? <span className="base-status-matrix__label">{props.label}</span> : null}
      <div className="base-status-matrix__grid" style={style} aria-hidden="true">
        {Array.from({ length: props.columns * props.rows }, (_, index) => {
          const roll = next(index);
          // Most lamps hold steady; some blink, a few stay dark.
          const mode = roll < 0.15 ? "off" : roll < 0.55 && period > 0 ? "blink" : "on";
          const cell = {
            animationDuration: `${(period * (1 + next(index + 300) * 3)).toFixed(2)}s`,
            animationDelay: `-${(next(index + 600) * 4).toFixed(2)}s`,
          };
          return <span key={index} className="base-status-matrix__cell" data-mode={mode} style={mode === "blink" ? cell : undefined} />;
        })}
      </div>
    </div>
  );
};

const CASCADE_LINES = 24;
const CASCADE_SECONDS = { slow: 26, normal: 15, fast: 7 } as const;

export const BaseDataCascade = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"data-cascade">>) => {
  const next = noiseFor(nodeId);
  return (
    <div className="base-data-cascade" data-tone={props.tone} aria-hidden="true">
      {Array.from({ length: props.columns }, (_, column) => {
        const lines = cascadeLines(nodeId, column, CASCADE_LINES);
        const style = {
          animationDuration: `${(CASCADE_SECONDS[props.speed] * (0.75 + next(column) * 0.5)).toFixed(2)}s`,
          animationDelay: `-${(next(column + 50) * 10).toFixed(2)}s`,
        };
        return (
          <div key={column} className="base-data-cascade__column">
            {/* Two copies, so scrolling by half loops without a seam. */}
            <div className="base-data-cascade__scroll" style={style}>
              {[...lines, ...lines].map((line, index) => (
                <span key={index} data-bright={next(column * 100 + (index % CASCADE_LINES) + 1000) > 0.85}>
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
