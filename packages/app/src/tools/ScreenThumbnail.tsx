import type { Effect, Screen, Show } from "@interactive-displays/core";
import type { Live } from "../runtime/live.ts";
import { ScreenView } from "../runtime/ScreenView.tsx";

const aspectRatio = (screen: Screen) => screen.profile.aspect.replace(":", " / ");

// A scaled-down render of a screen, for lists. It is the display runtime itself, so it never lies; time stands
// still in it (a page of thumbnails would otherwise animate dozens of screens), but shared values still move.
export const ScreenThumbnail = ({
  screen,
  theme,
  state = "normal",
  effect = "none",
  states,
  live,
}: {
  screen: Screen;
  theme: Show["theme"];
  state?: string;
  effect?: Effect;
  states?: Show["states"];
  live?: Pick<Live, "signals" | "store">;
}) => (
  <div className="thumbnail" style={{ aspectRatio: aspectRatio(screen) }} aria-hidden="true">
    <ScreenView
      screen={screen}
      themeId={theme.id}
      variant={theme.variant}
      state={state}
      effect={effect}
      states={states}
      live={live}
      embedded
      still
    />
  </div>
);
