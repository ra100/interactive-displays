import type { Effect, Screen, Show } from "@interactive-displays/core";
import { ScreenView } from "../runtime/ScreenView.tsx";

const aspectRatio = (screen: Screen) => screen.profile.aspect.replace(":", " / ");

// A live, scaled-down render of a screen, for lists. It is the display runtime itself, so it never lies.
export const ScreenThumbnail = ({
  screen,
  theme,
  state = "normal",
  effect = "none",
}: {
  screen: Screen;
  theme: Show["theme"];
  state?: string;
  effect?: Effect;
}) => (
  <div className="thumbnail" style={{ aspectRatio: aspectRatio(screen) }} aria-hidden="true">
    <ScreenView screen={screen} themeId={theme.id} variant={theme.variant} state={state} effect={effect} embedded />
  </div>
);
