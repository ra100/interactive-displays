import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";

// In a frame's title slot: the big right-aligned header. Anywhere else: a section heading that runs
// into a bar, as on LCARS panels.
export const LcarsTitle = ({ props, slot }: WidgetRendererProps<WidgetPropsOf<"title">>) =>
  slot === "title" ? (
    <header className="lcars-title lcars-title--header" data-tone={props.tone}>
      {props.code ? <span className="lcars-title__code">{props.code}</span> : null}
      <h1 className="lcars-title__text">{props.text}</h1>
    </header>
  ) : (
    <header className="lcars-title lcars-title--section" data-tone={props.tone}>
      <h2 className="lcars-title__text">{props.text}</h2>
      <span className="lcars-title__rule" aria-hidden="true" />
      {props.code ? <span className="lcars-title__code">{props.code}</span> : null}
    </header>
  );
