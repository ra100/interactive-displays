import type { WidgetPropsOf } from "@interactive-displays/core";
import type { WidgetRendererProps } from "../contract.ts";
import { type ShowStateInfo, useShowStateInfo } from "../runtime.ts";

// The banner of the current state, or its name in any state with an effect; nothing in calm states.
export const bannerText = (state: ShowStateInfo, override: string | undefined): string | undefined => {
  const active = state.banner ?? (state.effect === "none" || state.effect === "blackout" ? undefined : state.label);
  return active === undefined ? undefined : (override ?? active).toUpperCase();
};

export const BaseAlertBanner = ({ props }: WidgetRendererProps<WidgetPropsOf<"alert-banner">>) => {
  const text = bannerText(useShowStateInfo(), props.text);
  return (
    <div className="base-alert-banner" data-tone={props.tone} data-active={text !== undefined} role={text ? "alert" : undefined}>
      {text ? <span className="base-alert-banner__text">{text}</span> : null}
    </div>
  );
};
