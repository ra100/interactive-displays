import type { WidgetPropsOf } from "@interactive-displays/core";
import { type CSSProperties, useId } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { ACTIVITY_PERIOD, noiseFor } from "../format.ts";
import { clamp, scanAt, spectrumLevels, wavePath } from "../instruments.ts";
import { useNow } from "../runtime.ts";

// Scans and graphs: traces, spectra, a planet under survey and a scan running. They move on CSS animations
// seeded from the node id (cheap, and frozen in still mode); the scan's percentage follows the shared ticker.

const SPEED_SECONDS = { slow: 9, normal: 5, fast: 2.4 } as const;

export const BaseWaveform = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"waveform">>) => {
  const next = noiseFor(nodeId);
  const amplitude = clamp(props.level) / 100;
  return (
    <div className="base-waveform" data-tone={props.tone} data-grid={props.grid}>
      {props.label ? <span className="base-waveform__label">{props.label}</span> : null}
      <div className="base-waveform__scope" aria-hidden="true">
        {Array.from({ length: props.traces }, (_, trace) => {
          const style: CSSProperties = {
            animationDuration: `${(SPEED_SECONDS[props.speed] * (0.8 + next(trace) * 0.6)).toFixed(2)}s`,
            animationDelay: `-${(next(trace + 10) * 5).toFixed(2)}s`,
          };
          // Later traces are quieter, so the first one leads.
          const path = wavePath(props.shape, `${nodeId}/${trace}`, amplitude * (trace === 0 ? 1 : 0.45 + next(trace + 20) * 0.35));
          return (
            <div key={trace} className="base-waveform__trace" data-trace={trace} style={style}>
              <svg viewBox="0 0 200 100" preserveAspectRatio="none">
                <path d={path} vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SPECTRUM_SWING = { still: 0, calm: 0.12, busy: 0.28 } as const;

export const BaseSpectrum = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"spectrum">>) => {
  const next = noiseFor(nodeId);
  const levels = spectrumLevels(nodeId, props.bands);
  const swing = SPECTRUM_SWING[props.activity];
  const period = ACTIVITY_PERIOD[props.activity];
  return (
    <div className="base-spectrum" data-tone={props.tone} data-activity={props.activity}>
      {props.label ? <span className="base-spectrum__label">{props.label}</span> : null}
      <div className="base-spectrum__bands" aria-hidden="true">
        {levels.map((level, index) => {
          const style = {
            "--lo": Math.max(0.03, level - swing),
            "--hi": Math.min(1, level + swing),
            "--level": level,
            animationDuration: `${(period * (0.5 + next(index + 100) * 0.9)).toFixed(2)}s`,
            animationDelay: `-${(next(index + 200) * 3).toFixed(2)}s`,
          } as CSSProperties;
          return (
            <span key={index} className="base-spectrum__band" style={style}>
              <span className="base-spectrum__bar" />
              {props.peaks ? <span className="base-spectrum__peak" /> : null}
            </span>
          );
        })}
      </div>
      <div className="base-spectrum__ruler" aria-hidden="true">
        <span>{props.from ?? ""}</span>
        <span>{props.to ?? ""}</span>
      </div>
    </div>
  );
};

const PARALLELS = [-60, -30, 0, 30, 60];
const MERIDIANS = 6;
const GLOBE_SECONDS = { slow: 24, normal: 14, fast: 7 } as const;

export const BaseGlobe = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"globe">>) => {
  const clip = `globe-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const next = noiseFor(nodeId);
  const turn = GLOBE_SECONDS[props.speed];
  const sites = Array.from({ length: props.sites }, (_, index) => {
    // On the near side, away from the rim, so they read as on the surface.
    const latitude = (next(index * 2) - 0.5) * 100;
    const longitude = (next(index * 2 + 1) - 0.5) * 110;
    const x = 50 + Math.sin((longitude * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180) * 44;
    const y = 50 - Math.sin((latitude * Math.PI) / 180) * 44;
    return { x, y };
  });
  return (
    <div className="base-globe" data-tone={props.tone}>
      {props.label ? <span className="base-globe__label">{props.label}</span> : null}
      <svg className="base-globe__planet" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <circle cx="50" cy="50" r="44" />
          </clipPath>
        </defs>
        <circle className="base-globe__disc" cx="50" cy="50" r="44" />
        {PARALLELS.map((latitude) => {
          const radians = (latitude * Math.PI) / 180;
          const rx = Math.cos(radians) * 44;
          return (
            <ellipse key={latitude} className="base-globe__line" cx="50" cy={50 - Math.sin(radians) * 44} rx={rx} ry={rx * 0.14} />
          );
        })}
        {Array.from({ length: MERIDIANS }, (_, index) => (
          <ellipse
            key={index}
            className="base-globe__meridian"
            cx="50"
            cy="50"
            rx="44"
            ry="44"
            style={{ animationDuration: `${turn}s`, animationDelay: `-${((index / MERIDIANS) * turn).toFixed(2)}s` }}
          />
        ))}
        <circle className="base-globe__rim" cx="50" cy="50" r="44" />
        {props.scan ? (
          <g clipPath={`url(#${clip})`}>
            <rect className="base-globe__scan" x="4" y="48" width="92" height="4" style={{ animationDuration: `${(turn / 3).toFixed(2)}s` }} />
          </g>
        ) : null}
        {sites.map((site, index) => (
          <path
            key={index}
            className="base-globe__site"
            d={`M${site.x.toFixed(2)} ${(site.y - 2.4).toFixed(2)} l2.4 2.4 l-2.4 2.4 l-2.4 -2.4 Z`}
            style={{ animationDelay: `-${(next(index + 40) * 2).toFixed(2)}s` }}
          />
        ))}
      </svg>
    </div>
  );
};

const SCAN_SEGMENTS = 20;

export const BaseScanProgress = ({ props, nodeId }: WidgetRendererProps<WidgetPropsOf<"scan-progress">>) => {
  const now = useNow(props.value === undefined ? 250 : null);
  const value = clamp(props.value ?? scanAt(now, props.seconds, nodeId));
  const done = value >= 100;
  const lit = Math.floor((value / 100) * SCAN_SEGMENTS);
  return (
    <div className="base-scan" data-tone={props.tone} data-done={done}>
      <span className="base-scan__label">{done ? props.done : props.label}</span>
      <span className="base-scan__value">{Math.floor(value)}%</span>
      <div className="base-scan__track" aria-hidden="true">
        {Array.from({ length: SCAN_SEGMENTS }, (_, index) => (
          <span key={index} className="base-scan__segment" data-lit={index < lit} data-head={!done && index === lit} />
        ))}
      </div>
    </div>
  );
};
