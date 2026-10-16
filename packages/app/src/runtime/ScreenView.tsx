import {
  DEFAULT_PANEL,
  type Effect,
  nodeInState,
  type Orientation,
  orientationOf,
  orientationOfBox,
  type Panel,
  type Profile,
  resolveTokens,
  type Screen,
  type StateDef,
  themeCssVariables,
  turnTree,
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
import { type CSSProperties, type ReactNode, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EditingProvider, ShowStateProvider, ThemeIdProvider, type Turn, TurnProvider } from "./context.ts";
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
  // The editor's preview: empty frame slots are drawn too, as places to drop into.
  editing?: boolean;
  // The physical panel (diagonal and button height), so buttons come out in real centimetres.
  panel?: Panel | undefined;
  // The display's shape; measured from the screen's own box when not given.
  orientation?: Orientation | undefined;
}

// Until the screen box is measured: the window's shape on a display, the design's in a preview or thumbnail.
const firstGuess = (embedded: boolean, design: Orientation): Orientation =>
  embedded || typeof window === "undefined" ? design : orientationOfBox(window.innerWidth, window.innerHeight);

// The shape of the box the screen is drawn in, kept up to date as the display turns or the preview resizes.
const useMeasuredOrientation = (element: RefObject<HTMLElement | null>, initial: Orientation): Orientation => {
  const [orientation, setOrientation] = useState(initial);
  useLayoutEffect(() => {
    const target = element.current;
    if (!target) return;
    const measure = () => {
      const { width, height } = target.getBoundingClientRect();
      if (width > 0 && height > 0) setOrientation(orientationOfBox(width, height));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, [element]);
  return orientation;
};

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
  editing = false,
  panel = DEFAULT_PANEL,
  orientation: orientationProp,
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
    "--panel-inches": String(panel.inches),
    "--button-cm": String(panel.buttonCm),
  } as CSSProperties;
  // A display turned the other way from the design gets the screen rearranged for its shape, unless the screen
  // asks to keep its arrangement.
  const element = useRef<HTMLElement>(null);
  const design = orientationOf(screen.profile.aspect);
  const measured = useMeasuredOrientation(element, firstGuess(embedded, design));
  const display = orientationProp ?? measured;
  const to = screen.profile.rearrange ? display : design;
  const turn = useMemo<Turn>(() => ({ from: design, to }), [design, to]);
  const arranged = useMemo(() => turnTree(screen.root, design, to), [screen.root, design, to]);
  const root = nodeInState(arranged, state);
  const Root = embedded ? "div" : "main";

  return (
    <div className={embedded ? "screen-frame screen-frame--embedded" : "screen-frame"}>
      <Root
        ref={(node: HTMLElement | null) => {
          element.current = node;
        }}
        className="screen"
        data-theme={theme.id}
        data-variant={variant && theme.variants[variant] ? variant : undefined}
        data-screen-id={screen.id}
        data-fit={screen.profile.fit}
        data-state={state}
        data-effect={effect}
        data-still={still || undefined}
        data-orientation={display}
        data-turned={design !== to || undefined}
        style={style}
      >
        <ThemeIdProvider value={theme.id}>
          <ShowStateProvider value={state}>
            <ShowStateInfoContext.Provider value={info}>
              <LiveContext.Provider value={live}>
                <MediaBusContext.Provider value={live.media}>
                  <Still still={still}>
                    <EditingProvider value={editing}>
                      <TurnProvider value={turn}>
                        <NodeView node={root} />
                      </TurnProvider>
                    </EditingProvider>
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
