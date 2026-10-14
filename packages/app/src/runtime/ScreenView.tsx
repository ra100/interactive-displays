import { type Profile, type Screen, themeCssVariables } from "@interactive-displays/core";
import { getThemeManifest } from "@interactive-displays/themes/manifest";
import type { CSSProperties } from "react";
import { NodeView } from "./NodeView.tsx";
import { ThemeIdProvider } from "./themeContext.ts";
import "./runtime.css";

const aspectRatio = (aspect: Profile["aspect"]): number => {
  const [width, height] = aspect.split(":").map(Number);
  return (width ?? 16) / (height ?? 9);
};

interface Props {
  screen: Screen;
  themeId: string;
}

export const ScreenView = ({ screen, themeId }: Props) => {
  const theme = getThemeManifest(themeId);
  const style = {
    ...themeCssVariables(theme.tokens),
    "--aspect-ratio": String(aspectRatio(screen.profile.aspect)),
  } as CSSProperties;

  return (
    <div className="screen-frame">
      <main
        className="screen"
        data-theme={theme.id}
        data-screen-id={screen.id}
        data-fit={screen.profile.fit}
        style={style}
      >
        <ThemeIdProvider value={theme.id}>
          <NodeView node={screen.root} />
        </ThemeIdProvider>
      </main>
    </div>
  );
};
