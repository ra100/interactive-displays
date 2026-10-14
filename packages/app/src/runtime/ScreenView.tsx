import {
  type Effect,
  nodeInState,
  type Profile,
  resolveTokens,
  type Screen,
  themeCssVariables,
} from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import type { CSSProperties } from "react";
import { ShowStateProvider, ThemeIdProvider } from "./context.ts";
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
}

export const ScreenView = ({ screen, themeId, variant, state = "normal", effect = "none", embedded = false }: Props) => {
  const theme = getThemeManifest(themeId);
  const style = {
    ...themeCssVariables(resolveTokens(theme, variant, effect)),
    "--aspect-ratio": String(aspectRatio(screen.profile.aspect)),
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
        style={style}
      >
        <ThemeIdProvider value={theme.id}>
          <ShowStateProvider value={state}>
            <NodeView node={root} />
          </ShowStateProvider>
        </ThemeIdProvider>
      </Root>
    </div>
  );
};
