import type { WidgetPropsOf } from "@interactive-displays/core";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import type { WidgetRendererProps } from "../contract.ts";
import { clamp, levelTone } from "../instruments.ts";
import { useNow, useStill } from "../runtime.ts";
import {
  type Fit,
  type FlatLayout,
  flatLayout,
  type PartState,
  projectTurn,
  stateTone,
  systemState,
  taggedSystems,
  turnGeometry,
  turnHull,
  turnFont,
  turnPolyline,
  turnShield,
  turnTags,
} from "../ships/layout.ts";
import { type FlatView, type Ship, type ShipPart, ships } from "../ships/model.ts";

// A ship's line art traced from its model: from above, the side or the front, or turning in three dimensions.
// The mode decides what is marked on it: weapons and the shield bubble, the warp core and power flowing from it,
// or damaged and offline systems.

type ShipProps = WidgetPropsOf<"ship-schematic">;

const VIEW_NAMES: Record<ShipProps["view"], string> = { top: "DORSAL", side: "PORT PROFILE", front: "FORWARD", turn: "ROTATION" };

// Seen from ahead and a little to port when the turning view stands still.
const RESTING_YAW = (-35 * Math.PI) / 180;

const FLOW_TONE = "accent";

interface Readout {
  key: string;
  text: string;
  tone?: string;
}

const readouts = (ship: Ship, props: ShipProps): Readout[] => {
  const percent = (value: number) => `${Math.round(clamp(value))}%`;
  switch (props.mode) {
    case "schematic":
      return [
        { key: "length", text: `LENGTH ${Math.round(ship.size.length)} M` },
        { key: "beam", text: `BEAM ${Math.round(ship.size.beam)} M` },
        { key: "decks", text: `${ship.decks} DECKS` },
      ];
    case "tactical":
      return [
        { key: "shields", text: `SHIELDS ${percent(props.shields)}`, tone: levelTone(props.shields, 50, 25, props.tone) },
        props.armed ? { key: "weapons", text: "WEAPONS ARMED", tone: "danger" } : { key: "weapons", text: "WEAPONS STANDBY" },
      ];
    case "engineering": {
      const core = systemState("warp-core", props);
      const down = core === "damaged" || core === "offline" || props.power < 1;
      return [
        { key: "power", text: `POWER ${percent(props.power)}`, tone: levelTone(props.power, 50, 25, props.tone) },
        down ? { key: "core", text: core === "damaged" ? "CORE DAMAGED" : "CORE OFFLINE", tone: "danger" } : { key: "core", text: "CORE ONLINE" },
      ];
    }
    case "damage":
      if (props.damaged.length === 0 && props.offline.length === 0) return [{ key: "nominal", text: "ALL SYSTEMS NOMINAL", tone: "success" }];
      return [
        { key: "damaged", text: `${props.damaged.length} DAMAGED`, tone: props.damaged.length > 0 ? "danger" : props.tone },
        { key: "offline", text: `${props.offline.length} OFFLINE`, tone: props.offline.length > 0 ? "warning" : props.tone },
      ];
  }
};

// Seconds for one pulse of power along a conduit: quicker with more power.
const flowSeconds = (power: number): number => 0.6 + ((100 - clamp(power)) / 100) * 2.4;

interface Marked {
  part: ShipPart;
  state: PartState;
  tone: string;
}

const markedParts = (ship: Ship, props: ShipProps): Marked[] =>
  ship.parts.flatMap((part) => {
    const state = systemState(part.system, props);
    return state ? [{ part, state, tone: stateTone(part.system, state) }] : [];
  });

const tagTone = (marked: readonly Marked[], system: string, fallback: string): string =>
  marked.find((entry) => entry.part.system === system)?.tone ?? fallback;

// Labels are this share of the heading's size.
const TAG_TEXT = 0.85;

// The drawing area's size and the heading's text size, so labels in the drawing come out as big as the text
// around it whatever the view's shape. Unmeasured (tests, no ResizeObserver) the drawing sizes its own labels.
const useFit = () => {
  const area = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<Fit | undefined>(undefined);
  useEffect(() => {
    const box = area.current;
    const text = head.current;
    if (!box || !text || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const size = Number.parseFloat(getComputedStyle(text).fontSize) * TAG_TEXT;
      setFit((last) =>
        last && last.width === box.clientWidth && last.height === box.clientHeight && last.text === size
          ? last
          : { width: box.clientWidth, height: box.clientHeight, text: size },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  return { area, head, fit };
};

const flatPoint = (view: FlatView, [x, y, z]: readonly [number, number, number]): string =>
  view === "top" ? `${x} ${y}` : view === "side" ? `${x} ${-z}` : `${y} ${-z}`;

const Tags = ({ layout, marked, tone }: { layout: FlatLayout; marked: readonly Marked[]; tone: string }) => (
  <>
    {layout.tags.map((tag) => (
      <g key={tag.system} className="base-ship__tag" data-tone={tagTone(marked, tag.system, tone)} data-band={tag.band}>
        <path className="base-ship__leader" d={tag.leader} />
        <circle className="base-ship__pin" cx={tag.anchor[0]} cy={tag.anchor[1]} r={layout.font * 0.22} />
        <text className="base-ship__tag-text" x={tag.x} y={tag.y} fontSize={layout.font}>
          {tag.text}
        </text>
      </g>
    ))}
  </>
);

interface ViewProps {
  ship: Ship;
  props: ShipProps;
  fit: Fit | undefined;
}

const FlatShip = ({ ship, view, props, fit, still }: ViewProps & { view: FlatView; still: boolean }) => {
  const clip = `ship-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const marked = markedParts(ship, props);
  // The top view stands bow up in a box taller than wide.
  const rotated = view === "top" && fit !== undefined && fit.height > fit.width * 1.05;
  const layout = flatLayout(ship, view, taggedSystems(props), rotated, props.mode === "tactical", fit);
  const { stage, shield } = layout;
  const art = ship.views[view];
  const decks = view !== "top" && (props.mode === "engineering" || props.mode === "damage");
  const sweep = { "--ship-sweep": `${stage.width}px` } as CSSProperties;
  return (
    <svg
      className="base-ship__drawing"
      viewBox={`${stage.x} ${stage.y} ${stage.width} ${stage.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {still ? null : (
        <defs>
          <clipPath id={clip}>
            <rect className="base-ship__reveal" x={stage.x} y={stage.y} width={stage.width} height={stage.height} />
          </clipPath>
        </defs>
      )}
      {shield ? (
        <ellipse
          className="base-ship__shield"
          data-tone={levelTone(props.shields, 50, 25, "accent")}
          data-down={props.shields < 1}
          cx={shield.cx}
          cy={shield.cy}
          rx={shield.rx}
          ry={shield.ry}
          style={{ opacity: 0.2 + (clamp(props.shields) / 100) * 0.8 }}
        />
      ) : null}
      <g clipPath={still ? undefined : `url(#${clip})`}>
        <g transform={rotated ? "rotate(90)" : undefined}>
          <path className="base-ship__hull" d={art.outline} />
          {decks ? <path className="base-ship__decks" d={art.decks} /> : null}
          <path className="base-ship__detail" d={art.detail} />
          <path className="base-ship__lines" d={art.lines} />
          <path className="base-ship__windows" d={art.windows} />
          {props.mode === "engineering"
            ? ship.conduits.map((conduit) => (
                <path
                  key={conduit.id}
                  className="base-ship__flow"
                  data-tone={tagTone(marked, conduit.system, FLOW_TONE)}
                  data-state={systemState(conduit.system, props)}
                  d={`M${conduit.points.map((point) => flatPoint(view, point)).join("L")}`}
                />
              ))
            : null}
          {marked.map(({ part, state, tone }) => (
            <path
              key={part.id}
              className="base-ship__part"
              data-system={part.system}
              data-state={state}
              data-tone={tone}
              data-hidden={part.views[view].hidden === true}
              d={part.views[view].path}
            />
          ))}
        </g>
        <Tags layout={layout} marked={marked} tone={props.tone} />
      </g>
      {still ? null : <rect className="base-ship__sweep" x={stage.x} y={stage.y} width={stage.width * 0.004} height={stage.height} style={sweep} />}
    </svg>
  );
};

const TurnShip = ({ ship, props, fit, now }: ViewProps & { now: number }) => {
  const geometry = turnGeometry(ship);
  const yaw = RESTING_YAW + ((now / 1000 / props.seconds) % 1) * Math.PI * 2;
  const hull = turnHull(ship, yaw);
  const marked = markedParts(ship, props);
  const { stage } = geometry;
  const font = turnFont(stage, fit);
  const anchors = taggedSystems(props).flatMap((system) => {
    const part = ship.parts.find((candidate) => candidate.system === system);
    if (!part) return [];
    const at = projectTurn(yaw, ...part.centre);
    return [{ system, at: [at.x, at.y] as const }];
  });
  return (
    <svg
      className="base-ship__drawing"
      viewBox={`${stage.x} ${stage.y} ${stage.width} ${stage.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {props.mode === "tactical" ? (
        <path
          className="base-ship__shield base-ship__shield--rings"
          data-tone={levelTone(props.shields, 50, 25, "accent")}
          data-down={props.shields < 1}
          d={turnShield(geometry.shield, yaw)}
          style={{ opacity: 0.2 + (clamp(props.shields) / 100) * 0.8 }}
        />
      ) : null}
      <path className="base-ship__hull-far" d={hull.far} />
      <path className="base-ship__hull-near" d={hull.near} />
      {props.mode === "engineering"
        ? ship.conduits.map((conduit) => (
            <path
              key={conduit.id}
              className="base-ship__flow"
              data-tone={tagTone(marked, conduit.system, FLOW_TONE)}
              data-state={systemState(conduit.system, props)}
              d={turnPolyline(yaw, conduit.points)}
            />
          ))
        : null}
      {marked.map(({ part, state, tone }) => {
        const at = projectTurn(yaw, ...part.centre);
        return (
          <circle
            key={part.id}
            className="base-ship__marker"
            data-system={part.system}
            data-state={state}
            data-tone={tone}
            data-far={at.depth < 0}
            cx={at.x}
            cy={at.y}
            r={font * 0.32}
          />
        );
      })}
      {turnTags(anchors, stage, font).map((tag) => (
        <g key={tag.system} className="base-ship__tag" data-tone={tagTone(marked, tag.system, props.tone)}>
          <path className="base-ship__leader" d={tag.leader} />
          <text className="base-ship__tag-text" x={tag.x} y={tag.y} fontSize={font} data-anchor={tag.side === "left" ? "start" : "end"}>
            {tag.text}
          </text>
        </g>
      ))}
    </svg>
  );
};

export const BaseShipSchematic = ({ props }: WidgetRendererProps<ShipProps>) => {
  const ship = ships[props.ship];
  const still = useStill();
  const turning = props.view === "turn";
  const now = useNow(turning && !still ? 50 : null);
  const { area, head, fit } = useFit();
  const style = { "--ship-flow": `${flowSeconds(props.power)}s` } as CSSProperties;
  return (
    <div
      className="base-ship"
      data-tone={props.tone}
      data-mode={props.mode}
      data-view={props.view}
      data-armed={props.armed}
      data-power={props.power < 1 ? "off" : "on"}
      style={style}
    >
      <div className="base-ship__head" ref={head}>
        <span className="base-ship__label">{props.label}</span>
        <span className="base-ship__view">{VIEW_NAMES[props.view]}</span>
      </div>
      <div className="base-ship__area" ref={area}>
        {turning ? (
          <TurnShip ship={ship} props={props} fit={fit} now={still ? 0 : now} />
        ) : (
          <FlatShip ship={ship} view={props.view} props={props} fit={fit} still={still} />
        )}
      </div>
      <div className="base-ship__status">
        {readouts(ship, props).map((readout) => (
          <span key={readout.key} className="base-ship__readout" data-tone={readout.tone ?? props.tone}>
            {readout.text}
          </span>
        ))}
      </div>
    </div>
  );
};
