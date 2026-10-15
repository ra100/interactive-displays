import {
  type Effect,
  nodeInState,
  type Profile,
  resolveTokens,
  type Screen,
  type StateDef,
  themeCssVariables,
} from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import {
  createMediaBus,
  frozenTicker,
  MediaBusContext,
  type ShowStateInfo,
  ShowStateInfoContext,
  StillContext,
  TickerContext,
} from "@interactive-displays/themes/react";
import { type CSSProperties, type ReactNode, useMemo, useState } from "react";
import { ShowStateProvider, ThemeIdProvider } from "./context.ts";
import { type Live, LiveContext } from "./live.ts";
import { NodeView } from "./NodeView.tsx";
import "./runtime.css";

const aspectRatio = (aspect: Profile["aspect"]): number => {
  const [width, height] = aspect.split(":").map(Number);
  return (width ?? 16) / (height ?? 9);
};

interface Props {
  screen: Screen;
  themeId: string;
  variant?: string | undefined;
  // The show state id, for per-node overrides, and the effect it asks the theme for.
  state?: string;
  effect?: Effect;
  // Fills its parent instead of the viewport, for galleries and previews.
  embedded?: boolean;
  // The show's states, so widgets can show the current state's name and banner.
  states?: readonly StateDef[] | undefined;
  // Signals, values and the server link; without it widgets compute their values locally.
  live?: Partial<Live> | undefined;
  // Time stands still and animations pause: for thumbnails and screenshots.
  still?: boolean;
  // How big parts are drawn (the show's or the display's scale); 1 sizes them to the display.
  scale?: number | undefined;
}

// Thumbnails freeze at one moment, the same on every render.
const STILL_TICKER = frozenTicker(Date.UTC(2026, 9, 15, 12, 0, 0));

// What renderers can know about the current state; a state the show does not list is named by its id.
const stateInfo = (states: readonly StateDef[] | undefined, state: string, effect: Effect): ShowStateInfo => {
  const found = states?.find((each) => each.id === state);
  if (!found) return { id: state, label: state, effect };
  return found.banner ? { id: found.id, label: found.label, effect, banner: found.banner } : { id: found.id, label: found.label, effect };
};

const Still = ({ still, children }: { still: boolean; children: ReactNode }) =>
  still ? (
    <StillContext.Provider value>
      <TickerContext.Provider value={STILL_TICKER}>{children}</TickerContext.Provider>
    </StillContext.Provider>
  ) : (
    children
  );

export const ScreenView = ({
  screen,
  themeId,
  variant,
  state = "normal",
  effect = "none",
  embedded = false,
  states,
  live: given,
  still = false,
  scale = 1,
}: Props) => {
  const theme = getThemeManifest(themeId);
  // Video commands from this screen's own buttons, when the caller has no bus of its own.
  const [ownMedia] = useState(createMediaBus);
  const live = useMemo<Live>(
    () => ({
      signals: given?.signals ?? [],
      store: given?.store ?? null,
      media: given?.media ?? ownMedia,
      press: given?.press,
      playSound: given?.playSound,
    }),
    [given?.signals, given?.store, given?.media, given?.press, given?.playSound, ownMedia],
  );
  const info = useMemo(() => stateInfo(states, state, effect), [states, state, effect]);
  const style = {
    ...themeCssVariables(resolveTokens(theme, variant, effect)),
    "--aspect-ratio": String(aspectRatio(screen.profile.aspect)),
    "--ui-scale": String(scale),
  } as CSSProperties;
  const root = nodeInState(screen.root, state);
  const Root = embedded ? "div" : "main";

  return (
    <div className={embedded ? "screen-frame screen-frame--embedded" : "screen-frame"}>
      <Root
        className="screen"
        data-theme={theme.id}
        data-variant={variant && theme.variants[variant] ? variant : undefined}
        data-screen-id={screen.id}
        data-fit={screen.profile.fit}
        data-state={state}
        data-effect={effect}
        data-still={still || undefined}
        style={style}
      >
        <ThemeIdProvider value={theme.id}>
          <ShowStateProvider value={state}>
            <ShowStateInfoContext.Provider value={info}>
              <LiveContext.Provider value={live}>
                <MediaBusContext.Provider value={live.media}>
                  <Still still={still}>
                    <NodeView node={root} />
                  </Still>
                </MediaBusContext.Provider>
              </LiveContext.Provider>
            </ShowStateInfoContext.Provider>
          </ShowStateProvider>
        </ThemeIdProvider>
      </Root>
    </div>
  );
};
