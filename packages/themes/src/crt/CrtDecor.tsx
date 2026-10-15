import type { DecorRendererProps } from "../contract.ts";
import type { DecorProps } from "@interactive-displays/core";
import { noiseFor } from "../format.ts";
import type { brackets, log, radar, rule } from "./decor.ts";

export const CrtRule = ({ props }: DecorRendererProps<DecorProps<typeof rule>>) => (
  <div className="crt-rule" data-style={props.style} data-tone={props.tone} aria-hidden="true">
    <span className="crt-rule__line" />
    {props.label ? <span className="crt-rule__label">{props.label}</span> : null}
    <span className="crt-rule__line" />
  </div>
);

export const CrtBrackets = ({ props }: DecorRendererProps<DecorProps<typeof brackets>>) => (
  <div className="crt-brackets" data-tone={props.tone} aria-hidden="true">
    {(["tl", "tr", "bl", "br"] as const).map((corner) => (
      <span key={corner} className="crt-brackets__corner" data-corner={corner} />
    ))}
  </div>
);

// Contacts sit at stable places for this node, so every display shows the same picture.
export const CrtRadar = ({ props, nodeId }: DecorRendererProps<DecorProps<typeof radar>>) => {
  const next = noiseFor(nodeId);
  return (
    <div className="crt-radar" data-tone={props.tone} aria-hidden="true">
      <div className="crt-radar__scope">
        <span className="crt-radar__ring" data-ring="1" />
        <span className="crt-radar__ring" data-ring="2" />
        <span className="crt-radar__ring" data-ring="3" />
        <span className="crt-radar__cross" />
        <span className="crt-radar__sweep" />
        {Array.from({ length: props.contacts }, (_, index) => {
          const angle = next(index * 2) * Math.PI * 2;
          const distance = 0.15 + next(index * 2 + 1) * 0.3;
          return (
            <span
              key={index}
              className="crt-radar__contact"
              style={{ left: `${50 + Math.cos(angle) * distance * 100}%`, top: `${50 + Math.sin(angle) * distance * 100}%`, animationDelay: `${(angle / (Math.PI * 2)) * 4}s` }}
            />
          );
        })}
      </div>
    </div>
  );
};

const MESSAGES = [
  "SYS CHECK ........ OK",
  "MEM BANK 0x3F .... OK",
  "POLLING SENSOR NET",
  "LINK ESTABLISHED",
  "DECRYPT KEY ACCEPTED",
  "BUFFER FLUSH",
  "RECALIBRATING",
  "TELEMETRY PACKET RCVD",
  "INTERRUPT 0x1A CLEARED",
  "SECTOR SCAN COMPLETE",
  "UPLINK STANDBY",
  "PRIORITY ONE OVERRIDE",
  "DIAGNOSTIC PASS 3/3",
  "CHECKSUM VERIFIED",
  "AWAITING INPUT",
  "DATA STREAM NOMINAL",
];

const SPEEDS = { slow: 24, normal: 14, fast: 7 } as const;

// Two copies of the lines scroll up in a loop, so it never runs out.
export const CrtLog = ({ props, nodeId }: DecorRendererProps<DecorProps<typeof log>>) => {
  const next = noiseFor(nodeId);
  const lines = Array.from({ length: props.lines * 2 }, (_, index) => {
    const message = MESSAGES[Math.floor(next(index) * MESSAGES.length)] ?? "";
    const stamp = String(Math.floor(next(index + 100) * 100000)).padStart(5, "0");
    return `${stamp} ${message}`;
  });
  return (
    <div className="crt-log" data-tone={props.tone} aria-hidden="true">
      <div className="crt-log__scroll" style={{ animationDuration: `${SPEEDS[props.speed]}s` }}>
        {[...lines, ...lines].map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
    </div>
  );
};
